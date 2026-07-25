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
  sla_response_time?: number
  sla_solution_time?: number
  priorities_available?: string[]
  created: string
  updated: string
  expand?: any
}

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
