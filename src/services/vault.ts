import pb from '@/lib/pocketbase/client'
import { ProfileRecord } from '@/types/profiles'
import { CompanyRecord } from '@/services/companies'

export type CredentialType = 'Portal' | 'Equipamento' | 'Aplicação'
export type EnvironmentType =
  | 'Produção'
  | 'Homologação'
  | 'Teste'
  | 'Desenvolvimento'
  | 'DR / Contingência'

export type VaultAuditAction =
  | 'PASSWORD_VIEWED'
  | 'PASSWORD_VIEW_FAILED_AUTH'
  | 'PASSWORD_VIEW_DENIED_PROFILE'
  | 'CREDENTIAL_CREATED'
  | 'CREDENTIAL_UPDATED'
  | 'CREDENTIAL_DELETED'

export type VaultAuditStatus = 'SUCCESS' | 'DENIED' | 'FAILED'

export interface VaultCredential {
  id: string
  company: string
  type: CredentialType
  name: string
  environment: EnvironmentType
  url_or_address?: string
  username: string
  password?: string // Oculta na listagem comum do cliente por segurança
  notes?: string
  allowed_profiles?: string[]
  created_by?: string
  updated_by?: string
  created: string
  updated: string
  expand?: {
    company?: CompanyRecord
    allowed_profiles?: ProfileRecord[]
    created_by?: { id: string; name: string; email: string }
    updated_by?: { id: string; name: string; email: string }
  }
}

export interface VaultAuditLog {
  id: string
  credential?: string
  credential_name?: string
  client_name?: string
  operator?: string
  operator_name?: string
  operator_email?: string
  action: VaultAuditAction
  status: VaultAuditStatus
  reason?: string
  ip_address?: string
  user_agent?: string
  details?: any
  created: string
  updated: string
  expand?: {
    credential?: VaultCredential
    operator?: { id: string; name: string; email: string }
  }
}

export interface RevealCredentialRequest {
  credential_id: string
  operator_login: string
  operator_password: string
}

export interface RevealCredentialResponse {
  success: boolean
  username: string
  password: string
  revealed_at: string
}

/**
 * Busca lista de credenciais cadastradas no cofre
 */
export async function getVaultCredentials(params?: {
  companyId?: string
  type?: string
  environment?: string
  search?: string
}): Promise<VaultCredential[]> {
  const filterParts: string[] = []

  if (params?.companyId && params.companyId !== 'all') {
    filterParts.push(`company = "${params.companyId}"`)
  }
  if (params?.type && params.type !== 'all') {
    filterParts.push(`type = "${params.type}"`)
  }
  if (params?.environment && params.environment !== 'all') {
    filterParts.push(`environment = "${params.environment}"`)
  }
  if (params?.search && params.search.trim()) {
    const s = params.search.trim()
    filterParts.push(`(name ~ "${s}" || username ~ "${s}" || notes ~ "${s}")`)
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('vault_credentials').getFullList<VaultCredential>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'company,allowed_profiles,created_by,updated_by',
  })
}

/**
 * Busca detalhes de uma credencial específica
 */
export async function getVaultCredentialById(id: string): Promise<VaultCredential> {
  return await pb.collection('vault_credentials').getOne<VaultCredential>(id, {
    expand: 'company,allowed_profiles,created_by,updated_by',
  })
}

/**
 * Cria uma nova credencial no cofre com auditoria obrigatória do criador, data e horário
 */
export async function createVaultCredential(data: {
  company: string
  type: CredentialType
  name: string
  environment: EnvironmentType
  url_or_address?: string
  username: string
  password: string
  notes?: string
  allowed_profiles?: string[]
  client_name?: string
}): Promise<VaultCredential> {
  const currentUserId = pb.authStore.record?.id

  const record = await pb.collection('vault_credentials').create<VaultCredential>({
    ...data,
    created_by: currentUserId,
    updated_by: currentUserId,
  })

  // Registra no log de auditoria do cofre: operador que criou com data e horário
  try {
    await recordVaultAudit({
      action: 'CREDENTIAL_CREATED',
      credential_id: record.id,
      credential_name: record.name,
      client_name: data.client_name || '',
      reason: `Credencial "${record.name}" criada no ambiente ${record.environment}`,
      details: {
        type: record.type,
        environment: record.environment,
        allowed_profiles_count: data.allowed_profiles?.length || 0,
      },
    })
  } catch (err) {
    console.error('Falha ao auditar criação de credencial:', err)
  }

  return record
}

/**
 * Atualiza uma credencial do cofre com auditoria
 */
