import pb from '@/lib/pocketbase/client'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getContracts } from '@/services/contracts'
import { getContractPeriods } from '@/services/contract-periods'
import { parseDurationToSeconds } from '@/lib/duration'

export interface ClientHoursData {
  company: CompanyRecord
  /** Total contratado em SEGUNDOS (preciso). */
  contractedSeconds: number
  /** Total consumido em SEGUNDOS (preciso). */
  consumedSeconds: number
  percentage: number
}

export interface QueueBreakdownItem {
  queueId: string
  queueName: string
  /** Total consumido em SEGUNDOS (preciso). */
  seconds: number
  percentage: number
}

/**
 * Retorna o intervalo (start/end) do mês/ano dados, no formato esperado pelos
 * filtros do PocketBase ("YYYY-MM-DD HH:MM:SS"). Quando `monthKey` é omitido,
 * usa o mês corrente.
 *
 * monthKey = "YYYY-MM" (ex.: "2025-02").
 */
export function getMonthRange(monthKey?: string) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
  if (monthKey) {
    const [y, m] = monthKey.split('-')
    const yi = parseInt(y, 10)
    const mi = parseInt(m, 10)
    if (!Number.isNaN(yi) && !Number.isNaN(mi)) {
      year = yi
      month = mi - 1
    }
  }
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} 00:00:00`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} 23:59:59`,
  }
}

/** @deprecated use getMonthRange() */
export function getCurrentMonthRange() {
  return getMonthRange()
}

/** Retorna o monthKey ("YYYY-MM") do mês corrente. */
function getCurrentMonthKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/**
 * Retorna os dados de horas por cliente para o período informado.
 *
 * Para o **mês atual** (monthKey omitido OU igual ao mês corrente): NÃO filtra
 * por `period_start` — mostra todos os períodos ativos (status "Ativo"),
 * independentemente de quando começaram. Esse é o comportamento original,
 * necessário para incluir contratos iniciados em meses anteriores que seguem
 * ativos no mês corrente.
 *
 * Para **meses passados** (monthKey diferente do mês corrente): filtra pelo
 * `period_start` dentro daquele mês/ano e aceita status "Ativo" e "Encerrado",
 * permitindo consultar o histórico.
 */
export async function getClientHoursData(monthKey?: string): Promise<ClientHoursData[]> {
  const [companies, contracts, periods] = await Promise.all([
    getCompanies(),
    getContracts(),
    getContractPeriods(),
  ])

  const contractCompanyMap = new Map<string, string>()
  contracts.forEach((c) => contractCompanyMap.set(c.id, c.company))

  // Soma em SEGUNDOS (via parseDurationToSeconds) para garantir precisão total,
  // sem erros de arredondamento de ponto flutuante. Aceita também valores
  // legados em formato de número puro (ex.: 96 → 96:00:00).
  const companyMap = new Map<string, { contractedSec: number; consumedSec: number }>()

  const effectiveMonthKey = monthKey ?? getCurrentMonthKey()
  const isCurrentMonth = effectiveMonthKey === getCurrentMonthKey()
  const { start, end } = getMonthRange(effectiveMonthKey)
  const startMs = new Date(start + 'Z').getTime()
  const endMs = new Date(end + 'Z').getTime()

  periods.forEach((p) => {
    // Mês corrente: apenas períodos ativos, sem filtrar period_start.
    // Mês passado: aceita Ativo/Encerrado e filtra period_start dentro do mês.
    if (isCurrentMonth) {
      if (p.status !== 'Ativo') return
    } else {
      if (p.status !== 'Ativo' && p.status !== 'Encerrado') return
      if (!p.period_start) return
      const ps = new Date(p.period_start + 'Z').getTime()
      if (Number.isNaN(ps) || ps < startMs || ps > endMs) return
    }

    const companyId = contractCompanyMap.get(p.contract)
    if (!companyId) return

    const existing = companyMap.get(companyId) || { contractedSec: 0, consumedSec: 0 }
    existing.contractedSec += parseDurationToSeconds(p.contracted_hours) ?? 0
    existing.consumedSec += parseDurationToSeconds(p.consumed_hours) ?? 0
    companyMap.set(companyId, existing)
  })

  const result: ClientHoursData[] = []
  companies.forEach((company) => {
    const data = companyMap.get(company.id)
    if (!data || data.contractedSec === 0) return
    const pct = (data.consumedSec / data.contractedSec) * 100
    result.push({
      company,
      contractedSeconds: data.contractedSec,
      consumedSeconds: data.consumedSec,
      percentage: pct,
    })
  })

  return result.sort((a, b) => b.percentage - a.percentage)
}

export async function getQueueBreakdown(
  companyId: string,
  monthKey?: string,
): Promise<QueueBreakdownItem[]> {
  const { start, end } = getMonthRange(monthKey)

  const tickets = await pb.collection('tickets').getFullList({
    filter: `company = "${companyId}"`,
  })

  if (tickets.length === 0) return []

  const ticketQueueMap = new Map<string, string>()
  tickets.forEach((t: any) => {
    if (t.queue) ticketQueueMap.set(t.id, t.queue)
  })

  const ticketIds = tickets.map((t: any) => t.id)
  const batchSize = 50
  const allInteractions: any[] = []

  for (let i = 0; i < ticketIds.length; i += batchSize) {
    const batch = ticketIds.slice(i, i + batchSize)
    const ticketFilter = batch.map((id) => `ticket = "${id}"`).join(' || ')
    const interactions = await pb.collection('ticket_interactions').getFullList({
      filter: `(${ticketFilter}) && created >= "${start}" && created <= "${end}" && hour_type = "Contratada"`,
    })
    allInteractions.push(...interactions)
  }

  if (allInteractions.length === 0) return []

  const queueIds = [...new Set([...ticketQueueMap.values()].filter(Boolean))]
  const queueNameMap = new Map<string, string>()

  if (queueIds.length > 0) {
    const queueFilter = queueIds.map((id) => `id = "${id}"`).join(' || ')
    const queueRecords = await pb.collection('queues').getFullList({ filter: queueFilter })
    queueRecords.forEach((q: any) => queueNameMap.set(q.id, q.name))
  }

  // Soma em SEGUNDOS (preciso) — duration_minutes está em minutos.
  const queueHoursMap = new Map<string, number>()
  let totalSeconds = 0

  allInteractions.forEach((interaction: any) => {
    const queueId = ticketQueueMap.get(interaction.ticket)
    if (!queueId) return
    const minutes = Number(interaction.duration_minutes) || 0
    const seconds = Math.round(minutes * 60)
    queueHoursMap.set(queueId, (queueHoursMap.get(queueId) || 0) + seconds)
    totalSeconds += seconds
  })

  const result: QueueBreakdownItem[] = []
  queueHoursMap.forEach((seconds, queueId) => {
    result.push({
      queueId,
      queueName: queueNameMap.get(queueId) || 'Sem Fila',
      seconds,
      percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
    })
  })

  return result.sort((a, b) => b.seconds - a.seconds)
}
