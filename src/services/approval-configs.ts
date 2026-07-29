import pb from '@/lib/pocketbase/client'

export interface ApprovalConfigRecord {
  id: string
  activity: string
  clients: string[]
  active: boolean
  created: string
  updated: string
  expand?: any
}

export const getApprovalConfigs = () =>
  pb.collection('approval_configs').getFullList<ApprovalConfigRecord>({
    sort: '-created',
    expand: 'activity,clients',
  })

export const createApprovalConfig = (data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').create<ApprovalConfigRecord>(data)

export const updateApprovalConfig = (id: string, data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').update<ApprovalConfigRecord>(id, data)

export const deleteApprovalConfig = (id: string) => pb.collection('approval_configs').delete(id)
