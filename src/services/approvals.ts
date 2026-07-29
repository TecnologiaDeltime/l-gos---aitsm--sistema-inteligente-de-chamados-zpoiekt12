import pb from '@/lib/pocketbase/client'

export interface ApprovalRecord {
  id: string
  ticket: string
  requester: string
  approver?: string
  type: string
  justification: string
  estimated_hours?: number
  estimated_cost?: number
  deadline?: string
  status: string
  approved_at?: string
  rejected_at?: string
  approver_comment?: string
  token?: string
  created: string
  updated: string
  expand?: any
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

export const APPROVAL_STATUSES = ['Pendente', 'Aprovado', 'Reprovado']

export const getApprovals = (filter?: string) =>
  pb.collection('approvals').getFullList<ApprovalRecord>({
    filter,
    sort: '-created',
    expand: 'ticket,ticket.company,ticket.category,ticket.subcategory,requester,approver',
  })

export const getApproval = (id: string) =>
  pb.collection('approvals').getOne<ApprovalRecord>(id, { expand: 'ticket,requester,approver' })

export const createApproval = (data: Partial<ApprovalRecord>) =>
  pb.collection('approvals').create<ApprovalRecord>(data)

export const updateApproval = (id: string, data: Partial<ApprovalRecord>) =>
  pb.collection('approvals').update<ApprovalRecord>(id, data)

export const getTicketApprovals = (ticketId: string) =>
  pb.collection('approvals').getFullList<ApprovalRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'requester,approver',
  })

export const getApprovalByToken = (token: string) =>
  pb.send(`/backend/v1/approvals/${token}`, { method: 'GET' })

export const decideApproval = (token: string, decision: string, comment: string) =>
  pb.send(`/backend/v1/approvals/${token}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
    headers: { 'Content-Type': 'application/json' },
  })
