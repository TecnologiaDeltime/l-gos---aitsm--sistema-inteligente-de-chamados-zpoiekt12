import type { DashboardData } from '@/services/dashboard'
import type { TicketRecord } from '@/services/tickets'
import { formatMinutes, formatHours } from '@/lib/duration'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export interface ExecutiveKpis {
  opened: number
  resolved: number
  closed: number
  pending: number
  contractedHours: number
  contractedDisplay: string
  consumedMinutes: number
  consumedDisplay: string
  balanceHours: number
  balanceDisplay: string
  visits: number
}

export function computeKpis(data: DashboardData): ExecutiveKpis {
  const opened = data.tickets.length
  const resolved = data.tickets.filter((t) => t.status === 'Resolvido').length
  const closed = data.tickets.filter((t) => t.status === 'Encerrado').length
  const pending = data.tickets.filter(
    (t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status),
  ).length
  const contractedHours = data.periods
    .filter((p) => p.status === 'Ativo')
    .reduce((s, p) => s + (p.contracted_hours || 0), 0)
  const consumedMinutes = data.interactions.reduce((s, i) => s + (i.duration_minutes || 0), 0)
  const balanceHours = contractedHours - consumedMinutes / 60
  return {
    opened,
    resolved,
    closed,
    pending,
    contractedHours,
    contractedDisplay: formatHours(contractedHours),
    consumedMinutes,
    consumedDisplay: formatMinutes(consumedMinutes),
    balanceHours,
    balanceDisplay: formatHours(balanceHours),
    visits: data.visits.length,
  }
}

function getPeriodKey(date: Date, granularity: string): string {
  const m = date.getMonth()
  const y = date.getFullYear()
  if (granularity === 'trimestral') return `T${Math.floor(m / 3) + 1} ${y}`
  if (granularity === 'semestral') return `S${Math.floor(m / 6) + 1} ${y}`
  if (granularity === 'anual') return `${y}`
  return `${MONTH_SHORT[m]}/${y}`
}

export interface MonthlyChartData {
  period: string
  label: string
  Abertos: number
  Resolvidos: number
}

export function computeMonthlyChart(
  tickets: TicketRecord[],
  granularity: string,
): MonthlyChartData[] {
  const groups = new Map<string, { Abertos: number; Resolvidos: number; sortKey: string }>()
  tickets.forEach((t) => {
    if (!t.created) return
    const date = new Date(t.created)
    const key = getPeriodKey(date, granularity)
    const sortKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
    const group = groups.get(key) || { Abertos: 0, Resolvidos: 0, sortKey }
    group.Abertos++
    if (t.status === 'Resolvido' || t.status === 'Encerrado') group.Resolvidos++
    groups.set(key, group)
  })
  return Array.from(groups.entries())
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([period, val]) => ({ period, label: period, ...val }))
}

export interface SlaPriorityData {
  priority: string
  withinTarget: number
  outsideTarget: number
  total: number
  pct: number
  target: number
  status: 'atingida' | 'proxima' | 'nao_atingida'
}

export function computeSlaByPriority(tickets: TicketRecord[]): SlaPriorityData[] {
  const priorities = ['Crítica', 'Alta', 'Média', 'Baixa']
  return priorities.map((priority) => {
    const pt = tickets.filter((t) => t.priority === priority)
    const within = pt.filter((t) => t.sla_status === 'Dentro do Prazo').length
    const total = pt.length
    const pct = total > 0 ? (within / total) * 100 : 0
    return {
      priority,
      withinTarget: within,
      outsideTarget: total - within,
      total,
      pct,
      target: 90,
      status: pct >= 90 ? 'atingida' : pct >= 80 ? 'proxima' : 'nao_atingida',
    }
  })
}

