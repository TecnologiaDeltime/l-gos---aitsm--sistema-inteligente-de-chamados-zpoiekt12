import pb from '@/lib/pocketbase/client'

export interface ContractPeriodRecord {
  id: string
  contract: string
  period_start?: string
  period_end?: string
  contracted_hours?: number
  consumed_hours?: number
  status?: string
  cycle_number?: number
  created: string
  updated: string
  expand?: any
}

export const getContractPeriods = (contractId?: string) =>
  pb.collection('contract_periods').getFullList<ContractPeriodRecord>({
    filter: contractId ? `contract = "${contractId}"` : undefined,
    sort: '-period_start',
  })

export const getActivePeriod = (contractId: string) =>
  pb
    .collection('contract_periods')
    .getFirstListItem<ContractPeriodRecord>(`contract = "${contractId}" && status = "Ativo"`)

export const createContractPeriod = (data: Partial<ContractPeriodRecord>) =>
  pb.collection('contract_periods').create<ContractPeriodRecord>(data)

export const updateContractPeriod = (id: string, data: Partial<ContractPeriodRecord>) =>
  pb.collection('contract_periods').update<ContractPeriodRecord>(id, data)
