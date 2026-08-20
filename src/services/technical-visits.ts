import pb from '@/lib/pocketbase/client'

export interface TechnicalVisitRecord {
  id: string
  ticket: string
  client?: string
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
  visit_reason?: string
  appointment_type?: string
  priority?: string
  expected_end_time?: string
  estimated_duration?: number
  scheduling_responsible?: string
  client_contact?: string
  contact_phone?: string
  required_resources?: string
  required_equipment?: string
  team?: string
  region?: string
  checkin_lat?: string
  checkin_lon?: string
  checkin_photo?: string[]
  checkin_distance?: number
  checkin_justification?: string
  checkout_lat?: string
  checkout_lon?: string
  checkout_photo?: string[]
  initial_odometer?: number
  final_odometer?: number
  calculated_mileage?: number
  travel_time_in?: number
  waiting_time?: number
  service_time?: number
  break_time?: number
  travel_time_out?: number
  total_time?: number
  time_classification?: string
  result?: string
  pending_items?: string
  return_needed?: boolean
  activities_performed?: string
  parts_used?: string
  evidence_photos?: string[]
  cancellation_reason?: string
  cancellation_responsible?: string
  cancellation_date?: string
  cancellation_observation?: string
  reschedule_history?: any
  unsuccessful_attempt?: boolean
  transport_mode?: string
  vehicle_plate?: string
  tolls?: number
  parking?: number
  fuel?: number
  other_costs?: number
  reimbursement_status?: string
  reimbursement_amount?: number
  approved_amount?: number
  paid_amount?: number
  rejection_reason?: string
  service_order_generated?: boolean
  signature_captured?: boolean
  technician_status?: string
  created: string
  updated: string
  expand?: any
}

export const VISIT_STATUSES = ['Agendada', 'Em Andamento', 'Concluída', 'Cancelada']

export const APPOINTMENT_TYPES = [
  'Visita Técnica',
  'Serviço Remoto',
  'Reunião',
  'Instalação',
  'Manutenção Preventiva',
  'Manutenção Corretiva',
  'Implantação',
  'Levantamento Técnico',
  'Retirada de Equipamento',
  'Entrega de Equipamento',
  'Treinamento',
  'Inspeção',
  'Plantão',
  'Atividade Interna',
  'Deslocamento',
  'Pausa',
  'Bloqueio de Agenda',
]

export const TECHNICIAN_STATUSES = [
  'Disponível',
  'Em Deslocamento',
  'Em Serviço Remoto',
  'Em Serviço Presencial',
  'Em Pausa',
  'Em Reunião',
  'Indisponível',
  'Fora do Horário',
  'Em Treinamento',
  'Em Plantão',
  'Finalizando Serviço',
  'Aguardando Cliente',
]

export const CANCELLATION_REASONS = [
  'Cliente Indisponível',
  'Técnico Indisponível',
  'Falta de Aprovação',
  'Falta de Material',
  'Problema Resolvido Remotamente',
  'Condição Climática',
  'Bloqueio Contratual',
  'Outro',
]

export const TRANSPORT_MODES = [
  'Veículo Próprio',
  'Veículo da Empresa',
  'Moto',
  'Transporte Público',
  'Táxi',
  'Aplicativo de Transporte',
  'Avião',
  'Busca Intercity',
  'A Pé',
  'Outro',
]

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

export const checkinVisit = (
  id: string,
  data: { lat?: string; lon?: string; radius?: number; justification?: string },
) =>
  pb.send(`/backend/v1/visits/${id}/checkin`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const checkoutVisit = (id: string, data: Record<string, any>) =>
  pb.send(`/backend/v1/visits/${id}/checkout`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const generateServiceOrder = (id: string) =>
  pb.send(`/backend/v1/visits/${id}/service-order`, { method: 'POST' })
