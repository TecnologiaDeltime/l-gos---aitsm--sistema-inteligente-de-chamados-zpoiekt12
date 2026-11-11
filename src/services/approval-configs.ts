import pb from '@/lib/pocketbase/client'

export type ApprovalMode = 'Individual' | 'Sequencial' | 'Paralela'
export type ApproverType = 'focal_point' | 'internal_user'

export interface ApprovalConfigRecord {
  id: string
  company?: string
  clients?: string[]
  activity?: string
  mode?: ApprovalMode
  escalation_timeout_minutes?: number
  description?: string
  active?: boolean
  approver_type?: ApproverType | ''
  approver_focal_point?: string
  approver_user?: string
  focal_points?: string[]
  internal_approvers?: string[]
  // Listas multi-valoradas (migração 0163 — múltiplos aprovadores, regra "basta um")
  focal_points_all?: string[]
  internal_approvers_all?: string[]
  require_client_approval?: boolean
  require_internal_approval?: boolean
  request_types?: any
  created?: string
  updated?: string
  expand?: any
}

export const APPROVAL_CONFIG_EXPAND =
  'company,activity,focal_points_all,internal_approvers_all,approver_focal_point,approver_user'

export const getApprovalConfigs = (filter?: string): Promise<ApprovalConfigRecord[]> =>
  pb.collection('approval_configs').getFullList<ApprovalConfigRecord>({
    filter,
    sort: '-created',
    expand: APPROVAL_CONFIG_EXPAND,
  })

export const createApprovalConfig = (data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').create<ApprovalConfigRecord>(data)

export const updateApprovalConfig = (id: string, data: Partial<ApprovalConfigRecord>) =>
  pb.collection('approval_configs').update<ApprovalConfigRecord>(id, data)

export const deleteApprovalConfig = async (id: string): Promise<void> => {
  await pb.collection('approval_configs').delete(id)
}

// Objeto de serviço mantido por compatibilidade com chamadas antigas
export const approvalConfigsService = {
  async getAll(): Promise<ApprovalConfigRecord[]> {
    return getApprovalConfigs()
  },
  async getByCompany(companyId: string): Promise<ApprovalConfigRecord[]> {
    return getApprovalConfigs(`company = "${companyId}" || clients ~ "${companyId}"`)
  },
  create: createApprovalConfig,
  update: updateApprovalConfig,
  delete: deleteApprovalConfig,
}
