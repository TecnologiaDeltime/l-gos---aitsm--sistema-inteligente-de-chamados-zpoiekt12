import pb from '@/lib/pocketbase/client'

export interface CompanyUnitRecord {
  id: string
  company: string
  name: string
  address_street?: string
  address_number?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  address_zipcode?: string
  phone?: string
  manager_name?: string
  created: string
  updated: string
}

export const getCompanyUnitsByCompany = (companyId: string) =>
  pb.collection('company_units').getFullList<CompanyUnitRecord>({
    filter: `company = "${companyId}"`,
    sort: 'name',
  })

export const getAllCompanyUnits = () =>
  pb.collection('company_units').getFullList<CompanyUnitRecord>()

export const createCompanyUnit = (data: Partial<CompanyUnitRecord>) =>
  pb.collection('company_units').create<CompanyUnitRecord>(data)

export const updateCompanyUnit = (id: string, data: Partial<CompanyUnitRecord>) =>
  pb.collection('company_units').update<CompanyUnitRecord>(id, data)

export const deleteCompanyUnit = (id: string) => pb.collection('company_units').delete(id)
