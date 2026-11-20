import pb from '@/lib/pocketbase/client'
import { getQueues, type QueueRecord } from '@/services/queues'
import { getOperators } from '@/services/operators'
import { getClientHoursData, type ClientHoursData } from '@/services/client-hours'
import { getChanges, type ChangeRecord } from '@/services/changes'
import { getProblems, type ProblemRecord } from '@/services/problems'
import { getCompanies } from '@/services/companies'
import { getContractPeriods } from '@/services/contract-periods'
import { getContracts } from '@/services/contracts'
import { parseDurationToSeconds } from '@/lib/duration'
import {
  computeKpis,
  computeSlaByPriority,
  type SlaPriorityData,
  type ExecutiveKpis,
} from '@/lib/dashboard-metrics'
import type { DashboardData } from '@/services/dashboard'
import type { TicketRecord } from '@/services/tickets'
import type { OperatorItem } from '@/types/operators'

export interface QueueTicketsSummary {
  queue: QueueRecord
  total: number
  byStatus: Record<string, number>
}

export interface TicketStatusSummary {
  status: string
  count: number
  percentage: number
}

export interface TvMetasData {
  kpis: ExecutiveKpis
  slaByPriority: SlaPriorityData[]
}

export interface ChangesSummary {
  open: number
  inProgress: number
  closed: number
  total: number
  byStatus: Record<string, number>
}

export interface ProblemsSummary {
  open: number
  inEffectiveness: number
  completed: number
  total: number
  byStatus: Record<string, number>
}

export interface TvModePreferences {
  enabledDashboards: string[]
  rotationIntervalSeconds: number
  themeMode?: 'dark' | 'light'
  period: TvPeriodId
}

/**
 * Períodos disponíveis no filtro do Modo TV.
 * Aplicam-se às visões com dimensão temporal (chamados, mudanças, problemas,
 * horas por cliente). "Quem está Online" e "Metas Executivas" são sempre
 * instantâneos e ignoram o período.
 */
export type TvPeriodId = 'today' | '7d' | '30d' | 'month' | 'all'

export interface TvPeriodOption {
  id: TvPeriodId
  label: string
  shortLabel: string
}

export const TV_PERIOD_OPTIONS: TvPeriodOption[] = [
  { id: 'today', label: 'Hoje', shortLabel: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias', shortLabel: '7 dias' },
  { id: '30d', label: 'Últimos 30 dias', shortLabel: '30 dias' },
  { id: 'month', label: 'Mês atual', shortLabel: 'Mês' },
  { id: 'all', label: 'Todo o período', shortLabel: 'Tudo' },
]

export const DEFAULT_TV_PERIOD: TvPeriodId = 'all'

export function getTvPeriodOption(id: TvPeriodId | undefined): TvPeriodOption {
  return (
    TV_PERIOD_OPTIONS.find((o) => o.id === id) ?? TV_PERIOD_OPTIONS[TV_PERIOD_OPTIONS.length - 1]
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** Data/hora de início do período, no formato dos filtros do PocketBase. */
export function getTvPeriodStartDate(id: TvPeriodId): string | null {
  const now = new Date()
  switch (id) {
    case 'today':
      return `${fmtDate(now)} 00:00:00`
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return `${fmtDate(start)} 00:00:00`
    }
    case '7d':
    case '30d': {
      const days = id === '7d' ? 7 : 30
      const start = new Date(now)
      start.setDate(start.getDate() - (days - 1))
      return `${fmtDate(start)} 00:00:00`
    }
    default:
      return null
  }
}

/** Filtro PocketBase do período sobre o campo informado (padrão: created). */
export function buildTvPeriodFilter(id: TvPeriodId, field = 'created'): string | undefined {
  const start = getTvPeriodStartDate(id)
  return start ? `${field} >= "${start}"` : undefined
}

export const TV_DASHBOARDS_CATALOG = [
  {
    id: 'queue_tickets',
    title: 'Chamados por Fila',
    description: 'Total de chamados por fila de atendimento e quebra detalhada por status',
  },
  {
    id: 'status_tickets',
    title: 'Chamados por Status',
    description: 'Contagem geral do sistema agrupada por status com destaque visual',
  },
  {
    id: 'online_users',
    title: 'Quem está Online',
    description: 'Operadores e usuários ativos/online no sistema com perfil e filas',
  },
  {
    id: 'client_hours',
    title: 'Consumo de Horas dos Clientes',
    description: 'Cartões por cliente: consumidas, contratadas e percentual de franquia',
  },
  {
    id: 'executive_goals',
    title: 'Metas e Saldo de Horas',
    description: 'Cumprimento de meta por prioridade, saldo e horas consumidas',
  },
  {
    id: 'changes_summary',
    title: 'Gestão de Mudanças',
    description: 'Totais de mudanças: Abertas, Em andamento e Fechadas',
  },
  {
    id: 'problems_summary',
    title: 'Gestão de Problemas',
    description: 'Totais de problemas: Abertos, Em teste de efetividade e Concluídos',
  },
] as const

export const DEFAULT_TV_PREFERENCES: TvModePreferences = {
  enabledDashboards: [
    'queue_tickets',
    'status_tickets',
    'client_hours',
    'executive_goals',
    'online_users',
    'changes_summary',
    'problems_summary',
  ],
  rotationIntervalSeconds: 30,
  themeMode: 'dark',
  period: DEFAULT_TV_PERIOD,
}

const STORAGE_KEY = 'logos_aitsm_tv_mode_prefs'

export function loadTvPreferences(): TvModePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TV_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      enabledDashboards:
        Array.isArray(parsed.enabledDashboards) && parsed.enabledDashboards.length > 0
          ? parsed.enabledDashboards
          : DEFAULT_TV_PREFERENCES.enabledDashboards,
      rotationIntervalSeconds:
        typeof parsed.rotationIntervalSeconds === 'number' && parsed.rotationIntervalSeconds >= 5
          ? parsed.rotationIntervalSeconds
          : DEFAULT_TV_PREFERENCES.rotationIntervalSeconds,
      themeMode: parsed.themeMode === 'light' ? 'light' : 'dark',
      period: TV_PERIOD_OPTIONS.some((o) => o.id === parsed.period)
        ? (parsed.period as TvPeriodId)
        : DEFAULT_TV_PERIOD,
    }
  } catch {
    return DEFAULT_TV_PREFERENCES
  }
}

