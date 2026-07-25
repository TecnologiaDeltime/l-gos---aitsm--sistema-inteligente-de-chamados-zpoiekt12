import pb from '@/lib/pocketbase/client'
import type {
  AutomationRecord,
  WorkflowVersionRecord,
  WorkflowDefinition,
} from '@/types/automation'

export const getAutomations = (filter?: string) =>
  pb.collection('automations').getFullList<AutomationRecord>({
    filter,
    sort: '-created',
    expand: 'client,catalog,responsible',
  })

export const getAutomation = (id: string) =>
  pb
    .collection('automations')
    .getOne<AutomationRecord>(id, { expand: 'client,catalog,responsible' })

export const createAutomation = (data: Partial<AutomationRecord>) =>
  pb.collection('automations').create<AutomationRecord>(data)

export const updateAutomation = (id: string, data: Partial<AutomationRecord>) =>
  pb.collection('automations').update<AutomationRecord>(id, data)

export const deleteAutomation = (id: string) => pb.collection('automations').delete(id)

export const getVersions = (automationId: string) =>
  pb.collection('workflow_versions').getFullList<WorkflowVersionRecord>({
    filter: `automation = "${automationId}"`,
    sort: '-version_number',
  })

export const getLatestVersion = (automationId: string) =>
  pb
    .collection('workflow_versions')
    .getFirstListItem<WorkflowVersionRecord>(`automation = "${automationId}"`, {
      sort: '-version_number',
    })
    .catch(() => null)

export const getPublishedVersion = (automationId: string) =>
  pb
    .collection('workflow_versions')
    .getFirstListItem<WorkflowVersionRecord>(
      `automation = "${automationId}" && status = "Publicado"`,
      { sort: '-version_number' },
    )
    .catch(() => null)

export const createVersion = (data: Partial<WorkflowVersionRecord>) =>
  pb.collection('workflow_versions').create<WorkflowVersionRecord>(data)

export const updateVersion = (id: string, data: Partial<WorkflowVersionRecord>) =>
  pb.collection('workflow_versions').update<WorkflowVersionRecord>(id, data)

export const saveDraft = async (
  automationId: string,
  definition: WorkflowDefinition,
  changes?: string,
) => {
  const existing = await pb
    .collection('workflow_versions')
    .getFirstListItem<WorkflowVersionRecord>(
      `automation = "${automationId}" && status = "Rascunho"`,
    )
    .catch(() => null)
  if (existing) {
    return updateVersion(existing.id, { definition: JSON.stringify(definition), changes })
  }
  const versions = await getVersions(automationId)
  const nextNum = versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1
  return createVersion({
    automation: automationId,
    version_number: nextNum,
    status: 'Rascunho',
    definition: JSON.stringify(definition),
    changes,
  })
}

export const publishVersion = async (
  automationId: string,
  definition: WorkflowDefinition,
  reason: string,
  userId: string,
) => {
  const versions = await getVersions(automationId)
  const nextNum = versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1
  const version = await createVersion({
    automation: automationId,
    version_number: nextNum,
    status: 'Publicado',
    definition: JSON.stringify(definition),
    reason,
    published_by: userId,
    published_at: new Date().toISOString(),
  })
  await updateAutomation(automationId, { status: 'Ativa', current_version: nextNum })
  return version
}

export const restoreVersion = async (versionId: string, userId: string) => {
  const version = await pb.collection('workflow_versions').getOne<WorkflowVersionRecord>(versionId)
  const versions = await getVersions(version.automation)
  const nextNum = Math.max(...versions.map((v) => v.version_number)) + 1
  return createVersion({
    automation: version.automation,
    version_number: nextNum,
    status: 'Publicado',
    definition: version.definition,
    reason: `Restaurado da versão ${version.version_number}`,
    published_by: userId,
    published_at: new Date().toISOString(),
  })
}

export const createAuditLog = (data: {
  automation?: string
  user: string
  action: string
  description?: string
  entity_type?: string
  entity_id?: string
  old_values?: any
  new_values?: any
}) => pb.collection('workflow_audit_logs').create(data)

export const getAuditLogs = (automationId?: string) =>
  pb.collection('workflow_audit_logs').getFullList({
    filter: automationId ? `automation = "${automationId}"` : '',
    sort: '-created',
    expand: 'user,automation',
  })
