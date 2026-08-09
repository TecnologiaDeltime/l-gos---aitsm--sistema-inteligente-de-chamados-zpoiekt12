import pb from '@/lib/pocketbase/client'

export interface ChangeTypeRecord {
  id: string
  name: string
  description?: string
  risk_level?: string
  approval_required?: boolean
  committee_approval?: boolean
  eligible_for_automation?: boolean
  is_standard?: boolean
  recurring?: boolean
  active?: boolean
  created: string
  updated: string
}

export const getChangeTypes = () =>
  pb.collection('change_types').getFullList<ChangeTypeRecord>({ sort: 'name' })

export const getActiveChangeTypes = () =>
  pb
    .collection('change_types')
    .getFullList<ChangeTypeRecord>({ filter: 'active = true', sort: 'name' })

export const createChangeType = (data: Partial<ChangeTypeRecord>) =>
  pb.collection('change_types').create<ChangeTypeRecord>(data)

export const updateChangeType = (id: string, data: Partial<ChangeTypeRecord>) =>
  pb.collection('change_types').update<ChangeTypeRecord>(id, data)

export const deleteChangeType = (id: string) => pb.collection('change_types').delete(id)
