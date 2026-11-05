import pb from '@/lib/pocketbase/client'
import { getQueues, type QueueRecord } from '@/services/queues'
import { getOperators } from '@/services/operators'
import { getClientHoursData, type ClientHoursData } from '@/services/client-hours'
import { getChanges, type ChangeRecord } from '@/services/changes'
import { getProblems, type ProblemRecord } from '@/services/problems'
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
}

const STORAGE_KEY = 'logos_aitilsm_tv_mode_prefs'

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
export async function fetchQueueTicketsSummary(): Promise<QueueTicketsSummary[]> {
  const [queues, tickets] = await Promise.all([
    getQueues(),
    pb.collection('tickets').getFullList<TicketRecord>({
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
export async function fetchTicketStatusSummary(): Promise<TicketStatusSummary[]> {
  const tickets = await pb.collection('tickets').getFullList<TicketRecord>({
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
export async function fetchClientHoursSummary(): Promise<ClientHoursData[]> {
  return await getClientHoursData()
}

/**
 * 5. Metas do Dashboard Gerencial
 */
export async function fetchExecutiveGoalsData(): Promise<TvMetasData> {
  const [tickets, contracts, periods, visits, technicalVisits] = await Promise.all([
    pb.collection('tickets').getFullList<TicketRecord>({
      expand: 'company,assigned_to',
    }),
    pb.collection('contracts').getFullList({ filter: 'status = "Ativo"' }),
    pb.collection('contract_periods').getFullList({ filter: 'status = "Ativo"' }),
    pb
      .collection('visits')
      .getFullList()
      .catch(() => []),
    pb
      .collection('technical_visits')
      .getFullList()
      .catch(() => []),
  ])

  const allVisits = [...visits, ...technicalVisits]

  const dashboardData: DashboardData = {
    tickets,
    visits: allVisits as any,
    contracts,
    periods,
    users: [],
    categories: [],
    queues: [],
    interactions: [],
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
export async function fetchChangesSummary(): Promise<ChangesSummary> {
  const changes = await getChanges()
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
export async function fetchProblemsSummary(): Promise<ProblemsSummary> {
  const problems = await getProblems()
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
