import pb from '@/lib/pocketbase/client'

export interface TravelEntryRecord {
  id: string
  technician: string
  ticket?: string
  client?: string
  visit?: string
  origin_address?: string
  destination_address?: string
  travel_date?: string
  departure_time?: string
  arrival_time?: string
  estimated_distance?: number
  actual_distance?: number
  transport_mode?: string
  vehicle?: string
  license_plate?: string
  initial_odometer?: number
  final_odometer?: number
  odometer_start_photo?: string
  odometer_end_photo?: string
  tolls?: number
  parking?: number
  fuel?: number
  ride_sharing?: number
  other_costs?: number
  notes?: string
  divergence?: number
  divergence_justification?: string
  created: string
  updated: string
  expand?: any
}

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

export const getTravelEntries = (filter?: string) =>
  pb.collection('travel_entries').getFullList<TravelEntryRecord>({
    filter,
    sort: '-travel_date',
    expand: 'technician,ticket,client,visit',
  })

export const getTravelEntry = (id: string) =>
  pb
    .collection('travel_entries')
    .getOne<TravelEntryRecord>(id, { expand: 'technician,ticket,client,visit' })

export const createTravelEntry = (data: Partial<TravelEntryRecord>) =>
  pb.collection('travel_entries').create<TravelEntryRecord>(data)

export const updateTravelEntry = (id: string, data: Partial<TravelEntryRecord>) =>
  pb.collection('travel_entries').update<TravelEntryRecord>(id, data)

export const getVisitTravelEntries = (visitId: string) =>
  pb.collection('travel_entries').getFullList<TravelEntryRecord>({
    filter: `visit = "${visitId}"`,
    sort: '-travel_date',
  })

export const getTechnicianTravelEntries = (
  technicianId: string,
  startDate?: string,
  endDate?: string,
) => {
  const filters: string[] = [`technician = "${technicianId}"`]
  if (startDate) filters.push(`travel_date >= "${startDate}"`)
  if (endDate) filters.push(`travel_date <= "${endDate}"`)
  return pb.collection('travel_entries').getFullList<TravelEntryRecord>({
    filter: filters.join(' && '),
    sort: '-travel_date',
    expand: 'ticket,client',
  })
}
