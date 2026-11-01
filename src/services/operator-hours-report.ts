import pb from '@/lib/pocketbase/client'
import { getOperators } from '@/services/operators'
import type { OperatorItem } from '@/types/operators'
import { getMonthRange } from '@/services/client-hours'

export interface OperatorInteractionDetail {
  id: string
  ticketId: string
  ticketNumber: string
  ticketTitle: string
  companyName: string
  created: string
  durationMinutes: number
  durationSeconds: number
  origin: string
  hourType: string
  type: string
  content: string
}

export interface OperatorTicketSummary {
  ticketId: string
  ticketNumber: string
  ticketTitle: string
  companyName: string
  status: string
  workedSeconds: number
  accompanimentSeconds: number
  totalSeconds: number
}

export interface OperatorHoursRow {
  operatorId: string
  operatorName: string
  operatorEmail: string
  operatorRole: string
  avatarUrl?: string
  /** Segundos acumulados via play/pause (origin = 'Cronômetro' / tickets.operator_worked_seconds) */
  workedSeconds: number
  /** Segundos acumulados via logs/apontamento (origin != 'Cronômetro' / tickets.accompaniment_seconds) */
  accompanimentSeconds: number
  /** Soma total de horas investidas (trabalhadas + acompanhamento) */
  totalSeconds: number
  /** Quantidade de interações de cronômetro no período */
  cronoInteractionsCount: number
  /** Quantidade de interações de acompanhamento no período */
  accompanimentInteractionsCount: number
  /** Total de chamados com apontamento no período */
  ticketsCount: number
  /** Detalhamento dos chamados */
  tickets: OperatorTicketSummary[]
  /** Detalhamento de cada interação */
  interactions: OperatorInteractionDetail[]
}

export interface OperatorHoursFilter {
  /** "YYYY-MM" (ex: "2026-10") ou customizado */
  monthKey?: string
  startDate?: string
  endDate?: string
  operatorId?: string
}

export interface OperatorHoursReportData {
  rows: OperatorHoursRow[]
  totals: {
    workedSeconds: number
    accompanimentSeconds: number
    totalSeconds: number
    cronoInteractionsCount: number
    accompanimentInteractionsCount: number
    ticketsCount: number
    operatorsCount: number
  }
}

/**
 * Carrega e consolida as horas trabalhadas (Cronômetro/play-pause) e
 * as horas de acompanhamento (logs/apontamentos manuais) por operador.
 *
 * Respeita rigorosamente a regra das migrações 0093, 0108 e nightly_aggregation.js:
 * - Horas trabalhadas: origin = 'Cronômetro' (alimentam operator_worked_seconds e NÃO debitam franquia).
 * - Horas de acompanhamento: origin != 'Cronômetro' (alimentam accompaniment_seconds e debitam franquia).
 */
