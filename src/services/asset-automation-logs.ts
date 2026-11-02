import pb from '@/lib/pocketbase/client'

export type AssetAutomationActionType =
  | 'exclusao_usuario'
  | 'exclusao_ativo'
  | 'mudanca_status'
  | 'cancelamento_exclusao_usuario'
  | 'cancelamento_exclusao_ativo'

export interface AssetAutomationLogRecord {
  id: string
  operator?: string
  operator_name?: string
  action_type: AssetAutomationActionType
  description?: string
  equipment_id?: string
  equipment_name?: string
  target_user_name?: string
  target_user_id?: string
  details?: Record<string, any>
  created: string
  updated: string
  expand?: {
    operator?: {
      id: string
      name?: string
      email?: string
    }
  }
}

export interface CreateAssetAutomationLogParams {
  operator?: string
  operator_name?: string
  action_type: AssetAutomationActionType
  description?: string
  equipment_id?: string
  equipment_name?: string
  target_user_name?: string
  target_user_id?: string
  details?: Record<string, any>
}

export async function createAssetAutomationLog(
  params: CreateAssetAutomationLogParams,
): Promise<AssetAutomationLogRecord> {
  const authUser = pb.authStore.model
  const operatorId = params.operator || authUser?.id || undefined
  const operatorName =
    params.operator_name || authUser?.name || authUser?.email || 'Operador do Sistema'

  return await pb.collection('asset_automation_logs').create<AssetAutomationLogRecord>({
    ...params,
    operator: operatorId,
    operator_name: operatorName,
  })
}

export interface GetAssetAutomationLogsFilter {
  startDate?: string
  endDate?: string
  actionType?: string
  equipmentId?: string
  search?: string
}

export async function getAssetAutomationLogs(
  filters?: GetAssetAutomationLogsFilter,
): Promise<AssetAutomationLogRecord[]> {
  const parts: string[] = []

  if (filters?.actionType && filters.actionType !== 'all') {
    parts.push(`action_type = "${filters.actionType}"`)
  }
  if (filters?.equipmentId) {
    parts.push(`equipment_id = "${filters.equipmentId}"`)
  }
  if (filters?.startDate) {
    parts.push(`created >= "${filters.startDate} 00:00:00"`)
  }
  if (filters?.endDate) {
    parts.push(`created <= "${filters.endDate} 23:59:59"`)
  }
  if (filters?.search) {
    const s = filters.search.replace(/"/g, '')
    parts.push(
      `(operator_name ~ "${s}" || equipment_name ~ "${s}" || target_user_name ~ "${s}" || description ~ "${s}")`,
    )
  }

  const filter = parts.join(' && ')
  return await pb.collection('asset_automation_logs').getFullList<AssetAutomationLogRecord>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'operator',
  })
}

/**
 * Busca equipamentos vinculados a um usuário (por ID de usuário, ID de contato ou nome).
 */
export async function findEquipmentsByResponsible(userQuery: {
  id?: string
  name?: string
  contactId?: string
}): Promise<
  Array<{
    id: string
    name: string
    hostname?: string
    owner?: string
    responsible_user?: string
    availability_status?: string
  }>
> {
  const terms: string[] = []
  if (userQuery.id) {
    terms.push(`responsible_user = "${userQuery.id}"`)
    terms.push(`owner = "${userQuery.id}"`)
  }
  if (userQuery.contactId) {
    terms.push(`responsible_user = "${userQuery.contactId}"`)
    terms.push(`owner = "${userQuery.contactId}"`)
  }
  if (userQuery.name && userQuery.name.trim()) {
    const n = userQuery.name.trim().replace(/"/g, '')
    terms.push(`responsible_user = "${n}"`)
    terms.push(`owner = "${n}"`)
  }

  if (terms.length === 0) return []

  const filter = `(${terms.join(' || ')})`
  try {
    const records = await pb.collection('equipments').getFullList<any>({
      filter,
      fields: 'id,name,hostname,owner,responsible_user,availability_status',
    })
    return records
  } catch (err) {
    console.warn('findEquipmentsByResponsible error:', err)
    return []
  }
}

/**
 * Atualiza os equipamentos vinculados a um usuário para o status "Disponível".
 */
export async function setEquipmentsAvailableForUser(
  equipments: Array<{ id: string; name: string }>,
  targetUser: { id?: string; name: string },
  operatorName?: string,
): Promise<void> {
  for (const eq of equipments) {
    try {
      await pb.collection('equipments').update(eq.id, {
        availability_status: 'Disponível',
      })
      await createAssetAutomationLog({
        action_type: 'mudanca_status',
        equipment_id: eq.id,
        equipment_name: eq.name,
        target_user_id: targetUser.id,
        target_user_name: targetUser.name,
        operator_name: operatorName,
        description: `Status do equipamento "${eq.name}" alterado automaticamente para "Disponível" devido à exclusão do usuário responsável "${targetUser.name}".`,
        details: {
          previous_status: 'Em uso',
          new_status: 'Disponível',
          reason: 'exclusao_usuario_responsavel',
        },
      })
    } catch (err) {
      console.error(`Falha ao atualizar equipamento ${eq.id} para Disponível:`, err)
    }
  }
}
