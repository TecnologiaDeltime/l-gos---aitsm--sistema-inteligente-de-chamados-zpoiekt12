import pb from '@/lib/pocketbase/client'

export interface CategoryRecord {
  id: string
  name: string
  description?: string
  parent?: string
  active?: boolean
  impact?: string
  urgency?: string
  priority?: string
  sla_response_minutes?: number
  sla_solution_minutes?: number
  expand?: any
}

export const getCategories = () =>
  pb.collection('tkt_categories').getFullList<CategoryRecord>({ sort: 'name', expand: 'parent' })

export const createCategory = (data: Partial<CategoryRecord>) =>
  pb.collection('tkt_categories').create<CategoryRecord>(data)

export const updateCategory = (id: string, data: Partial<CategoryRecord>) =>
  pb.collection('tkt_categories').update<CategoryRecord>(id, data)

export const deleteCategory = (id: string) => pb.collection('tkt_categories').delete(id)
