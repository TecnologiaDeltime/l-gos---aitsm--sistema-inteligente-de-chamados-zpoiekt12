import pb from '@/lib/pocketbase/client'

export interface ChangeRecord {
  id: string
  number: string
  title: string
  description: string
  change_type?: string
  template?: string
  status: string
  priority: string
  impact: string
  urgency: string
  risk_level: string
  risk_assessment?: string
  risk_not_executing?: string
  risk_executing?: string
  requester: string
  responsible?: string
  assigned_to?: string
  company?: string
  unit?: string
  category?: string
  ticket?: string
  planned_start?: string
  planned_end?: string
  actual_start?: string
  actual_end?: string
  execution_plan?: string
  rollback_plan?: string
  validation_results?: string
  evidence?: string
  closure_notes?: string
  approval_status?: string
  approved_by?: string
  approved_at?: string
  committee_decision?: string
  voting_deadline_at?: string
  escalation_reason?: string
  created: string
  updated: string
  expand?: any
}

const EXPAND =
  'change_type,template,requester,responsible,assigned_to,company,unit,category,ticket,approved_by,participants'

export const getChanges = (filter?: string) =>
  pb.collection('changes').getFullList<ChangeRecord>({ filter, sort: '-created', expand: EXPAND })

export const getChange = (id: string) =>
  pb.collection('changes').getOne<ChangeRecord>(id, { expand: EXPAND })

export const createChange = (data: Partial<ChangeRecord>) =>
  pb.collection('changes').create<ChangeRecord>(data)

export const updateChange = (id: string, data: Partial<ChangeRecord>) =>
  pb.collection('changes').update<ChangeRecord>(id, data)

export const deleteChange = (id: string) => pb.collection('changes').delete(id)

export const getChangeAuditLogs = (changeId: string) =>
  pb
    .collection('change_audit_logs')
    .getFullList({ filter: `change = "${changeId}"`, sort: '-created', expand: 'user' })

export const getChangeApprovals = (changeId: string) =>
  pb
    .collection('change_approvals')
    .getFullList({ filter: `change = "${changeId}"`, sort: '-created', expand: 'approver' })

export const getMyPendingApprovals = (userId: string) =>
  pb.collection('change_approvals').getFullList({
    filter: `approver = "${userId}" && status = "Pendente"`,
    sort: '-created',
    expand: 'change,change.change_type,change.requester,change.company',
  })

export const getMyApprovals = (userId: string) =>
  pb.collection('change_approvals').getFullList({
    filter: `approver = "${userId}"`,
    sort: '-created',
    expand: 'change,change.change_type,change.requester,change.company',
  })

export const decideChangeApproval = (changeId: string, decision: string, comment: string) =>
  pb.send(`/backend/v1/changes/${changeId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
    headers: { 'Content-Type': 'application/json' },
  })

// Submete uma RDM em Rascunho para o fluxo de aprovação do comitê
export const submitChangeForApproval = (changeId: string) =>
  pb.send(`/backend/v1/changes/${changeId}/submit`, {
    method: 'POST',
  })

export const getMyChanges = (userId: string) =>
  pb.collection('changes').getFullList<ChangeRecord>({
    filter: `requester = "${userId}" || responsible = "${userId}" || assigned_to = "${userId}"`,
    sort: '-created',
    expand: EXPAND,
  })
