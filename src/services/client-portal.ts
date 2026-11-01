import pb from '@/lib/pocketbase/client'
import { TicketRecord } from '@/services/tickets'
import { ApprovalRecord } from '@/services/approvals'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import { TechnicalVisitRecord } from '@/services/technical-visits'
import { ContractPeriodRecord } from '@/services/contract-periods'
import { CategoryRecord } from '@/services/categories'

export interface PublicLogRecord {
  id: string
  ticket: string
  author: string
  type: string
  content: string
  created: string
  expand?: {
    author?: {
      name?: string
      email?: string
      role?: string
    }
  }
}

export interface ClientPortalAccessItem {
  company: {
    id: string
    name: string
    cnpj?: string
    email?: string
    hours_contracted?: number
  }
  portalUsers: Array<{
    id: string
    name: string
    email: string
    role: string
    status: string
    created: string
  }>
  contacts: Array<{
    id: string
    name: string
    email: string
    phone?: string
    role?: string
    isFocalPoint: boolean
  }>
}

/**
 * Busca chamados da empresa do cliente.
 * Se solicitante, também aceita ver os chamados da empresa (ou restrito a ela).
 */
export async function getClientPortalTickets(companyId: string): Promise<TicketRecord[]> {
  if (!companyId) return []
  return pb.collection('tickets').getFullList<TicketRecord>({
    filter: `company = "${companyId}"`,
    sort: '-created',
    expand: 'category,subcategory,assigned_to',
  })
}

/**
 * Busca os logs PÚBLICOS de um chamado (type != "Interno").
 * NUNCA retorna notas internas de operador.
 */
export async function getTicketPublicLogs(ticketId: string): Promise<PublicLogRecord[]> {
  if (!ticketId) return []
  return pb.collection('ticket_interactions').getFullList<PublicLogRecord>({
    filter: `ticket = "${ticketId}" && type != "Interno"`,
    sort: 'created',
    expand: 'author',
  })
}

/**
 * Adiciona um comentário/log PÚBLICO do cliente em um chamado.
 */
export async function addTicketPublicComment(ticketId: string, authorId: string, content: string) {
  return pb.collection('ticket_interactions').create({
    ticket: ticketId,
    author: authorId,
    type: 'Público',
    content,
    origin: 'Manual',
  })
}

/**
 * Busca aprovações da empresa do cliente.
 */
export async function getClientPortalApprovals(companyId: string): Promise<ApprovalRecord[]> {
  if (!companyId) return []
  return pb.collection('approvals').getFullList<ApprovalRecord>({
    filter: `ticket.company = "${companyId}"`,
    sort: '-created',
    expand:
      'ticket,ticket.category,ticket.subcategory,requester,approver,target_contact,approval_config',
  })
}

/**
 * Decide uma aprovação pelo portal do cliente (mesmo endpoint que a aprovação por e-mail usa).
 */