export async function updateVaultCredential(
  id: string,
  data: Partial<{
    company: string
    type: CredentialType
    name: string
    environment: EnvironmentType
    url_or_address?: string
    username: string
    password: string
    notes?: string
    allowed_profiles?: string[]
    client_name?: string
  }>,
): Promise<VaultCredential> {
  const currentUserId = pb.authStore.record?.id

  const record = await pb.collection('vault_credentials').update<VaultCredential>(id, {
    ...data,
    updated_by: currentUserId,
  })

  // Registra no log de auditoria
  try {
    await recordVaultAudit({
      action: 'CREDENTIAL_UPDATED',
      credential_id: record.id,
      credential_name: record.name,
      client_name: data.client_name || '',
      reason: `Credencial "${record.name}" atualizada`,
      details: {
        updated_fields: Object.keys(data).filter((k) => k !== 'password' && k !== 'client_name'),
        password_changed: !!data.password,
      },
    })
  } catch (err) {
    console.error('Falha ao auditar atualização de credencial:', err)
  }

  return record
}

/**
 * Exclui uma credencial do cofre com auditoria prévia
 */
export async function deleteVaultCredential(
  credential: VaultCredential,
  clientName?: string,
): Promise<boolean> {
  // Registra a exclusão antes de deletar
  try {
    await recordVaultAudit({
      action: 'CREDENTIAL_DELETED',
      credential_id: credential.id,
      credential_name: credential.name,
      client_name: clientName || credential.expand?.company?.trade_name || '',
      reason: `Credencial "${credential.name}" foi excluída do cofre`,
      details: {
        environment: credential.environment,
        type: credential.type,
      },
    })
  } catch (err) {
    console.error('Falha ao auditar exclusão de credencial:', err)
  }

  return await pb.collection('vault_credentials').delete(credential.id)
}

/**
 * Reautentica o operador e revela a senha se tiver autorização, gravando o log com timestamp
 */
export async function revealCredential(
  params: RevealCredentialRequest,
): Promise<RevealCredentialResponse> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL

  const res = await fetch(`${baseUrl}/backend/v1/vault/reveal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(params),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || 'Falha ao reautenticar operador.')
  }

  return json as RevealCredentialResponse
}

/**
 * Registra um evento de auditoria no cofre
 */
export async function recordVaultAudit(data: {
  action: VaultAuditAction
  credential_id?: string
  credential_name?: string
  client_name?: string
  reason?: string
  details?: any
}): Promise<void> {
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL

  await fetch(`${baseUrl}/backend/v1/vault/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  })
}

/**
 * Consulta registros de auditoria do cofre com paginação e filtros
 */
export async function getVaultAuditLogs(params?: {
  page?: number
  perPage?: number
  operatorId?: string
  action?: string
  status?: string
  startDate?: string
  endDate?: string
  search?: string
}) {
  const page = params?.page || 1
  const perPage = params?.perPage || 30
  const filterParts: string[] = []

  if (params?.operatorId && params.operatorId !== 'all') {
    filterParts.push(`operator = "${params.operatorId}"`)
  }
  if (params?.action && params.action !== 'all') {
    filterParts.push(`action = "${params.action}"`)
  }
  if (params?.status && params.status !== 'all') {
    filterParts.push(`status = "${params.status}"`)
  }
  if (params?.startDate) {
    filterParts.push(`created >= "${params.startDate} 00:00:00"`)
  }
  if (params?.endDate) {
    filterParts.push(`created <= "${params.endDate} 23:59:59"`)
  }
  if (params?.search && params.search.trim()) {
    const s = params.search.trim()
    filterParts.push(
      `(credential_name ~ "${s}" || client_name ~ "${s}" || operator_name ~ "${s}" || operator_email ~ "${s}" || reason ~ "${s}")`,
    )
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('vault_audit_logs').getList<VaultAuditLog>(page, perPage, {
    filter: filter || undefined,
    sort: '-created',
    expand: 'credential,operator',
  })
}

/**
 * Busca todos os registros de auditoria para exportação CSV
 */
export async function getAllVaultAuditLogs(params?: {
  operatorId?: string
  action?: string
  status?: string
  startDate?: string
  endDate?: string
  search?: string
}): Promise<VaultAuditLog[]> {
  const filterParts: string[] = []

  if (params?.operatorId && params.operatorId !== 'all') {
    filterParts.push(`operator = "${params.operatorId}"`)
  }
  if (params?.action && params.action !== 'all') {
    filterParts.push(`action = "${params.action}"`)
  }
  if (params?.status && params.status !== 'all') {
    filterParts.push(`status = "${params.status}"`)
  }
  if (params?.startDate) {
    filterParts.push(`created >= "${params.startDate} 00:00:00"`)
  }
  if (params?.endDate) {
    filterParts.push(`created <= "${params.endDate} 23:59:59"`)
  }
  if (params?.search && params.search.trim()) {
    const s = params.search.trim()
    filterParts.push(
      `(credential_name ~ "${s}" || client_name ~ "${s}" || operator_name ~ "${s}" || operator_email ~ "${s}" || reason ~ "${s}")`,
    )
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('vault_audit_logs').getFullList<VaultAuditLog>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'credential,operator',
  })
}