export function computeConsumedMinutesByDimension(
  data: DashboardData,
  dimension: 'client' | 'operator' | 'contract' | 'technician',
): Array<{ label: string; minutes: number }> {
  const ticketMap = new Map(data.tickets.map((t) => [t.id, t]))
  const groups = new Map<string, number>()
  data.interactions.forEach((i) => {
    const ticket = ticketMap.get(i.ticket)
    if (!ticket) return
    let key = 'N/A'
    if (dimension === 'client') key = ticket.expand?.company?.trade_name || 'N/A'
    else if (dimension === 'operator') {
      const op = data.users.find((u) => u.id === i.author)
      key = op?.name || op?.email || 'N/A'
    } else if (dimension === 'contract') {
      const c = data.contracts.find((c) => c.id === ticket.contract)
      key = c?.number || 'N/A'
    } else if (dimension === 'technician') {
      const tech = data.users.find((u) => u.id === ticket.assigned_to)
      key = tech?.name || 'N/A'
    }
    groups.set(key, (groups.get(key) || 0) + (i.duration_minutes || 0))
  })
  return Array.from(groups.entries())
    .map(([label, minutes]) => ({ label, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

export interface OperatorPerfData {
  opId: string
  opName: string
  attended: number
  resolved: number
  pending: number
  hoursMinutes: number
  avgHoursPerTicket: string
  slaMet: number
  slaViolated: number
}

export function computeOperatorPerformance(data: DashboardData): OperatorPerfData[] {
  const operators = data.users.filter((u) => ['tecnico', 'gestor', 'admin'].includes(u.role || ''))
  return operators
    .map((op) => {
      const opTickets = data.tickets.filter((t) => t.assigned_to === op.id)
      const resolved = opTickets.filter((t) => ['Resolvido', 'Encerrado'].includes(t.status))
      const pending = opTickets.filter(
        (t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status),
      )
      const opInteractions = data.interactions.filter((i) => i.author === op.id)
      const minutes = opInteractions.reduce((s, i) => s + (i.duration_minutes || 0), 0)
      const slaMet = opTickets.filter((t) => t.sla_status === 'Dentro do Prazo').length
      const slaViolated = opTickets.filter((t) => t.sla_status === 'Violado').length
      return {
        opId: op.id,
        opName: op.name || op.email || 'N/A',
        attended: opTickets.length,
        resolved: resolved.length,
        pending: pending.length,
        hoursMinutes: minutes,
        avgHoursPerTicket:
          opTickets.length > 0 ? formatMinutes(minutes / opTickets.length) : '00:00:00',
        slaMet,
        slaViolated,
      }
    })
    .filter((r) => r.attended > 0 || r.hoursMinutes > 0)
}

export interface VisitMetrics {
  scheduled: number
  completed: number
  completionRate: number
}

export function computeVisitMetrics(visits: DashboardData['visits']): VisitMetrics {
  const scheduled = visits.filter(
    (v) => v.status === 'Agendada' || v.status === 'Em Andamento',
  ).length
  const completed = visits.filter((v) => v.status === 'Concluída').length
  const total = visits.length
  return {
    scheduled: visits.filter((v) => v.status !== 'Cancelada').length,
    completed,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
  }
}

export function computeMonthlyVisits(
  visits: DashboardData['visits'],
): Array<{ month: string; Agendadas: number; Concluidas: number }> {
  const groups = new Map<string, { Agendadas: number; Concluidas: number; sortKey: string }>()
  visits.forEach((v) => {
    if (!v.scheduled_date) return
    const date = new Date(v.scheduled_date)
    const key = `${MONTH_SHORT[date.getMonth()]}/${date.getFullYear()}`
    const sortKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
    const group = groups.get(key) || { Agendadas: 0, Concluidas: 0, sortKey }
    if (v.status !== 'Cancelada') group.Agendadas++
    if (v.status === 'Concluída') group.Concluidas++
    groups.set(key, group)
  })
  return Array.from(groups.entries())
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([month, val]) => ({ month, ...val }))
}
