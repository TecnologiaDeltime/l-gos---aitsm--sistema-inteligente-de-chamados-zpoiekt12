import { getCompanyDepartments } from '@/services/companies'
import { getClientContacts } from '@/services/client-contacts'

export interface DepartmentOption {
  id: string
  name: string
}

export async function resolveDepartment(params: {
  companyId: string
  requesterEmail?: string
  unitId?: string
}): Promise<DepartmentOption | null> {
  const { companyId, requesterEmail, unitId } = params

  const [departments, contacts] = await Promise.all([
    getCompanyDepartments(companyId).catch(() => []),
    getClientContacts(companyId).catch(() => []),
  ])

  if (requesterEmail) {
    const matchingContact = contacts.find(
      (c) => c.email?.toLowerCase() === requesterEmail.toLowerCase(),
    )
    if (matchingContact?.departments && matchingContact.departments.length > 0) {
      const deptId = matchingContact.departments[0]
      const dept = (departments as any[]).find((d) => d.id === deptId)
      if (dept) return { id: dept.id, name: dept.name }
      if (deptId) return { id: deptId, name: 'Setor' }
    }
  }

  const depts = departments as any[]
  if (depts.length > 0) {
    let filtered = depts
    if (unitId) {
      filtered = depts.filter((d) => d.unit === unitId)
      if (filtered.length === 0) filtered = depts
    }
    return { id: filtered[0].id, name: filtered[0].name }
  }

  return null
}
