import pb from '@/lib/pocketbase/client'

export interface TicketInteractionRecord {
  id: string
  ticket: string
  author: string
  type: string
  content: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  hour_type?: string
  billing_status?: string
  origin?: string
  approved?: boolean
  approved_by?: string
  justification?: string
  created: string
  expand?: any
}

export const HOUR_TYPES = [
  'Contratada',
  'Excedente',
  'Projeto',
  'Interna',
  'Não Faturável',
  'Cortesia',
  'Deslocamento',
  'Plantão',
  'Gestão',
  'Treinamento',
]

export const BILLING_STATUSES = ['Faturável', 'Não Faturável', 'Pendente']

export const INTERACTION_ORIGINS = ['Cronômetro', 'Manual', 'Automático']

export const getInteractions = (ticketId: string) =>
  pb.collection('ticket_interactions').getFullList<TicketInteractionRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: 'created',
    expand: 'author,approved_by',
  })

export const getOperatorInteractions = (
  operatorId?: string,
  startDate?: string,
  endDate?: string,
) => {
  const filters: string[] = []
  if (operatorId) filters.push(`author = "${operatorId}"`)
  if (startDate) filters.push(`created >= "${startDate}"`)
  if (endDate) filters.push(`created <= "${endDate}"`)
  return pb.collection('ticket_interactions').getFullList<TicketInteractionRecord>({
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    sort: '-created',
    expand: 'ticket,ticket.company',
  })
}

export const createInteraction = (data: Partial<TicketInteractionRecord>) =>
  pb.collection('ticket_interactions').create<TicketInteractionRecord>(data)

export const updateInteraction = (id: string, data: Partial<TicketInteractionRecord>) =>
  pb.collection('ticket_interactions').update<TicketInteractionRecord>(id, data)
