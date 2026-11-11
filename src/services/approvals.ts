import pb from '@/lib/pocketbase/client'

export interface ApprovalRecord {
  id: string
  ticket: string
  requester: string
  approver?: string
  target_contact?: string
  target_email?: string
  type: string
  justification: string
  estimated_hours?: number
  estimated_cost?: number
  deadline?: string
  status: 'Pendente' | 'Aprovado' | 'Reprovado' | string
  mode?: 'Individual' | 'Sequencial' | 'Paralela'
  stage?: number
  escalation_deadline?: string
  approval_config?: string
  approval_role?: 'client' | 'internal' | 'general'
  rejection_reason?: string
  approved_at?: string
  rejected_at?: string
  approver_comment?: string
  token?: string
  created: string
  updated: string
  expand?: {
    ticket?: {
      id: string
      number: string
      title: string
      description: string
      status: string
      company?: string
      expand?: any
    }
    requester?: {
      id: string
      name: string
      email: string
    }
    approver?: {
      id: string
      name: string
      email: string
      role?: string
    }
    target_contact?: {
      id: string
      full_name: string
      email: string
    }
    approval_config?: {
      id: string
      mode: string
      escalation_timeout_minutes: number
      expand?: any
    }
  }
}

export const APPROVAL_TYPES = [
  'Horas Adicionais',
  'Compra de Equipamento',
  'Visita Técnica',
  'Mudança',
  'Reinicialização de Servidor',
  'Criação de Usuário',
  'Liberação de Acesso',
  'Instalação de Software',
  'Fora do Horário',
  'Outros',
]

export const APPROVAL_STATUSES = ['Pendente', 'Aprovado', 'Reprovado', 'Cancelado']

export const getApprovals = (filter?: string) =>
  pb.collection('approvals').getFullList<ApprovalRecord>({
    filter,
    sort: '-created',
    expand:
      'ticket,ticket.company,ticket.category,ticket.subcategory,requester,approver,target_contact,approval_config',
  })

export const getApproval = (id: string) =>
  pb.collection('approvals').getOne<ApprovalRecord>(id, {
    expand: 'ticket,ticket.company,requester,approver,target_contact,approval_config',
  })

export const createApproval = (data: Partial<ApprovalRecord>) =>
  pb.collection('approvals').create<ApprovalRecord>(data)

export const updateApproval = (id: string, data: Partial<ApprovalRecord>) =>
  pb.collection('approvals').update<ApprovalRecord>(id, data)

export const getTicketApprovals = (ticketId: string) =>
  pb.collection('approvals').getFullList<ApprovalRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'requester,approver,target_contact,approval_config',
  })

export const getApprovalByToken = (token: string) =>
  pb.send<any>(`/backend/v1/approvals/${token}`, { method: 'GET' })

export const decideApproval = (
  token: string,
  decision: 'approved' | 'rejected',
  commentOrReason?: string,
) =>
  pb.send<any>(`/backend/v1/approvals/${token}/decide`, {
    method: 'POST',
    body: JSON.stringify({
      decision,
      comment: commentOrReason,
      rejection_reason: commentOrReason,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
