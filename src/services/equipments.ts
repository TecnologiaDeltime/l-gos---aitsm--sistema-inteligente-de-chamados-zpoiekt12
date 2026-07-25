import pb from '@/lib/pocketbase/client'

export interface EquipmentRecord {
  id: string
  name: string
  type?: string
  manufacturer?: string
  model?: string
  serial_number?: string
  patrimony_number?: string
  company: string
  status?: string
  expand?: any
}

export const getEquipments = (companyId?: string) => {
  const filter = companyId ? `company = "${companyId}"` : ''
  return pb
    .collection('equipments')
    .getFullList<EquipmentRecord>({ filter, sort: 'name', expand: 'company' })
}

export const createEquipment = (data: Partial<EquipmentRecord>) =>
  pb.collection('equipments').create<EquipmentRecord>(data)
