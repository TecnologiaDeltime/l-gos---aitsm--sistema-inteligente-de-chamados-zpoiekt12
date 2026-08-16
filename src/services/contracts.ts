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
  hours_level1?: number | null
  hours_level2?: number | null
  hours_level3?: number | null
  hours_consultoria?: number | null
  hours_backoffice?: number | null
  hours_administrativo?: number | null
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

export const PRIORITY_OPTIONS = ['Crítica', 'Alta', 'Média', 'Baixa']

export interface ContractHoursLevel {
  key:
    | 'hours_level1'
    | 'hours_level2'
    | 'hours_level3'
    | 'hours_consultoria'
    | 'hours_backoffice'
    | 'hours_administrativo'
  label: string
}

export const CONTRACT_HOURS_LEVELS: ContractHoursLevel[] = [
  { key: 'hours_level1', label: 'Nível 1' },
  { key: 'hours_level2', label: 'Nível 2' },
  { key: 'hours_level3', label: 'Nível 3' },
  { key: 'hours_consultoria', label: 'Consultoria' },
  { key: 'hours_backoffice', label: 'Backoffice' },
  { key: 'hours_administrativo', label: 'Administrativo' },
]

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
