import pb from '@/lib/pocketbase/client'

export interface TechnicianLocationRecord {
  id: string
  technician: string
  lat?: string
  lon?: string
  status?: string
  current_ticket?: string
  current_client?: string
  updated_at_location?: string
  consent_given?: boolean
  purpose?: string
  created: string
  updated: string
  expand?: any
}

export interface KmRateRecord {
  id: string
  rate_per_km: number
  vehicle_type?: string
  technician?: string
  client?: string
  contract?: string
  min_distance?: number
  max_distance?: number
  effective_date?: string
  active?: boolean
  created: string
  updated: string
}

export interface VisitChecklistRecord {
  id: string
  visit?: string
  ticket?: string
  category?: string
  name: string
  all_required?: boolean
  created: string
  updated: string
  expand?: any
}

export interface VisitChecklistItemRecord {
  id: string
  checklist: string
  visit?: string
  description: string
  status: string
  required?: boolean
  photo_evidence?: string
  completed_at?: string
  order?: number
  created: string
  updated: string
}

export interface ServiceOrderRecord {
  id: string
  visit: string
  ticket?: string
  technician?: string
  client?: string
  unit?: string
  order_number: string
  pdf_file?: string
  content_json?: string
  generated_at?: string
  created: string
  updated: string
}

export interface ClientSignatureRecord {
  id: string
  visit: string
  ticket?: string
  signer_name: string
  signer_document?: string
  signature_image?: string
  signature_method?: string
  signed_at?: string
  ip_address?: string
  location?: string
  acceptance_statement?: string
  token?: string
  created: string
  updated: string
}

export interface RecurringVisitTemplateRecord {
  id: string
  frequency: string
  technician?: string
  client?: string
  unit?: string
  ticket?: string
  day_of_week?: number
  day_of_month?: number
  scheduled_time?: string
  estimated_duration?: number
  visit_reason?: string
  appointment_type?: string
  active?: boolean
  next_run?: string
  created: string
  updated: string
}

export interface TechnicianAvailabilityRecord {
  id: string
  technician: string
  expand?: any
  date?: string
  shift_start?: string
  shift_end?: string
  lunch_start?: string
  lunch_end?: string
  day_off?: boolean
  vacation?: boolean
  on_duty?: boolean
  region?: string
  specialty?: string
  status?: string
  created: string
  updated: string
}

export const RECURRING_FREQUENCIES = [
  'Diário',
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Personalizado',
]

export const getTechnicianLocations = () =>
  pb.collection('technician_locations').getFullList<TechnicianLocationRecord>({
    expand: 'technician,current_ticket,current_client',
  })

export const updateTechnicianLocation = (id: string, data: Partial<TechnicianLocationRecord>) =>
  pb.collection('technician_locations').update<TechnicianLocationRecord>(id, data)

export const getKmRates = () =>
  pb.collection('km_rates').getFullList<KmRateRecord>({ sort: '-effective_date' })

export const createKmRate = (data: Partial<KmRateRecord>) =>
  pb.collection('km_rates').create<KmRateRecord>(data)

export const updateKmRate = (id: string, data: Partial<KmRateRecord>) =>
  pb.collection('km_rates').update<KmRateRecord>(id, data)

export const getVisitChecklists = (visitId?: string) =>
  pb.collection('visit_checklists').getFullList<VisitChecklistRecord>({
    filter: visitId ? `visit = "${visitId}"` : undefined,
    expand: 'category',
  })

export const getChecklistItems = (checklistId: string) =>
  pb.collection('visit_checklist_items').getFullList<VisitChecklistItemRecord>({
    filter: `checklist = "${checklistId}"`,
    sort: 'order',
  })

export const getVisitChecklistItems = (visitId: string) =>
  pb.collection('visit_checklist_items').getFullList<VisitChecklistItemRecord>({
    filter: `visit = "${visitId}"`,
    sort: 'order',
  })

export const updateChecklistItem = (id: string, data: Partial<VisitChecklistItemRecord>) =>
  pb.collection('visit_checklist_items').update<VisitChecklistItemRecord>(id, data)

export const getServiceOrders = (filter?: string) =>
  pb.collection('service_orders').getFullList<ServiceOrderRecord>({
    filter,
    sort: '-created',
    expand: 'visit,ticket,technician,client',
  })

export const getClientSignatures = (visitId: string) =>
  pb.collection('client_signatures').getFullList<ClientSignatureRecord>({
    filter: `visit = "${visitId}"`,
  })

export const createClientSignature = (data: Partial<ClientSignatureRecord>) =>
  pb.collection('client_signatures').create<ClientSignatureRecord>(data)

export const getRecurringTemplates = () =>
  pb.collection('recurring_visit_templates').getFullList<RecurringVisitTemplateRecord>({
    sort: '-created',
    expand: 'technician,client,unit',
  })

export const createRecurringTemplate = (data: Partial<RecurringVisitTemplateRecord>) =>
  pb.collection('recurring_visit_templates').create<RecurringVisitTemplateRecord>(data)

export const getTechnicianAvailability = (technicianId?: string, date?: string) => {
  const filters: string[] = []
  if (technicianId) filters.push(`technician = "${technicianId}"`)
  if (date) filters.push(`date = "${date}"`)
  return pb.collection('technician_availability').getFullList<TechnicianAvailabilityRecord>({
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    expand: 'technician',
  })
}
