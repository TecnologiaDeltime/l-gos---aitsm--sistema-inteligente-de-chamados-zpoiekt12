import pb from '@/lib/pocketbase/client'

export interface EquipmentRecord {
  id: string
  name: string
  type?: string
  manufacturer?: string
  model?: string
  serial_number?: string
  patrimony_number?: string
  ip_address?: string
  operating_system?: string
  company: string
  unit?: string
  department?: string
  responsible_user?: string
  warranty_until?: string
  supplier?: string
  acquisition_date?: string
  status?: string
  location?: string
  notes?: string
  created: string
  updated: string
  expand?: any
}

export interface EquipmentFilters {
  company?: string
  unit?: string
  type?: string
  status?: string
  manufacturer?: string
  search?: string
}

export const CI_STATUSES = [
  'Planejado',
  'Ativo',
  'Inativo',
  'Em Manutenção',
  'Descartado',
  'Reserva',
  'Emprestado',
]

export const getEquipments = (filters?: EquipmentFilters) => {
  const parts: string[] = []
  if (filters?.company && filters.company !== 'all') parts.push(`company = "${filters.company}"`)
  if (filters?.unit && filters.unit !== 'all') parts.push(`unit = "${filters.unit}"`)
  if (filters?.type && filters.type !== 'all') parts.push(`type = "${filters.type}"`)
  if (filters?.status && filters.status !== 'all') parts.push(`status = "${filters.status}"`)
  if (filters?.manufacturer && filters.manufacturer !== 'all')
    parts.push(`manufacturer = "${filters.manufacturer}"`)
  if (filters?.search) {
    const s = filters.search.replace(/"/g, '')
    parts.push(
      `(name ~ "${s}" || serial_number ~ "${s}" || patrimony_number ~ "${s}" || ip_address ~ "${s}")`,
    )
  }
  const filter = parts.join(' && ')
  return pb
    .collection('equipments')
    .getFullList<EquipmentRecord>({ filter, sort: '-updated', expand: 'company,unit,department' })
}

export const getEquipment = (id: string) =>
  pb.collection('equipments').getOne<EquipmentRecord>(id, { expand: 'company,unit,department' })

export const createEquipment = (data: Partial<EquipmentRecord>) =>
  pb.collection('equipments').create<EquipmentRecord>(data)

export const updateEquipment = (id: string, data: Partial<EquipmentRecord>) =>
  pb.collection('equipments').update<EquipmentRecord>(id, data)

export const deleteEquipment = (id: string) => pb.collection('equipments').delete(id)

export const getEquipmentTickets = (equipmentId: string) =>
  pb.collection('tickets').getFullList({
    filter: `equipment = "${equipmentId}"`,
    sort: '-created',
    expand: 'company,assigned_to',
  })

export const getEquipmentAuditLogs = (equipmentId: string) =>
  pb.collection('audit_logs').getFullList({
    filter: `entity_type = "equipment" && entity_id = "${equipmentId}"`,
    sort: '-created',
    expand: 'user',
  })

export const createAuditLog = (data: {
  user: string
  action: string
  entity_type: string
  entity_id: string
  description?: string
}) => pb.collection('audit_logs').create(data)
