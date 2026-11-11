import pb from '@/lib/pocketbase/client'
import { ApprovalConfig } from '@/types/approval'

export const approvalConfigsService = {
  async getAll(): Promise<ApprovalConfig[]> {
    return await pb.collection('approval_configs').getFullList({
      sort: '-created',
      expand:
        'company,activity,focal_points_all,internal_approvers_all,approver_focal_point,approver_user',
    })
  },

  async getByCompany(companyId: string): Promise<ApprovalConfig[]> {
    return await pb.collection('approval_configs').getFullList({
      filter: `company = "${companyId}"`,
      sort: '-created',
      expand:
        'company,activity,focal_points_all,internal_approvers_all,approver_focal_point,approver_user',
    })
  },

  async create(data: Partial<ApprovalConfig>): Promise<ApprovalConfig> {
    return await pb.collection('approval_configs').create(data)
  },

  async update(id: string, data: Partial<ApprovalConfig>): Promise<ApprovalConfig> {
    return await pb.collection('approval_configs').update(id, data)
  },

  async delete(id: string): Promise<void> {
    await pb.collection('approval_configs').delete(id)
  },
}
