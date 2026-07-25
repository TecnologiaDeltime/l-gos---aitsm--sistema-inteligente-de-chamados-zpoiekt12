import pb from '@/lib/pocketbase/client'

export interface CiTypeRecord {
  id: string
  name: string
  description?: string
  icon?: string
  custom_attributes?: string
  active?: boolean
  created: string
  updated: string
}

export const getCiTypes = () =>
  pb.collection('ci_types').getFullList<CiTypeRecord>({ sort: 'name' })

export const createCiType = (data: Partial<CiTypeRecord>) =>
  pb.collection('ci_types').create<CiTypeRecord>(data)

export const updateCiType = (id: string, data: Partial<CiTypeRecord>) =>
  pb.collection('ci_types').update<CiTypeRecord>(id, data)

export const deleteCiType = (id: string) => pb.collection('ci_types').delete(id)
