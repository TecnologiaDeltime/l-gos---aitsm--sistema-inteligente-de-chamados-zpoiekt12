import pb from '@/lib/pocketbase/client'

export interface ClientContactRecord {
  id: string
  client: string
  full_name: string
  email?: string
  phone?: string
  cell_phone?: string
  has_whatsapp?: boolean
  departments?: string[]
  unit?: string
  user?: string
  is_focal_point?: boolean
  created: string
  updated: string
}

export interface FocalPointData {
  full_name: string
  email: string
  phone: string
  cell_phone?: string
  has_whatsapp?: boolean
  user?: string
}

export const getFocalPoints = (clientId: string) =>
  pb.collection('client_contacts').getFullList<ClientContactRecord>({
    filter: `client = "${clientId}" && is_focal_point = true`,
    sort: 'full_name',
  })

export const getClientContacts = (clientId: string) =>
  pb.collection('client_contacts').getFullList<ClientContactRecord>({
    filter: `client = "${clientId}"`,
    sort: 'full_name',
  })

export const getAllClientContacts = () =>
  pb.collection('client_contacts').getFullList<ClientContactRecord>()

export const createClientContact = (data: Partial<ClientContactRecord>) =>
  pb.collection('client_contacts').create<ClientContactRecord>(data)

export const updateClientContact = (id: string, data: Partial<ClientContactRecord>) =>
  pb.collection('client_contacts').update<ClientContactRecord>(id, data)

export const deleteClientContact = (id: string) => pb.collection('client_contacts').delete(id)
