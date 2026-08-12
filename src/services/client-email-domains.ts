import pb from '@/lib/pocketbase/client'

export interface ClientEmailDomainRecord {
  id: string
  client: string
  domain: string
  active: boolean
  created: string
  updated: string
}

export interface PendingEmailDomain {
  domain: string
  active: boolean
}

export const getEmailDomains = (clientId: string) =>
  pb.collection('client_email_domains').getFullList<ClientEmailDomainRecord>({
    filter: `client = "${clientId}"`,
    sort: 'domain',
  })

export const getAllEmailDomains = () =>
  pb.collection('client_email_domains').getFullList<ClientEmailDomainRecord>()

export const createEmailDomain = (data: { client: string; domain: string; active: boolean }) =>
  pb.collection('client_email_domains').create<ClientEmailDomainRecord>(data)

export const updateEmailDomain = (id: string, data: Partial<ClientEmailDomainRecord>) =>
  pb.collection('client_email_domains').update<ClientEmailDomainRecord>(id, data)

export const deleteEmailDomain = (id: string) => pb.collection('client_email_domains').delete(id)
