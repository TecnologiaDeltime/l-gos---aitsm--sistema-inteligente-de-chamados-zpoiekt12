import pb from '@/lib/pocketbase/client'

export interface ConfigurationItemRecord {
  id: string
  name: string
  type: ConfigurationItemType
  brand?: string
  model?: string
  serial_number?: string
  location?: string
  status: ConfigurationItemStatus
  observations?: string
  company: string
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      trade_name: string
      legal_name?: string
      code?: string
    }
    [key: string]: any
  }
}

export type ConfigurationItemType =
  | 'Impressora'
  | 'Roteador'
  | 'Access Point'
  | 'Switch'
  | 'Servidor'
  | 'Storage/NAS'
  | 'Firewall'
  | 'No-Break'
  | 'Telefone IP'
  | 'Scanner'
  | 'Projetor'
  | 'Monitor'
  | 'Estabilizador'
  | 'Câmera IP'
  | 'Controladora'
  | 'Rack'
  | 'Outros'

export const CONFIGURATION_ITEM_TYPES: ConfigurationItemType[] = [
  'Impressora',
  'Roteador',
  'Access Point',
  'Switch',
  'Servidor',
  'Storage/NAS',
  'Firewall',
  'No-Break',
  'Telefone IP',
  'Scanner',
  'Projetor',
  'Monitor',
  'Estabilizador',
  'Câmera IP',
  'Controladora',
  'Rack',
  'Outros',
]

export type ConfigurationItemStatus =
  | 'Ativo'
  | 'Inativo'
  | 'Em Manutenção'
  | 'Descartado'
  | 'Reserva'

export const CONFIGURATION_ITEM_STATUSES: ConfigurationItemStatus[] = [
  'Ativo',
  'Inativo',
  'Em Manutenção',
  'Descartado',
  'Reserva',
]

export interface ConfigurationItemFilters {
  company?: string
  type?: string
  status?: string
  search?: string
}

export const getConfigurationItems = (filters?: ConfigurationItemFilters) => {
  const parts: string[] = []
  if (filters?.company && filters.company !== 'all') {
    parts.push(`company = "${filters.company}"`)
  }
  if (filters?.type && filters.type !== 'all') {
    parts.push(`type = "${filters.type}"`)
  }
  if (filters?.status && filters.status !== 'all') {
    parts.push(`status = "${filters.status}"`)
  }
  if (filters?.search) {
    const s = filters.search.replace(/"/g, '')
    parts.push(
      `(name ~ "${s}" || brand ~ "${s}" || model ~ "${s}" || serial_number ~ "${s}" || location ~ "${s}")`,
    )
  }
  const filter = parts.join(' && ')
  return pb.collection('configuration_items').getFullList<ConfigurationItemRecord>({
    filter,
    sort: '-updated',
    expand: 'company',
  })
}

export const getConfigurationItemsByCompany = (companyId: string) => {
  return pb.collection('configuration_items').getFullList<ConfigurationItemRecord>({
    filter: `company = "${companyId}"`,
    sort: 'name',
    expand: 'company',
  })
}

export const getConfigurationItem = (id: string) => {
  return pb.collection('configuration_items').getOne<ConfigurationItemRecord>(id, {
    expand: 'company',
  })
}

export const createConfigurationItem = (
  data: Partial<ConfigurationItemRecord> & {
    name: string
    type: ConfigurationItemType
    company: string
  },
) => {
  return pb.collection('configuration_items').create<ConfigurationItemRecord>(data)
}

export const updateConfigurationItem = (id: string, data: Partial<ConfigurationItemRecord>) => {
  return pb.collection('configuration_items').update<ConfigurationItemRecord>(id, data)
}

export const deleteConfigurationItem = (id: string) => {
  return pb.collection('configuration_items').delete(id)
}
