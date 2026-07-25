import pb from '@/lib/pocketbase/client'

export interface BlockingRecord {
  id: string
  client: string
  reason: string
  justification: string
  responsible?: string
  start_date?: string
  expected_end_date?: string
  block_type: string
  allow_critical?: boolean
  message?: string
  approver?: string
  active?: boolean
  unblocked_at?: string
  unblocked_by?: string
  created: string
  expand?: any
}

export const BLOCK_REASONS = [
  'Limite de Horas',
  'Solicitação Diretoria',
  'Contrato Vencido',
  'Inadimplência',
  'Contrato Suspenso',
  'Cliente Inativo',
  'Pendência Aprovação',
  'Bloqueio Administrativo',
  'Outro',
]

export const BLOCK_TYPES = [
  'Bloquear Abertura Portal',
  'Bloquear Abertura Email',
  'Bloquear Abertura API',
  'Bloquear Todos Canais',
  'Permitir Abertura mas Impedir Atendimento',
  'Bloquear Serviços Específicos',
  'Permitir Somente Críticos',
]

export const getAllBlockingRecords = () =>
  pb.collection('blocking_records').getFullList<BlockingRecord>({
    sort: '-created',
    expand: 'client,responsible,approver,unblocked_by',
  })

export const createBlockingRecord = (data: Partial<BlockingRecord>) =>
  pb.collection('blocking_records').create<BlockingRecord>(data)

export const unblockClient = (id: string, userId: string) =>
  pb.collection('blocking_records').update<BlockingRecord>(id, {
    active: false,
    unblocked_at: new Date().toISOString(),
    unblocked_by: userId,
  })
