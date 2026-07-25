import pb from '@/lib/pocketbase/client'

export interface CompanyRecord {
  id: string
  code: string
  legal_name: string
  trade_name: string
  document: string
  phone?: string
  email?: string
  address_street?: string
  address_city?: string
  address_state?: string
  status?: string
  created: string
  updated: string
}

export const getCompanies = (filter?: string) =>
  pb.collection('companies').getFullList<CompanyRecord>({ filter, sort: 'trade_name' })

export const getCompany = (id: string) => pb.collection('companies').getOne<CompanyRecord>(id)

export const createCompany = (data: Partial<CompanyRecord>) =>
  pb.collection('companies').create<CompanyRecord>(data)

export const updateCompany = (id: string, data: Partial<CompanyRecord>) =>
  pb.collection('companies').update<CompanyRecord>(id, data)

export const deleteCompany = (id: string) => pb.collection('companies').delete(id)

export const getCompanyUnits = (companyId: string) =>
  pb.collection('company_units').getFullList({ filter: `company = "${companyId}"` })

export const getCompanyDepartments = (companyId: string) =>
  pb.collection('company_departments').getFullList({ filter: `company = "${companyId}"` })

export const createCompanyAuditLog = (data: {
  user: string
  action: string
  entity_type: string
  entity_id: string
  description?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
}) => pb.collection('audit_logs').create(data)
