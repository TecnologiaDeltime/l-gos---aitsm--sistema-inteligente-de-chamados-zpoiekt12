import pb from '@/lib/pocketbase/client'

export interface ReimbursementRecord {
  id: string
  technician: string
  visit?: string
  ticket?: string
  client?: string
  mileage?: number
  km_rate?: number
  mileage_amount?: number
  expense_total?: number
  total_requested?: number
  total_approved?: number
  total_paid?: number
  status: string
  approver?: string
  finance_approver?: string
  rejection_reason?: string
  submitted_at?: string
  approved_at?: string
  paid_at?: string
  created: string
  updated: string
  expand?: any
}

export const REIMBURSEMENT_STATUSES = [
  'Rascunho',
  'Aguardando Envio',
  'Aguardando Aprovação',
  'Aprovado',
  'Rejeitado',
  'Parcialmente Aprovado',
  'Enviado para Financeiro',
  'Pago',
  'Cancelado',
]

export const getReimbursements = (filter?: string) =>
  pb.collection('reimbursements').getFullList<ReimbursementRecord>({
    filter,
    sort: '-created',
    expand: 'technician,visit,ticket,client,approver',
  })

export const getReimbursement = (id: string) =>
  pb
    .collection('reimbursements')
    .getOne<ReimbursementRecord>(id, { expand: 'technician,visit,ticket' })

export const createReimbursement = (data: Partial<ReimbursementRecord>) =>
  pb.collection('reimbursements').create<ReimbursementRecord>(data)

export const updateReimbursement = (id: string, data: Partial<ReimbursementRecord>) =>
  pb.collection('reimbursements').update<ReimbursementRecord>(id, data)

export const getTechnicianReimbursements = (technicianId: string) =>
  pb.collection('reimbursements').getFullList<ReimbursementRecord>({
    filter: `technician = "${technicianId}"`,
    sort: '-created',
    expand: 'visit,ticket,client',
  })

export const calculateReimbursement = (visitId: string) =>
  pb.send(`/backend/v1/visits/${visitId}/calculate-reimbursement`, { method: 'POST' })
