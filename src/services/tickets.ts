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
  sla_solution_at?: string
  resolution_date?: string
  sla_status?: string
  sla_paused?: boolean
  work_hours?: number
  billable_hours?: number
  solution?: string
  created: string
  updated: string
  expand?: any
}

export const getTickets = (filter?: string, sort: string = '-created') =>
  pb.collection('tickets').getFullList<TicketRecord>({
    filter,
    sort,
    expand: 'company,category,assigned_to,queue,contract,equipment',
  })

export const getTicket = (id: string) =>
  pb.collection('tickets').getOne<TicketRecord>(id, {
    expand:
      'company,unit,department,contract,contract.company,category,subcategory,equipment,queue,assigned_to,closed_by',
  })

export const createTicket = (data: Partial<TicketRecord>) =>
  pb.collection('tickets').create<TicketRecord>(data)

export const updateTicket = (id: string, data: Partial<TicketRecord>) =>
  pb.collection('tickets').update<TicketRecord>(id, data)

export const deleteTicket = (id: string) => pb.collection('tickets').delete(id)

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
