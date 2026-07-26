import pb from '@/lib/pocketbase/client'

export interface TicketTemplateRecord {
  id: string
  name: string
  content: string
  type: 'Resolução' | 'Comentário' | 'Ambos'
  active: boolean
  created_by?: string
  created: string
  updated: string
}

export const TEMPLATE_TYPES = ['Resolução', 'Comentário', 'Ambos'] as const

export const getTemplates = () =>
  pb.collection('ticket_templates').getFullList<TicketTemplateRecord>({ sort: 'name' })

export const getActiveTemplates = (type?: string) => {
  const filter = type ? `active = true && (type = "${type}" || type = "Ambos")` : 'active = true'
  return pb.collection('ticket_templates').getFullList<TicketTemplateRecord>({
    filter,
    sort: 'name',
  })
}

export const getTemplate = (id: string) =>
  pb.collection('ticket_templates').getOne<TicketTemplateRecord>(id)

export const createTemplate = (data: {
  name: string
  content: string
  type: string
  active: boolean
  created_by?: string
}) => pb.collection('ticket_templates').create<TicketTemplateRecord>(data)

export const updateTemplate = (id: string, data: Partial<TicketTemplateRecord>) =>
  pb.collection('ticket_templates').update<TicketTemplateRecord>(id, data)

export const deleteTemplate = (id: string) => pb.collection('ticket_templates').delete(id)
