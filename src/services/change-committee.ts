import pb from '@/lib/pocketbase/client'

export interface ChangeCommitteeRecord {
  id: string
  name: string
  description?: string
  members?: string[]
  chairperson?: string
  meeting_frequency?: string
  active?: boolean
  created: string
  updated: string
  expand?: any
}

export const getCommittees = () =>
  pb.collection('change_committee').getFullList<ChangeCommitteeRecord>({
    sort: 'name',
    expand: 'members,chairperson',
  })

export const createCommittee = (data: Partial<ChangeCommitteeRecord>) =>
  pb.collection('change_committee').create<ChangeCommitteeRecord>(data)

export const updateCommittee = (id: string, data: Partial<ChangeCommitteeRecord>) =>
  pb.collection('change_committee').update<ChangeCommitteeRecord>(id, data)

export const deleteCommittee = (id: string) => pb.collection('change_committee').delete(id)
