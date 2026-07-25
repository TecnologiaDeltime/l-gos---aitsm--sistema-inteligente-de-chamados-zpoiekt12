import pb from '@/lib/pocketbase/client'

export interface ExpenseRecord {
  id: string
  visit?: string
  travel_entry?: string
  technician: string
  ticket?: string
  client?: string
  expense_type: string
  value: number
  expense_date?: string
  supplier?: string
  receipt?: string
  justification?: string
  approval_status: string
  approved_value?: number
  paid_value?: number
  rejection_reason?: string
  approver?: string
  approved_at?: string
  created: string
  updated: string
  expand?: any
}

export const EXPENSE_TYPES = [
  'Quilometragem',
  'Combustível',
  'Pedágio',
  'Estacionamento',
  'Aplicativo de Transporte',
  'Refeição',
  'Hospedagem',
  'Passagem',
  'Materiais Utilizados',
  'Peças',
  'Outros Custos',
]

export const EXPENSE_STATUSES = [
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

export const getExpenses = (filter?: string) =>
  pb.collection('expenses').getFullList<ExpenseRecord>({
    filter,
    sort: '-created',
    expand: 'technician,visit,ticket,client,approver',
  })

export const getExpense = (id: string) =>
  pb.collection('expenses').getOne<ExpenseRecord>(id, { expand: 'technician,visit,ticket,client' })

export const createExpense = (data: Partial<ExpenseRecord>) =>
  pb.collection('expenses').create<ExpenseRecord>(data)

export const updateExpense = (id: string, data: Partial<ExpenseRecord>) =>
  pb.collection('expenses').update<ExpenseRecord>(id, data)

export const getVisitExpenses = (visitId: string) =>
  pb.collection('expenses').getFullList<ExpenseRecord>({
    filter: `visit = "${visitId}"`,
    sort: '-created',
  })

export const getTechnicianExpenses = (technicianId: string) =>
  pb.collection('expenses').getFullList<ExpenseRecord>({
    filter: `technician = "${technicianId}"`,
    sort: '-created',
    expand: 'visit,ticket,client',
  })
