import pb from '@/lib/pocketbase/client'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getContracts } from '@/services/contracts'
import { getContractPeriods } from '@/services/contract-periods'

export interface ClientHoursData {
  company: CompanyRecord
  contractedHours: number
  consumedHours: number
  percentage: number
}

export interface QueueBreakdownItem {
  queueId: string
  queueName: string
  hours: number
  percentage: number
}

export function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} 00:00:00`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} 23:59:59`,
  }
}

export async function getClientHoursData(): Promise<ClientHoursData[]> {
  const [companies, contracts, periods] = await Promise.all([
    getCompanies(),
    getContracts(),
    getContractPeriods(),
  ])

  const contractCompanyMap = new Map<string, string>()
  contracts.forEach((c) => contractCompanyMap.set(c.id, c.company))

  const companyMap = new Map<string, { contracted: number; consumed: number }>()

  periods.forEach((p) => {
    if (p.status !== 'Ativo') return
    const companyId = contractCompanyMap.get(p.contract)
    if (!companyId) return
    const existing = companyMap.get(companyId) || { contracted: 0, consumed: 0 }
    existing.contracted += p.contracted_hours || 0
    existing.consumed += p.consumed_hours || 0
    companyMap.set(companyId, existing)
  })

  const result: ClientHoursData[] = []
  companies.forEach((company) => {
    const data = companyMap.get(company.id)
    if (!data || data.contracted === 0) return
    result.push({
      company,
      contractedHours: data.contracted,
      consumedHours: data.consumed,
      percentage: (data.consumed / data.contracted) * 100,
    })
  })

  return result.sort((a, b) => b.percentage - a.percentage)
}

export async function getQueueBreakdown(companyId: string): Promise<QueueBreakdownItem[]> {
  const { start, end } = getCurrentMonthRange()

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

  const queueHoursMap = new Map<string, number>()
  let totalHours = 0

  allInteractions.forEach((interaction: any) => {
    const queueId = ticketQueueMap.get(interaction.ticket)
    if (!queueId) return
    const hours = (interaction.duration_minutes || 0) / 60
    queueHoursMap.set(queueId, (queueHoursMap.get(queueId) || 0) + hours)
    totalHours += hours
  })

  const result: QueueBreakdownItem[] = []
  queueHoursMap.forEach((hours, queueId) => {
    result.push({
      queueId,
      queueName: queueNameMap.get(queueId) || 'Sem Fila',
      hours,
      percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0,
    })
  })

  return result.sort((a, b) => b.hours - a.hours)
}
