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

export const APPROVAL_CONFIG_EXPAND = 'company,activity,approver_focal_point,approver_user'

// Normaliza a lista de aprovadores: usa as listas multi-valoradas (*_all, mig 0163)
// quando existirem; caso contrário, cai nos campos legados (focal_points /
// internal_approvers) e, por fim, no aprovador único (approver_focal_point /
// approver_user) — mantendo compatibilidade com regras antigas.
export const getFocalPointsAll = (cfg: ApprovalConfigRecord | null | undefined): string[] => {
  if (!cfg) return []
  const all = Array.isArray(cfg.focal_points_all) ? cfg.focal_points_all.filter(Boolean) : []
  if (all.length > 0) return all
  const legacy = Array.isArray(cfg.focal_points) ? cfg.focal_points.filter(Boolean) : []
  if (legacy.length > 0) return legacy
  return cfg.approver_focal_point ? [cfg.approver_focal_point] : []
}

export const getInternalApproversAll = (cfg: ApprovalConfigRecord | null | undefined): string[] => {
  if (!cfg) return []
  const all = Array.isArray(cfg.internal_approvers_all)
    ? cfg.internal_approvers_all.filter(Boolean)
    : []
  if (all.length > 0) return all
  const legacy = Array.isArray(cfg.internal_approvers) ? cfg.internal_approvers.filter(Boolean) : []
  if (legacy.length > 0) return legacy
  return cfg.approver_user ? [cfg.approver_user] : []
}

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
