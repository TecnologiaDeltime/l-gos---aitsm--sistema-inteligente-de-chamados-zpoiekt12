import pb from '@/lib/pocketbase/client'

export type ApprovalMode = 'Individual' | 'Sequencial' | 'Paralela'
export type ApproverType = 'focal_point' | 'internal_user'

export interface ApprovalConfigRecord {
  id: string
  company?: string | null
  activity?: string | null
  approver_type?: ApproverType | null
  approver_focal_point?: string | null
  approver_user?: string | null
  clients?: string[]
  mode: ApprovalMode
  escalation_timeout_minutes?: number
  focal_points?: string[]
  internal_approvers?: string[]
  request_types?: string[]
  require_high_priority?: boolean
  require_client_approval?: boolean
  require_internal_approval?: boolean
  description?: string
  active: boolean
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      trade_name?: string
      legal_name?: string
      code?: string
    }
    activity?: {
      id: string
      name: string
      parent?: string
      impact?: string
      urgency?: string
      priority?: string
      sla_solution_minutes?: number
    }
    approver_focal_point?: {
      id: string
      full_name: string
      email: string
      phone?: string
      cell_phone?: string
      client?: string
      is_focal_point?: boolean
    }
    approver_user?: {
      id: string
      name: string
      email: string
      role: string
      position?: string
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
    expand:
      'company,activity,approver_focal_point,approver_user,clients,focal_points,internal_approvers',
  })

export const getApprovalConfigsByCompany = (companyId: string) =>
  pb.collection('approval_configs').getFullList<ApprovalConfigRecord>({
    filter: `company = "${companyId}" || clients ~ "${companyId}"`,
    sort: '-created',
    expand:
      'company,activity,approver_focal_point,approver_user,clients,focal_points,internal_approvers',
  })

export const getApprovalConfig = (id: string) =>
  pb.collection('approval_configs').getOne<ApprovalConfigRecord>(id, {
    expand:
      'company,activity,approver_focal_point,approver_user,clients,focal_points,internal_approvers',
  })

export const createApprovalConfig = (data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').create<ApprovalConfigRecord>(data)

export const updateApprovalConfig = (id: string, data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').update<ApprovalConfigRecord>(id, data)

export const deleteApprovalConfig = (id: string) => pb.collection('approval_configs').delete(id)