export async function getOperatorHoursReport(
  filters: OperatorHoursFilter = {},
): Promise<OperatorHoursReportData> {
  // 1. Determinar intervalo de datas
  let startIso: string
  let endIso: string

  if (filters.startDate && filters.endDate) {
    startIso = `${filters.startDate} 00:00:00.000Z`
    endIso = `${filters.endDate} 23:59:59.999Z`
  } else {
    const range = getMonthRange(filters.monthKey)
    startIso = `${range.start}.000Z`
    endIso = `${range.end}.999Z`
  }

  // 2. Buscar operadores elegíveis (técnicos, gestores, admins)
  const allOps = await getOperators()
  const operatorMap = new Map<string, OperatorItem>()
  allOps.forEach((op) => {
    operatorMap.set(op.id, op)
  })

  // 3. Montar filtro de ticket_interactions
  const filterParts: string[] = [`created >= "${startIso}"`, `created <= "${endIso}"`]

  if (filters.operatorId && filters.operatorId !== 'all') {
    filterParts.push(`author = "${filters.operatorId}"`)
  }

  const interactions = await pb.collection('ticket_interactions').getFullList({
    filter: filterParts.join(' && '),
    sort: '-created',
    expand: 'ticket,ticket.company,author',
  })

  // 4. Agrupar por operador
  const grouped = new Map<
    string,
    {
      operator: OperatorItem | { id: string; name: string; email: string; role?: string }
      workedSeconds: number
      accompanimentSeconds: number
      cronoInteractionsCount: number
      accompanimentInteractionsCount: number
      ticketMap: Map<string, OperatorTicketSummary>
      interactions: OperatorInteractionDetail[]
    }
  >()

  // Se um operador específico foi filtrado, inicializa para garantir que ele apareça mesmo com 0 horas
  if (filters.operatorId && filters.operatorId !== 'all') {
    const targetOp = operatorMap.get(filters.operatorId)
    if (targetOp) {
      grouped.set(targetOp.id, {
        operator: targetOp,
        workedSeconds: 0,
        accompanimentSeconds: 0,
        cronoInteractionsCount: 0,
        accompanimentInteractionsCount: 0,
        ticketMap: new Map(),
        interactions: [],
      })
    }
  }

  for (const it of interactions as any[]) {
    const authorId = it.author || it.expand?.author?.id
    if (!authorId) continue

    let opEntry = grouped.get(authorId)
    if (!opEntry) {
      const foundOp = operatorMap.get(authorId) ||
        it.expand?.author || {
          id: authorId,
          name: 'Operador não identificado',
          email: '',
          role: 'tecnico',
        }
      opEntry = {
        operator: foundOp,
        workedSeconds: 0,
        accompanimentSeconds: 0,
        cronoInteractionsCount: 0,
        accompanimentInteractionsCount: 0,
        ticketMap: new Map(),
        interactions: [],
      }
      grouped.set(authorId, opEntry)
    }

    const durationMin = Number(it.duration_minutes) || 0
    const durationSec = Math.round(durationMin * 60)
    const isCrono = it.origin === 'Cronômetro'

    if (isCrono) {
      opEntry.workedSeconds += durationSec
      opEntry.cronoInteractionsCount += 1
    } else {
      opEntry.accompanimentSeconds += durationSec
      opEntry.accompanimentInteractionsCount += 1
    }

    const ticket = it.expand?.ticket
    const ticketId = it.ticket || ticket?.id || 'sem-ticket'
    const company = ticket?.expand?.company
    const companyName = company?.trade_name || company?.legal_name || '—'
    const ticketNumber = ticket?.number || '—'
    const ticketTitle = ticket?.title || 'Chamado sem título'

    // Ticket Map
    let ticketSummary = opEntry.ticketMap.get(ticketId)
    if (!ticketSummary) {
      ticketSummary = {
        ticketId,
        ticketNumber,
        ticketTitle,
        companyName,
        status: ticket?.status || '—',
        workedSeconds: 0,
        accompanimentSeconds: 0,
        totalSeconds: 0,
      }
      opEntry.ticketMap.set(ticketId, ticketSummary)
    }

    if (isCrono) {
      ticketSummary.workedSeconds += durationSec
    } else {
      ticketSummary.accompanimentSeconds += durationSec
    }
    ticketSummary.totalSeconds = ticketSummary.workedSeconds + ticketSummary.accompanimentSeconds

    // Interações detalhadas
    opEntry.interactions.push({
      id: it.id,
      ticketId,
      ticketNumber,
      ticketTitle,
      companyName,
      created: it.created,
      durationMinutes: durationMin,
      durationSeconds: durationSec,
      origin: it.origin || 'Manual',
      hourType: it.hour_type || '—',
      type: it.type || 'Público',
      content: it.content || '',
    })
  }

  // 5. Montar linhas consolidadas
  const rows: OperatorHoursRow[] = []
  let totalWorked = 0
  let totalAcc = 0
  let totalCronoCount = 0
  let totalAccCount = 0
  const uniqueTicketsAll = new Set<string>()

  for (const [opId, data] of grouped.entries()) {
    const totalSec = data.workedSeconds + data.accompanimentSeconds
    totalWorked += data.workedSeconds
    totalAcc += data.accompanimentSeconds
    totalCronoCount += data.cronoInteractionsCount
    totalAccCount += data.accompanimentInteractionsCount

    const ticketsList = Array.from(data.ticketMap.values()).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    )
    ticketsList.forEach((t) => uniqueTicketsAll.add(t.ticketId))

    const opRecord = data.operator as any

    rows.push({
      operatorId: opId,
      operatorName: opRecord.name || opRecord.email || 'Operador',
      operatorEmail: opRecord.email || '',
      operatorRole: opRecord.role || 'tecnico',
      avatarUrl: opRecord.avatar,
      workedSeconds: data.workedSeconds,
      accompanimentSeconds: data.accompanimentSeconds,
      totalSeconds: totalSec,
      cronoInteractionsCount: data.cronoInteractionsCount,
      accompanimentInteractionsCount: data.accompanimentInteractionsCount,
      ticketsCount: ticketsList.length,
      tickets: ticketsList,
      interactions: data.interactions,
    })
  }

  // Ordenar por maior volume total de horas
  rows.sort((a, b) => b.totalSeconds - a.totalSeconds)

  return {
    rows,
    totals: {
      workedSeconds: totalWorked,
      accompanimentSeconds: totalAcc,
      totalSeconds: totalWorked + totalAcc,
      cronoInteractionsCount: totalCronoCount,
      accompanimentInteractionsCount: totalAccCount,
      ticketsCount: uniqueTicketsAll.size,
      operatorsCount: rows.length,
    },
  }
}