export function saveTvPreferences(prefs: TvModePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (err) {
    console.error('Erro ao salvar preferências do Modo TV:', err)
  }
}

/**
 * 1. Total de chamados por Fila com os status
 */
export async function fetchQueueTicketsSummary(
  period: TvPeriodId = DEFAULT_TV_PERIOD,
): Promise<QueueTicketsSummary[]> {
  const [queues, tickets] = await Promise.all([
    getQueues(),
    pb.collection('tickets').getFullList<TicketRecord>({
      filter: buildTvPeriodFilter(period),
      fields: 'id,number,queue,status,priority',
    }),
  ])

  const queueMap = new Map<string, QueueRecord>()
  queues.forEach((q) => queueMap.set(q.id, q))

  // Agrupa chamados por fila
  const groups = new Map<string, { total: number; byStatus: Record<string, number> }>()

  // Inicializa com filas ativas
  queues.forEach((q) => {
    groups.set(q.id, { total: 0, byStatus: {} })
  })

  // Fila sem atribuição
  groups.set('unassigned', { total: 0, byStatus: {} })

  tickets.forEach((t) => {
    const qId = t.queue && queueMap.has(t.queue) ? t.queue : 'unassigned'
    const entry = groups.get(qId) || { total: 0, byStatus: {} }
    entry.total += 1
    const st = t.status === 'Atribuído' ? 'Em aberto' : t.status || 'Novo'
    entry.byStatus[st] = (entry.byStatus[st] || 0) + 1
    groups.set(qId, entry)
  })

  const results: QueueTicketsSummary[] = []

  queues.forEach((q) => {
    const g = groups.get(q.id) || { total: 0, byStatus: {} }
    results.push({
      queue: q,
      total: g.total,
      byStatus: g.byStatus,
    })
  })

  const unassigned = groups.get('unassigned')
  if (unassigned && unassigned.total > 0) {
    results.push({
      queue: {
        id: 'unassigned',
        name: 'Sem Fila Definida',
        description: 'Chamados aguardando direcionamento para fila',
        active: true,
      },
      total: unassigned.total,
      byStatus: unassigned.byStatus,
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

/**
 * 2. Total de chamados por status (geral)
 */
export async function fetchTicketStatusSummary(
  period: TvPeriodId = DEFAULT_TV_PERIOD,
): Promise<TicketStatusSummary[]> {
  const tickets = await pb.collection('tickets').getFullList<TicketRecord>({
    filter: buildTvPeriodFilter(period),
    fields: 'id,status',
  })

  const countByStatus: Record<string, number> = {}
  tickets.forEach((t) => {
    const st = t.status === 'Atribuído' ? 'Em aberto' : t.status || 'Novo'
    countByStatus[st] = (countByStatus[st] || 0) + 1
  })

  const total = tickets.length || 1
  const order = [
    'Novo',
    'Em Atendimento',
    'Em Triagem',
    'Aguardando Atribuição',
    'Em aberto',
    'Aguardando Cliente',
    'Aguardando Aprovação',
    'Pendente',
    'Reaberto',
    'Resolvido',
    'Encerrado',
    'Cancelado',
  ]

  const presentStatuses = Object.keys(countByStatus)
  const sortedKeys = presentStatuses.sort((a, b) => {
    const idxA = order.indexOf(a)
    const idxB = order.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return countByStatus[b] - countByStatus[a]
  })

  return sortedKeys.map((status) => ({
    status,
    count: countByStatus[status],
    percentage: Math.round((countByStatus[status] / total) * 100),
  }))
}

/**
 * 3. Quem está online
 */
export interface OnlineUserItem {
  id: string
  name: string
  email: string
  profileName: string
  team?: string
  queues: string[]
  isOnline: boolean
  lastSeen?: string
  avatar?: string
}

export async function fetchOnlineUsers(): Promise<OnlineUserItem[]> {
  const [operators, queues] = await Promise.all([getOperators({ status: 'active' }), getQueues()])

  // Mapeia quais filas o operador pertence
  const userQueuesMap = new Map<string, string[]>()
  queues.forEach((q) => {
    if (Array.isArray(q.members)) {
      q.members.forEach((memberId) => {
        const list = userQueuesMap.get(memberId) || []
        list.push(q.name)
        userQueuesMap.set(memberId, list)
      })
    }
  })

  const now = Date.now()
  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutos

  return operators
    .map((op: OperatorItem) => {
      const profile = op.expand?.profile_id?.name || op.role || 'Operador'
      const lastActivity = op.session_last_activity || op.updated
      const lastActivityTime = lastActivity ? new Date(lastActivity).getTime() : 0
      const diff = now - lastActivityTime
      const isOnline = diff < ONLINE_THRESHOLD_MS

      return {
        id: op.id,
        name: op.name || `${op.first_name || ''} ${op.last_name || ''}`.trim() || op.email,
        email: op.email,
        profileName: profile,
        team: op.team,
        queues: userQueuesMap.get(op.id) || [],
        isOnline,
        lastSeen: lastActivity,
        avatar: op.avatar,
      }
    })
    .sort((a, b) => {
      // Online primeiro, depois por nome
      if (a.isOnline && !b.isOnline) return -1
      if (!a.isOnline && b.isOnline) return 1
      return a.name.localeCompare(b.name)
    })
}

/**
 * 4. Consumo de horas dos clientes
 */
export async function fetchClientHoursSummary(
  period: TvPeriodId = DEFAULT_TV_PERIOD,
): Promise<ClientHoursData[]> {
  // Sem período: comportamento original (mesmo do Dashboard de Horas).
  if (period === DEFAULT_TV_PERIOD) return await getClientHoursData()

  // Com período: horas contratadas = períodos ativos; consumidas =
  // interações com hora "Contratada" registradas dentro do intervalo.
  const start = getTvPeriodStartDate(period)
  const [companies, contracts, periods, tickets, interactions] = await Promise.all([
    getCompanies(),
    getContracts(),
    getContractPeriods(),
    pb.collection('tickets').getFullList<any>({ fields: 'id,company' }),
    pb
      .collection('ticket_interactions')
      .getFullList<any>({
        filter: `hour_type = "Contratada"${start ? ` && created >= "${start}"` : ''}`,
        fields: 'id,ticket,duration_minutes,created',
      })
      .catch(() => []),
  ])

  const contractCompanyMap = new Map<string, string>()
  contracts.forEach((c) => contractCompanyMap.set(c.id, c.company))

  const ticketCompanyMap = new Map<string, string>()
  tickets.forEach((t: any) => {
    if (t.company) ticketCompanyMap.set(t.id, t.company)
  })

  const companyMap = new Map<string, { contractedSec: number; consumedSec: number }>()

  periods.forEach((p) => {
    if (p.status !== 'Ativo') return
    const companyId = contractCompanyMap.get(p.contract)
    if (!companyId) return
    const entry = companyMap.get(companyId) || { contractedSec: 0, consumedSec: 0 }
    entry.contractedSec += parseDurationToSeconds(p.contracted_hours) ?? 0
    companyMap.set(companyId, entry)
  })

  interactions.forEach((i: any) => {
    const companyId = ticketCompanyMap.get(i.ticket)
    if (!companyId) return
    const entry = companyMap.get(companyId)
    if (!entry) return
    entry.consumedSec += Math.round((Number(i.duration_minutes) || 0) * 60)
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

/**
 * 5. Metas do Dashboard Gerencial
 */
export async function fetchExecutiveGoalsData(): Promise<TvMetasData> {
  const [tickets, contracts, periods, visits, technicalVisits, interactions] = await Promise.all([
    pb.collection('tickets').getFullList<TicketRecord>({
      expand: 'company,assigned_to',
    }),
    pb.collection('contracts').getFullList<any>({ filter: 'status = "Ativo"' }),
    pb.collection('contract_periods').getFullList<any>({ filter: 'status = "Ativo"' }),
    pb
      .collection('visits')
      .getFullList<any>()
      .catch(() => []),
    pb
      .collection('technical_visits')
      .getFullList<any>()
      .catch(() => []),
    pb
      .collection('ticket_interactions')
      .getFullList<any>({
        fields: 'id,ticket,duration_minutes,created',
      })
      .catch(() => []),
  ])

  const allVisits = [...visits, ...technicalVisits]

  const dashboardData: DashboardData = {
    tickets,
    visits: allVisits as any,
    contracts: contracts as any,
    periods: periods as any,
    users: [],
    categories: [],
    queues: [],
    interactions: interactions as any,
    companies: [],
    units: [],
  }

  const kpis = computeKpis(dashboardData)
  const slaByPriority = computeSlaByPriority(tickets)

  return {
    kpis,
    slaByPriority,
  }
}

/**
 * 6. Mudanças: abertas, em andamento, fechadas
 */
export async function fetchChangesSummary(
  period: TvPeriodId = DEFAULT_TV_PERIOD,
): Promise<ChangesSummary> {
  const changes = await getChanges(buildTvPeriodFilter(period))
  const byStatus: Record<string, number> = {}

  let open = 0
  let inProgress = 0
  let closed = 0

  changes.forEach((c: ChangeRecord) => {
    const st = c.status || 'Solicitada'
    byStatus[st] = (byStatus[st] || 0) + 1

    if (['Concluída', 'Cancelada', 'Recusada'].includes(st)) {
      closed += 1
    } else if (['Em Execução', 'Em Validação', 'Agendada', 'Em Planejamento'].includes(st)) {
      inProgress += 1
    } else {
      // Rascunho, Solicitada, Em Avaliação, Aguardando Aprovação, Aprovada, Reaberta
      open += 1
    }
  })

  return {
    open,
    inProgress,
    closed,
    total: changes.length,
    byStatus,
  }
}

/**
 * 7. Problemas: abertos, em teste de efetividade, concluídos
 */
export async function fetchProblemsSummary(
  period: TvPeriodId = DEFAULT_TV_PERIOD,
): Promise<ProblemsSummary> {
  const problems = await getProblems(buildTvPeriodFilter(period))
  const byStatus: Record<string, number> = {}

  let open = 0
  let inEffectiveness = 0
  let completed = 0

  problems.forEach((p: ProblemRecord) => {
    const st = p.status || 'Novo'
    byStatus[st] = (byStatus[st] || 0) + 1

    if (['Encerrado'].includes(st)) {
      completed += 1
    } else if (
      [
        'Em Análise de Efetividade',
        'Análise de Efetividade Pendente',
        'Avaliação Realizada',
        'Solução de Contorno Implantada',
      ].includes(st)
    ) {
      inEffectiveness += 1
    } else {
      // Novo, Em Investigação, Causa Identificada, Solução de Contorno Planejada, Reaberto, Plano de Solução Definitiva
      open += 1
    }
  })

  return {
    open,
    inEffectiveness,
    completed,
    total: problems.length,
    byStatus,
  }
}
