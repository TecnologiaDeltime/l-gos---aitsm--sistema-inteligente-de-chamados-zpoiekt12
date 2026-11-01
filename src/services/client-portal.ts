import pb from '@/lib/pocketbase/client'
import { TicketRecord } from '@/services/tickets'
import { ApprovalRecord } from '@/services/approvals'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import { TechnicalVisitRecord } from '@/services/technical-visits'
import { ContractPeriodRecord } from '@/services/contract-periods'
import { CategoryRecord } from '@/services/categories'

export interface AssetMaintenanceItem {
  id: string
  number: string
  title: string
  type?: string
  status: string
  created: string
  updated?: string
  resolution_date?: string
  solution?: string
  description?: string
  lastPublicInteraction?: string
  lastInteractionDate?: string
  assignedToName?: string
  categoryName?: string
}

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
 * Reabre um chamado que estava Resolvido, voltando-o para a fila ('Em Atendimento' ou 'Reaberto'),
 * registrando o motivo na timeline como log público e no histórico do ticket.
 */
export async function reopenTicketFromPortal(params: {
  ticketId: string
  reason: string
  userId?: string
}): Promise<TicketRecord> {
  const trimmedReason = params.reason.trim()
  if (!trimmedReason) {
    throw new Error('O motivo da reabertura é obrigatório.')
  }

  const nowIso = new Date().toISOString()
  const authorId = params.userId || pb.authStore.record?.id || (pb.authStore.model as any)?.id

  // 1. Atualiza status do chamado para Reaberto (ou Em Atendimento)
  // O hook on_ticket_resolve_consume_hours reage ao status 'Reaberto' para limpar timestamps
  // de resolução e recalcular/retomar a contagem do SLA de solução.
  const updatedTicket = await pb.collection('tickets').update<TicketRecord>(params.ticketId, {
    status: 'Reaberto',
    sla_solution_at: null,
    resolution_date: null,
    closure_date: null,
    sla_paused: false,
  })

  // 2. Registra o motivo como log PÚBLICO na timeline para que o cliente e a equipe vejam
  if (authorId) {
    try {
      await pb.collection('ticket_interactions').create({
        ticket: params.ticketId,
        author: authorId,
        type: 'Público',
        content: `Chamado Reaberto pelo Cliente.\nMotivo da Reabertura: ${trimmedReason}`,
        origin: 'Manual',
      })
    } catch (interErr) {
      console.warn('Erro ao criar interação pública de reabertura:', interErr)
    }
  }

  // 3. Registra no histórico do ticket (auditoria)
  try {
    await pb.collection('ticket_history').create({
      ticket: params.ticketId,
      user: authorId || undefined,
      action: 'Reabertura pelo Portal do Cliente',
      field: 'status',
      old_value: 'Resolvido',
      new_value: `Reaberto — Motivo: ${trimmedReason}`,
    })
  } catch (histErr) {
    console.warn('Erro ao criar histórico de reabertura:', histErr)
  }

  return updatedTicket
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
 * Busca o histórico de manutenção (chamados e atendimentos vinculados) de um ativo específico.
 * Filtra estritamente pela empresa (respeitando o modo suporte do administrador) e pelo configuration_item.
 * Ordena do mais recente para o mais antigo (-created).
 * Para cada chamado, carrega a última interação pública / resumo do atendimento.
 */
export async function getAssetMaintenanceHistory(
  assetId: string,
  companyId?: string,
): Promise<AssetMaintenanceItem[]> {
  if (!assetId) return []

  const filterParts = [`configuration_item = "${assetId}"`]
  if (companyId) {
    filterParts.push(`company = "${companyId}"`)
  }

  const tickets = await pb.collection('tickets').getFullList<TicketRecord>({
    filter: filterParts.join(' && '),
    sort: '-created',
    expand: 'category,subcategory,assigned_to',
  })

  if (tickets.length === 0) {
    return []
  }

  // Para enriquecer com a última interação pública (ou solução/descrição),
  // buscamos as interações públicas dos chamados retornados
  const ticketIds = tickets.map((t) => t.id)
  let publicInteractions: PublicLogRecord[] = []
  try {
    // PocketBase aceita filtros com OR ou buscamos com lote
    // Ex: ticket = "id1" || ticket = "id2"
    const interactionFilter = ticketIds.map((id) => `ticket = "${id}"`).join(' || ')
    publicInteractions = await pb.collection('ticket_interactions').getFullList<PublicLogRecord>({
      filter: `(${interactionFilter}) && type != "Interno"`,
      sort: '-created',
      expand: 'author',
    })
  } catch (err) {
    console.warn('Erro ao carregar interações públicas do histórico do ativo:', err)
  }

  // Agrupa a última interação pública por ticket
  const latestInteractionByTicket = new Map<string, PublicLogRecord>()
  for (const inter of publicInteractions) {
    if (!latestInteractionByTicket.has(inter.ticket)) {
      latestInteractionByTicket.set(inter.ticket, inter)
    }
  }

  return tickets.map((t) => {
    const lastInter = latestInteractionByTicket.get(t.id)
    const assignedUser = t.expand?.assigned_to as any
    const cat = t.expand?.category as any

    return {
      id: t.id,
      number: t.number || 'Chamado',
      title: t.title || 'Sem título',
      type: t.type,
      status: t.status,
      created: t.created,
      updated: t.updated,
      resolution_date: t.resolution_date,
      solution: t.solution,
      description: t.description,
      lastPublicInteraction: lastInter?.content,
      lastInteractionDate: lastInter?.created,
      assignedToName: assignedUser?.name,
      categoryName: cat?.name,
    }
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

export async function getClientPortalData(
  user: any,
  overrideCompanyId?: string,
): Promise<PortalData> {
  let companyId = overrideCompanyId || user?.company

  // Se o usuário não tiver companyId diretamente (ex: admin visualizando o portal sem empresa selecionada),
  // tenta pegar a primeira empresa cadastrada
  if (!companyId) {
    try {
      const companies = await pb
        .collection('companies')
        .getList(1, 1, { filter: 'status = "Ativo"', sort: 'trade_name' })
      if (companies.items.length > 0) {
        companyId = companies.items[0].id
      } else {
        const anyCompanies = await pb.collection('companies').getList(1, 1, { sort: '-created' })
        if (anyCompanies.items.length > 0) {
          companyId = anyCompanies.items[0].id
        }
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

  // Busca dados em paralelo amarrados à empresa selecionada
  const [tickets, approvals, configurationItems, technicalVisits, categories] = await Promise.all([
    companyId ? getClientPortalTickets(companyId) : Promise.resolve([]),
    companyId ? getClientPortalApprovals(companyId) : Promise.resolve([]),
    companyId ? getClientPortalAssets(companyId) : Promise.resolve([]),
    companyId ? getClientPortalVisits(companyId) : Promise.resolve([]),
    pb
      .collection('tkt_categories')
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