export async function decideClientApproval(
  token: string,
  decision: 'approved' | 'rejected',
  comment?: string,
) {
  return pb.send<{ success: boolean; status: string }>(`/backend/v1/approvals/${token}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Busca ativos e itens de configuração do CMDB da empresa do cliente.
 */
export async function getClientPortalAssets(companyId: string): Promise<ConfigurationItemRecord[]> {
  if (!companyId) return []
  return pb.collection('configuration_items').getFullList<ConfigurationItemRecord>({
    filter: `company = "${companyId}"`,
    sort: 'name',
    expand: 'unit',
  })
}

/**
 * Busca visitas técnicas agendadas para o cliente (com técnico expandido).
 */
export async function getClientPortalVisits(companyId: string): Promise<TechnicalVisitRecord[]> {
  if (!companyId) return []
  return pb.collection('technical_visits').getFullList<TechnicalVisitRecord>({
    filter: `ticket.company = "${companyId}"`,
    sort: '-scheduled_date',
    expand: 'ticket,technician,equipment',
  })
}

/**
 * Busca o período contratual e o consumo de horas do cliente.
 */
export interface PortalData {
  company: any | null
  tickets: TicketRecord[]
  approvals: ApprovalRecord[]
  configurationItems: ConfigurationItemRecord[]
  technicalVisits: TechnicalVisitRecord[]
  categories: CategoryRecord[]
}

export async function getClientPortalData(user: any): Promise<PortalData> {
  let companyId = user?.company

  // Se o usuário não tiver companyId diretamente (ex: admin visualizando o portal),
  // tenta pegar a primeira empresa cadastrada
  if (!companyId) {
    try {
      const companies = await pb.collection('companies').getList(1, 1, { sort: '-created' })
      if (companies.items.length > 0) {
        companyId = companies.items[0].id
      }
    } catch {
      /* ignore */
    }
  }

  let company: any = null
  if (companyId) {
    try {
      company = await pb.collection('companies').getOne(companyId)
    } catch {
      /* ignore */
    }
  }

  // Busca dados em paralelo
  const [tickets, approvals, configurationItems, technicalVisits, categories] = await Promise.all([
    companyId ? getClientPortalTickets(companyId) : Promise.resolve([]),
    companyId ? getClientPortalApprovals(companyId) : Promise.resolve([]),
    companyId ? getClientPortalAssets(companyId) : Promise.resolve([]),
    companyId ? getClientPortalVisits(companyId) : Promise.resolve([]),
    pb
      .collection('categories')
      .getFullList<CategoryRecord>({ sort: 'name' })
      .catch(() => []),
  ])

  return {
    company,
    tickets,
    approvals,
    configurationItems,
    technicalVisits,
    categories,
  }
}

export const getClientHoursBalance = getClientPortalHours

export async function getClientPortalHours(companyId: string, month: number, year: number) {
  if (!companyId) {
    return {
      contractedHours: 0,
      consumedHours: 0,
      balanceHours: 0,
      percentUsed: 0,
      periodName: '',
      hasContract: false,
    }
  }

  // 1. Tenta buscar período em contract_periods
  const startIso = new Date(year, month - 1, 1).toISOString()
  const endIso = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

  let periodRecord: ContractPeriodRecord | null = null
  let contracted = 0

  try {
    // Busca períodos associados aos contratos da empresa
    const periods = await pb.collection('contract_periods').getFullList<ContractPeriodRecord>({
      filter: `contract.company = "${companyId}"`,
      sort: '-created',
      expand: 'contract',
    })

    // Filtra pelo mês e ano desejado
    const match = periods.find((p) => {
      if (!p.period_start) return false
      const d = new Date(p.period_start)
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month
    })

    if (match) {
      periodRecord = match
      contracted = Number(match.contracted_hours || 0)
    }
  } catch {
    /* intentionally ignored */
  }

  // 2. Se não encontrou período, busca no contrato ativo da empresa (monthly_hours)
  if (!contracted) {
    try {
      const contracts = await pb.collection('contracts').getFullList({
        filter: `company = "${companyId}" && status = "Ativo"`,
        sort: '-created',
      })
      if (contracts.length > 0) {
        contracted = Number(contracts[0].monthly_hours || 0)
      }
    } catch {
      /* intentionally ignored */
    }
  }

  // 3. Calcula as horas consumidas no período (ticket_interactions de tickets da empresa)
  let consumedMinutes = 0
  try {
    // Interações faturáveis de chamados da empresa criadas no período
    const interactions = await pb.collection('ticket_interactions').getFullList({
      filter: `ticket.company = "${companyId}" && created >= "${startIso}" && created <= "${endIso}"`,
      fields: 'duration_minutes,hour_type,billing_status',
    })

    consumedMinutes = interactions.reduce((sum, item: any) => {
      // Ignora não faturáveis se marcado expressamente
      if (
        item.billing_status === 'Não Faturável' ||
        item.hour_type === 'Não Faturável' ||
        item.hour_type === 'Cortesia'
      ) {
        return sum
      }
      return sum + Number(item.duration_minutes || 0)
    }, 0)
  } catch {
    /* intentionally ignored */
  }

  const consumedHours = Math.round((consumedMinutes / 60) * 10) / 10
  const balanceHours = Math.round((contracted - consumedHours) * 10) / 10
  const percentUsed =
    contracted > 0 ? Math.min(100, Math.round((consumedHours / contracted) * 100)) : 0

  return {
    contractedHours: contracted,
    consumedHours,
    balanceHours,
    percentUsed,
    periodName: `${String(month).padStart(2, '0')}/${year}`,
    hasContract: contracted > 0 || !!periodRecord,
  }
}

/**
 * Endpoints administrativos de gestão de acessos do Portal do Cliente.
 */
export async function getClientPortalAccessManagement(): Promise<ClientPortalAccessItem[]> {
  const resp = await pb.send<{ clients: ClientPortalAccessItem[] }>(
    '/backend/v1/portal/clients-access',
    {
      method: 'GET',
    },
  )
  return resp.clients || []
}

export async function generatePortalUser(data: {
  companyId: string
  email?: string
  name?: string
  role?: 'cliente_gestor' | 'cliente_solicitante'
  password?: string
}) {
  return pb.send<{ success: boolean; message: string; user?: any }>(
    '/backend/v1/portal/generate-user',
    {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export async function resetPortalUserPassword(userId: string, newPassword?: string) {
  return pb.send<{ success: boolean; message: string }>('/backend/v1/portal/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, newPassword: newPassword || 'Cliente@123' }),
    headers: { 'Content-Type': 'application/json' },
  })
}
