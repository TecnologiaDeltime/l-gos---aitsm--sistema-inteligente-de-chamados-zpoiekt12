import pb from '@/lib/pocketbase/client'

export interface ChangeTemplateRecord {
  id: string
  name: string
  change_type?: string
  description?: string
  procedure?: string
  checklist?: string
  default_priority?: string
  default_impact?: string
  default_urgency?: string
  default_risk_level?: string
  rollback_procedure?: string
  validation_criteria?: string
  active?: boolean
  created: string
  updated: string
  expand?: any
}

export const getChangeTemplates = () =>
  pb.collection('change_templates').getFullList<ChangeTemplateRecord>({
    sort: 'name',
    expand: 'change_type',
  })

export const getActiveChangeTemplates = () =>
  pb.collection('change_templates').getFullList<ChangeTemplateRecord>({
    filter: 'active = true',
    sort: 'name',
    expand: 'change_type',
  })

export const createChangeTemplate = (data: Partial<ChangeTemplateRecord>) =>
  pb.collection('change_templates').create<ChangeTemplateRecord>(data)

export const updateChangeTemplate = (id: string, data: Partial<ChangeTemplateRecord>) =>
  pb.collection('change_templates').update<ChangeTemplateRecord>(id, data)

export const deleteChangeTemplate = (id: string) => pb.collection('change_templates').delete(id)
