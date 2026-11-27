// Serviço do Inventário de Aparelhos — via pb.send no hook backend A0_inventory.js.
// Padrão do projeto: NUNCA fetch relativo '/backend/...', sempre pb.send('/backend/v1/...').
import pb from '@/lib/pocketbase/client'

export type InventoryDeviceType = 'celular' | 'camera'
export type InventoryDeviceStatus = 'disponivel' | 'em_uso' | 'manutencao' | 'desativado'
export type InventoryDeviceCondition = 'novo' | 'uso' | ''

export interface InventoryDevice {
  id: string
  device_type: InventoryDeviceType
  brand: string
  model: string
  serial_number: string
  phone_number: string
  condition: InventoryDeviceCondition
  status: InventoryDeviceStatus
  assigned_to: string
  assigned_to_name: string
  notes: string
  created: string
  updated: string
}

export interface InventoryDevicePayload {
  device_type: InventoryDeviceType
  brand: string
  model: string
  serial_number?: string
  phone_number?: string
  condition?: InventoryDeviceCondition
  status?: InventoryDeviceStatus
  assigned_to?: string
  notes?: string
}

interface ListResponse {
  devices: InventoryDevice[]
}

interface MutationResponse {
  success: boolean
  id?: string
  status?: string
  error?: string
}

export async function listInventoryDevices(
  params: {
    type?: InventoryDeviceType | ''
    status?: InventoryDeviceStatus | ''
    includeInactive?: boolean
  } = {},
): Promise<InventoryDevice[]> {
  const query: Record<string, string> = {}
  if (params.type) query.type = params.type
  if (params.status) {
    query.status = params.status
  } else if (params.includeInactive) {
    // Consulta explícita: sem filtro de status e sem ocultar desativados
    query.all = '1'
  }
  const res = await pb.send<ListResponse>('/backend/v1/inventory/devices', {
    method: 'GET',
    query,
  })
  return res?.devices || []
}

export async function createInventoryDevice(
  payload: InventoryDevicePayload,
): Promise<InventoryDevice> {
  const res = await pb.send<MutationResponse>('/backend/v1/inventory/devices', {
    method: 'POST',
    body: payload,
  })
  if (!res?.success) throw new Error(res?.error || 'Erro ao cadastrar aparelho')
  return {
    id: res.id || '',
    device_type: payload.device_type,
    brand: payload.brand,
    model: payload.model,
    serial_number: payload.serial_number || '',
    phone_number: payload.phone_number || '',
    condition: payload.condition || 'uso',
    status: payload.status || 'disponivel',
    assigned_to: payload.assigned_to || '',
    assigned_to_name: '',
    notes: payload.notes || '',
    created: '',
    updated: '',
  }
}

export async function updateInventoryDevice(
  id: string,
  payload: Partial<InventoryDevicePayload>,
): Promise<void> {
  const res = await pb.send<MutationResponse>(`/backend/v1/inventory/devices/${id}`, {
    method: 'PUT',
    body: payload,
  })
  if (!res?.success) throw new Error(res?.error || 'Erro ao atualizar aparelho')
}

// Reativar = voltar ao status informado (padrão 'disponivel') via update normal.
export async function activateInventoryDevice(
  id: string,
  payload: { status?: InventoryDeviceStatus } = {},
): Promise<void> {
  await updateInventoryDevice(id, { status: payload.status || 'disponivel' })
}

export async function deactivateInventoryDevice(id: string): Promise<void> {
  const res = await pb.send<MutationResponse>(`/backend/v1/inventory/devices/${id}/deactivate`, {
    method: 'PUT',
    body: {},
  })
  if (!res?.success) throw new Error(res?.error || 'Erro ao desativar aparelho')
}

// ---- Histórico de movimentação ----

export type InventoryMovementType =
  | 'cadastrado'
  | 'atribuido'
  | 'devolvido'
  | 'manutencao'
  | 'editado'
  | 'desativado'
  | 'reativado'
  | 'manual'

export interface InventoryMovement {
  id: string
  movement_type: InventoryMovementType
  description: string
  performed_by_name: string
  previous_owner_name: string
  new_owner_name: string
  created: string
}

interface MovementsResponse {
  movements: InventoryMovement[]
}

// Linha do tempo do aparelho (mais recente primeiro) — inventario_consultar.
export async function listInventoryMovements(id: string): Promise<InventoryMovement[]> {
  const res = await pb.send<MovementsResponse>(`/backend/v1/inventory/devices/${id}/movements`, {
    method: 'GET',
  })
  return res?.movements || []
}

// Tipos de movimentação manual com efeito no aparelho:
// atribuido (troca responsável), devolvido (limpa), manutencao (status), editado/manual (só registro).
export async function addInventoryMovement(
  id: string,
  payload: { movement_type: InventoryMovementType; description: string; new_owner?: string },
): Promise<void> {
  const res = await pb.send<MutationResponse>(`/backend/v1/inventory/devices/${id}/movements`, {
    method: 'POST',
    body: payload,
  })
  if (!res?.success) throw new Error(res?.error || 'Erro ao registrar movimentação')
}
