import pb from '@/lib/pocketbase/client'

export interface TicketRecord {
  id: string
  number: string
  company: string
  unit?: string
  department?: string
  requester_name: string
  requester_email?: string
  requester_phone?: string
  contract?: string
  type: string
  category?: string
  subcategory?: string
  service?: string
  equipment?: string
  title: string
  description: string
  source?: string
  impact: string
  urgency: string
  priority: string
  status: string
  queue?: string
  assigned_to?: string
  sla_response_deadline?: string
  sla_solution_deadline?: string
  sla_response_at?: string
  sla_response_start?: string
  sla_solution_at?: string
  resolution_date?: string
  sla_status?: string
  sla_paused?: boolean
  work_hours?: number
  billable_hours?: number
  solution?: string
  parent_ticket_id?: string
  created: string
  updated: string
  expand?: any
}

// Status considerados "encerrados" — não bloqueiam o fechamento do ticket pai.
export const CHILD_CLOSED_STATUSES = ['Resolvido', 'Cancelado', 'Encerrado']

/** Busca todos os tickets filhos de um ticket pai. */
export const getChildTickets = (parentId: string) =>
  pb.collection('tickets').getFullList<TicketRecord>({
    filter: `parent_ticket_id = "${parentId}"`,
    sort: 'created',
    expand: 'company,contract,assigned_to',
  })

/** Busca um único ticket filho (pai) já com expand do pai. */
export const getParentTicket = (parentId: string) =>
  pb.collection('tickets').getOne<TicketRecord>(parentId, {
    expand: 'company,contract,assigned_to',
  })

export const getTickets = (filter?: string, sort: string = '-created') =>
  pb.collection('tickets').getFullList<TicketRecord>({
    filter,
    sort,
    expand: 'company,category,subcategory,assigned_to,queue,contract,equipment,parent_ticket_id',
  })

export const getTicket = (id: string) =>
  pb.collection('tickets').getOne<TicketRecord>(id, {
    expand:
      'company,unit,department,contract,contract.company,category,subcategory,equipment,queue,assigned_to,closed_by,parent_ticket_id',
  })

export const createTicket = (data: Partial<TicketRecord>) =>
  pb.collection('tickets').create<TicketRecord>(data)

export const updateTicket = (id: string, data: Partial<TicketRecord>) =>
  pb.collection('tickets').update<TicketRecord>(id, data)

export const deleteTicket = (id: string) => pb.collection('tickets').delete(id)

export const delegateTicket = (
  ticketId: string,
  type: 'technician' | 'queue',
  targetId: string,
  reason?: string,
) =>
  pb.send(`/backend/v1/tickets/${ticketId}/delegate`, {
    method: 'POST',
    body: JSON.stringify({ type, target_id: targetId, reason: reason || '' }),
    headers: { 'Content-Type': 'application/json' },
  })

export const batchDelegateTickets = (
  ticketIds: string[],
  type: 'technician' | 'queue',
  targetId: string,
  reason?: string,
) =>
  pb.send(`/backend/v1/tickets/batch-delegate`, {
    method: 'POST',
    body: JSON.stringify({
      ticket_ids: ticketIds,
      type,
      target_id: targetId,
      reason: reason || '',
    }),
    headers: { 'Content-Type': 'application/json' },
  })

export const startService = (id: string) =>
  pb.send(`/backend/v1/tickets/${id}/start`, { method: 'POST' })

export const getTicketInteractions = (ticketId: string) =>
  pb.collection('ticket_interactions').getFullList({
    filter: `ticket = "${ticketId}"`,
    sort: 'created',
    expand: 'author',
  })

export const createInteraction = (data: {
  ticket: string
  author: string
  type: string
  content: string
  duration_minutes?: number
  hour_type?: string
  billing_status?: string
  origin?: string
  template?: string
}) => pb.collection('ticket_interactions').create(data)

export const getTicketHistory = (ticketId: string) =>
  pb.collection('ticket_history').getFullList({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'user',
  })

export const createSlaPause = (data: {
  ticket: string
  reason: string
  justification: string
  paused_by: string
  paused_at: string
}) => pb.collection('sla_pauses').create(data)

export const getSlaPauses = (ticketId: string) =>
  pb.collection('sla_pauses').getFullList({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'paused_by,resumed_by',
  })
