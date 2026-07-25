import pb from '@/lib/pocketbase/client'

export interface TechnicalVisitRecord {
  id: string
  ticket: string
  equipment?: string
  technician?: string
  client_address?: string
  scheduled_date?: string
  scheduled_time?: string
  checkin_at?: string
  checkout_at?: string
  checkin_location?: string
  checkout_location?: string
  materials?: string
  distance_km?: number
  status: string
  notes?: string
  created: string
  updated: string
  expand?: any
}

export const VISIT_STATUSES = ['Agendada', 'Em Andamento', 'Concluída', 'Cancelada']

export const getVisits = (filter?: string) =>
  pb.collection('technical_visits').getFullList<TechnicalVisitRecord>({
    filter,
    sort: '-created',
    expand: 'ticket,technician,equipment',
  })

export const getVisit = (id: string) =>
  pb.collection('technical_visits').getOne<TechnicalVisitRecord>(id, {
    expand: 'ticket,technician,equipment',
  })

export const createVisit = (data: Partial<TechnicalVisitRecord>) =>
  pb.collection('technical_visits').create<TechnicalVisitRecord>(data)

export const updateVisit = (id: string, data: Partial<TechnicalVisitRecord>) =>
  pb.collection('technical_visits').update<TechnicalVisitRecord>(id, data)

export const getTicketVisits = (ticketId: string) =>
  pb.collection('technical_visits').getFullList<TechnicalVisitRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'technician',
  })
