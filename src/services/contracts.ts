import pb from '@/lib/pocketbase/client'

export interface ContractRecord {
  id: string
  company: string
  number: string
  type: string
  status: string
  start_date?: string
  end_date?: string
  monthly_hours?: number
  accumulative_hours?: boolean
  overtime_hour_value?: number
  monthly_hour_limit?: number
  service_hours_start?: string
  service_hours_end?: string
  service_days?: string
  on_duty_coverage?: boolean
  sla_response_time?: number
  sla_solution_time?: number
  sla_update_time?: number
  sla_field_service_time?: number
  priorities_available?: string[]
  included_services?: string
  excluded_services?: string
  overtime_policy?: string
  travel_policy?: string
  technical_visit_policy?: string
  notes?: string
  created: string
  updated: string
  expand?: any
}

export const CONTRACT_TYPES = [
  'Pacote Mensal',
  'Por Chamado',
  'Ilimitado',
  'Banco de Horas',
  'Projeto',
  'Sustentação Mensal',
  'Atendimento Avulso',
  'Híbrido',
]

export const CONTRACT_STATUSES = ['Ativo', 'Expirado', 'Cancelado']

export const SERVICE_DAYS = ['Seg-Sex', 'Seg-Sáb', 'Todos', 'Personalizado']

export const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'P5']

export const getContracts = (filter?: string) =>
  pb
    .collection('contracts')
    .getFullList<ContractRecord>({ filter, sort: '-created', expand: 'company' })

export const getContract = (id: string) =>
  pb.collection('contracts').getOne<ContractRecord>(id, { expand: 'company' })

export const createContract = (data: Partial<ContractRecord>) =>
  pb.collection('contracts').create<ContractRecord>(data)

export const updateContract = (id: string, data: Partial<ContractRecord>) =>
  pb.collection('contracts').update<ContractRecord>(id, data)

export const deleteContract = (id: string) => pb.collection('contracts').delete(id)

export const getActiveContracts = () =>
  pb.collection('contracts').getFullList<ContractRecord>({
    filter: 'status = "Ativo"',
    sort: '-created',
    expand: 'company',
  })

export const getContractTickets = (contractId: string) =>
  pb.collection('tickets').getFullList({
    filter: `contract = "${contractId}"`,
    sort: '-created',
    expand: 'assigned_to,company',
  })
