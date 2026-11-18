import pb from '@/lib/pocketbase/client'
import { createCompanyAuditLog, getCompanyDepartments } from '@/services/companies'
import type { ClientContactRecord } from '@/services/client-contacts'

export interface PortalCollaboratorRecord {
  id: string
  name: string
  email: string
  company: string
  active: boolean
  created: string
  updated: string
}

export const getPortalCollaborators = (companyId: string) =>
  pb.collection('portal_collaborators').getFullList<PortalCollaboratorRecord>({
    filter: `company = "${companyId}"`,
    sort: 'name',
  })

export const createPortalCollaborator = async (
  data: { name: string; email: string; company: string; active?: boolean },
  userId?: string,
) => {
  const rec = await pb.collection('portal_collaborators').create<PortalCollaboratorRecord>(data)
  if (userId) {
    await createCompanyAuditLog({
      user: userId,
      action: 'created collaborator portal access',
      entity_type: 'portal_collaborators',
      entity_id: rec.id,
      description: `Acesso ao Portal do Colaborador criado para "${data.name}"`,
      new_values: data as unknown as Record<string, unknown>,
    })
  }
  return rec
}

export const updatePortalCollaborator = async (
  id: string,
  data: Partial<PortalCollaboratorRecord>,
  userId?: string,
) => {
  const rec = await pb.collection('portal_collaborators').update<PortalCollaboratorRecord>(id, data)
  if (userId) {
    await createCompanyAuditLog({
      user: userId,
      action: 'updated collaborator portal access',
      entity_type: 'portal_collaborators',
      entity_id: id,
      description: `Acesso ao Portal do Colaborador atualizado (id ${id})`,
      new_values: data as unknown as Record<string, unknown>,
    })
  }
  return rec
}

export const deletePortalCollaborator = async (id: string, userId?: string) => {
  await pb.collection('portal_collaborators').delete(id)
  if (userId) {
    await createCompanyAuditLog({
      user: userId,
      action: 'deleted collaborator portal access',
      entity_type: 'portal_collaborators',
      entity_id: id,
      description: `Acesso ao Portal do Colaborador excluído (id ${id})`,
    })
  }
}

export const resetPortalCollaboratorPassword = async (
  id: string,
  password: string,
  userId?: string,
) => {
  await pb.collection('portal_collaborators').update(id, { password })
  if (userId) {
    await createCompanyAuditLog({
      user: userId,
      action: 'reset collaborator portal password',
      entity_type: 'portal_collaborators',
      entity_id: id,
      description: 'Senha do Portal do Colaborador redefinida pelo admin',
    })
  }
}

// ---------------------------------------------------------------------------
// Bloco de permissões: catálogo clients / item clients_collaborator_portal
// ---------------------------------------------------------------------------

export const COLLABORATOR_PORTAL_ITEM = 'clients_collaborator_portal'

export async function getCollaboratorPortalSetting(): Promise<boolean> {
  const settings = await pb.collection('system_settings').getFullList({
    filter: `key = "collaborator_portal"`,
  })
  const rec = settings[0]
  if (!rec) return false
  return Boolean((rec as unknown as Record<string, unknown>).collaborator_survey_required)
}

export async function setCollaboratorPortalSetting(required: boolean): Promise<void> {
  const settings = await pb.collection('system_settings').getFullList({
    filter: `key = "collaborator_portal"`,
  })
  const rec = settings[0]
  if (rec) {
    await pb
      .collection('system_settings')
      .update(rec.id, { collaborator_survey_required: required } as never)
    return
  }
  await pb
    .collection('system_settings')
    .create({ key: 'collaborator_portal', collaborator_survey_required: required } as never)
}

// ---------------------------------------------------------------------------
// Utilitário usado pela tela de administração (união dos dados necessários)
// ---------------------------------------------------------------------------

export interface CollaboratorAdminContext {
  contacts: ClientContactRecord[]
  departments: { id: string; name: string; parent?: string }[]
  branches: { id: string; name: string }[]
}

export async function loadCollaboratorAdminContext(
  clientId: string,
): Promise<CollaboratorAdminContext> {
  const [contacts, departments, branches] = await Promise.all([
    pb.collection('client_contacts').getFullList({ filter: `client = "${clientId}"` }),
    getCompanyDepartments(clientId),
    getCompanyUnitsByCompany(clientId),
  ])
  return { contacts, departments, branches } as unknown as CollaboratorAdminContext
}
