import pb from '@/lib/pocketbase/client'

export interface VisitTimeEntryRecord {
  id: string
  visit: string
  ticket?: string
  technician: string
  time_type: string
  classification?: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  created: string
  updated: string
  expand?: any
}

export const TIME_TYPES = [
  'Deslocamento Ida',
  'Espera',
  'Atendimento',
  'Pausa',
  'Deslocamento Volta',
]
export const TIME_CLASSIFICATIONS = [
  'Faturável',
  'Não Faturável',
  'Consumível de Contrato',
  'Reembolsável',
  'Hora Extra',
  'Hora Interna',
]

export const getVisitTimeEntries = (visitId: string) =>
  pb.collection('visit_time_entries').getFullList<VisitTimeEntryRecord>({
    filter: `visit = "${visitId}"`,
    sort: 'created',
    expand: 'technician',
  })

export const createVisitTimeEntry = (data: Partial<VisitTimeEntryRecord>) =>
  pb.collection('visit_time_entries').create<VisitTimeEntryRecord>(data)

export const updateVisitTimeEntry = (id: string, data: Partial<VisitTimeEntryRecord>) =>
  pb.collection('visit_time_entries').update<VisitTimeEntryRecord>(id, data)

export const deleteVisitTimeEntry = (id: string) => pb.collection('visit_time_entries').delete(id)
