import pb from '@/lib/pocketbase/client'

export type ApprovalMode = 'Individual' | 'Sequencial' | 'Paralela'

export interface ApprovalConfigRecord {
  id: string
  activity?: string | null
  clients?: string[]
  mode: ApprovalMode
  escalation_timeout_minutes?: number
  focal_points?: string[]
  internal_approvers?: string[]
  description?: string
  active: boolean
  created: string
  updated: string
  expand?: {
    activity?: {
      id: string
      name: string
      parent?: string
    }
    clients?: Array<{
      id: string
      trade_name?: string
      legal_name?: string
    }>
    focal_points?: Array<{
      id: string
      full_name: string
      email: string
      client?: string
    }>
    internal_approvers?: Array<{
      id: string
      name: string
      email: string
      role: string
    }>
  }
}

export const getApprovalConfigs = (filter?: string) =>
  pb.collection('approval_configs').getFullList<ApprovalConfigRecord>({
    filter,
    sort: '-created',
    expand: 'activity,clients,focal_points,internal_approvers',
  })

export const getApprovalConfig = (id: string) =>
  pb.collection('approval_configs').getOne<ApprovalConfigRecord>(id, {
    expand: 'activity,clients,focal_points,internal_approvers',
  })

export const createApprovalConfig = (data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').create<ApprovalConfigRecord>(data)

export const updateApprovalConfig = (id: string, data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').update<ApprovalConfigRecord>(id, data)

export const deleteApprovalConfig = (id: string) => pb.collection('approval_configs').delete(id)
