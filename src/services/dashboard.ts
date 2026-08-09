import pb from '@/lib/pocketbase/client'
import { getTickets, TicketRecord } from '@/services/tickets'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getContracts, ContractRecord } from '@/services/contracts'
import { getContractPeriods, ContractPeriodRecord } from '@/services/contract-periods'
import { getUsers, UserItem } from '@/services/users'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getQueues, QueueRecord } from '@/services/queues'
import { getOperatorInteractions, TicketInteractionRecord } from '@/services/ticket-interactions'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getAllCompanyUnits, CompanyUnitRecord } from '@/services/company-units'

export interface DashboardFilterState {
  startDate: string
  endDate: string
  companyId: string
  contractId: string
  operatorId: string
  queueId: string
  priority: string
  categoryId: string
  status: string
  ticketType: string
  technicianId: string
  region: string
}

export const DEFAULT_FILTERS: DashboardFilterState = {
  startDate: '',
  endDate: '',
  companyId: 'all',
  contractId: 'all',
  operatorId: 'all',
  queueId: 'all',
  priority: 'all',
  categoryId: 'all',
  status: 'all',
  ticketType: 'all',
  technicianId: 'all',
  region: 'all',
}

export const TICKET_TYPES = [
  'Incidente',
  'Requisição de Serviço',
  'Problema',
  'Mudança',
  'Projeto',
  'Tarefa Interna',
  'Visita Técnica',
  'Dúvida',
]

export const TICKET_STATUSES = [
  'Novo',
  'Em Triagem',
  'Aguardando Atribuição',
  'Atribuído',
  'Em Atendimento',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Agendado',
  'Escalonado',
  'Resolvido',
  'Aguardando Validação',
  'Encerrado',
  'Cancelado',
  'Reaberto',
]

export const PRIORITIES = ['Crítica', 'Alta', 'Média', 'Baixa']

export interface DashboardData {
  tickets: TicketRecord[]
  visits: TechnicalVisitRecord[]
  contracts: ContractRecord[]
  periods: ContractPeriodRecord[]
  users: UserItem[]
  categories: CategoryRecord[]
  queues: QueueRecord[]
  interactions: TicketInteractionRecord[]
  companies: CompanyRecord[]
  units: CompanyUnitRecord[]
}

export interface FilterOptions {
  companies: CompanyRecord[]
  contracts: ContractRecord[]
  users: UserItem[]
  categories: CategoryRecord[]
  queues: QueueRecord[]
  units: CompanyUnitRecord[]
}

function buildTicketFilter(f: DashboardFilterState): string | undefined {
  const parts: string[] = []
  if (f.startDate) parts.push(`created >= "${f.startDate} 00:00:00"`)
  if (f.endDate) parts.push(`created <= "${f.endDate} 23:59:59"`)
  if (f.companyId !== 'all') parts.push(`company = "${f.companyId}"`)
  if (f.contractId !== 'all') parts.push(`contract = "${f.contractId}"`)
  if (f.operatorId !== 'all') parts.push(`assigned_to = "${f.operatorId}"`)
  if (f.queueId !== 'all') parts.push(`queue = "${f.queueId}"`)
  if (f.priority !== 'all') parts.push(`priority = "${f.priority}"`)
  if (f.categoryId !== 'all') parts.push(`category = "${f.categoryId}"`)
  if (f.status !== 'all') parts.push(`status = "${f.status}"`)
  if (f.ticketType !== 'all') parts.push(`type = "${f.ticketType}"`)
  if (f.region !== 'all') parts.push(`unit = "${f.region}"`)
  return parts.length > 0 ? parts.join(' && ') : undefined
}

function buildVisitFilter(f: DashboardFilterState): string | undefined {
  const parts: string[] = []
  if (f.startDate) parts.push(`scheduled_date >= "${f.startDate}"`)
  if (f.endDate) parts.push(`scheduled_date <= "${f.endDate}"`)
  if (f.technicianId !== 'all') parts.push(`technician = "${f.technicianId}"`)
  return parts.length > 0 ? parts.join(' && ') : undefined
}

export async function loadDashboardData(filters: DashboardFilterState): Promise<DashboardData> {
  const ticketFilter = buildTicketFilter(filters)
  const visitFilter = buildVisitFilter(filters)

  const contractFilter =
    filters.companyId !== 'all' ? `company = "${filters.companyId}"` : undefined
  const periodFilter =
    filters.contractId !== 'all' ? `contract = "${filters.contractId}"` : undefined

  const [tickets, visits, contracts, periods, users, categories, queues, companies, units] =
    await Promise.all([
      getTickets(ticketFilter),
      getVisits(visitFilter),
      getContracts(contractFilter),
      getContractPeriods(periodFilter),
      getUsers(),
      getCategories(),
      getQueues(),
      getCompanies(),
      getAllCompanyUnits(),
    ])

  const interactions = await getOperatorInteractions(
    filters.operatorId !== 'all' ? filters.operatorId : undefined,
    filters.startDate ? `${filters.startDate} 00:00:00` : undefined,
    filters.endDate ? `${filters.endDate} 23:59:59` : undefined,
  )

  return {
    tickets,
    visits,
    contracts,
    periods,
    users,
    categories,
    queues,
    interactions,
    companies,
    units,
  }
}

export async function loadFilterOptions(): Promise<FilterOptions> {
  const [companies, contracts, users, categories, queues, units] = await Promise.all([
    getCompanies(),
    getContracts(),
    getUsers(),
    getCategories(),
    getQueues(),
    getAllCompanyUnits(),
  ])
  return { companies, contracts, users, categories, queues, units }
}
