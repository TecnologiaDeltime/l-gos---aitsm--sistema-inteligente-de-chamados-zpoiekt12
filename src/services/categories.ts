import pb from '@/lib/pocketbase/client'

export type ActivityTicketType = 'Incidente' | 'Requisição de Serviço' | 'Dúvida' | 'Visita Técnica'

export interface CategoryRecord {
  id: string
  name: string
  description?: string
  parent?: string
  active?: boolean
  deleted?: boolean
  type?: ActivityTicketType | string
  impact?: string
  urgency?: string
  priority?: string
  sla_response_minutes?: number | null
  sla_solution_minutes?: number | null
  expand?: any
}

export const getCategories = (includeDeleted: boolean = false) =>
  pb.collection('tkt_categories').getFullList<CategoryRecord>({
    filter: includeDeleted ? '' : 'deleted != true',
    sort: 'name',
    expand: 'parent',
  })

export const getCategoryById = (id: string) =>
  pb.collection('tkt_categories').getOne<CategoryRecord>(id)

export const createCategory = (data: Partial<CategoryRecord>) =>
  pb.collection('tkt_categories').create<CategoryRecord>(data)

export const updateCategory = (id: string, data: Partial<CategoryRecord>) =>
  pb.collection('tkt_categories').update<CategoryRecord>(id, data)

export const deleteCategory = (id: string) => pb.collection('tkt_categories').delete(id)
