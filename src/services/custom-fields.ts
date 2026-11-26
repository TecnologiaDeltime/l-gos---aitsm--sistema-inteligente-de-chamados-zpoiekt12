// Serviço de Campos Customizados da ficha do chamado (LÓGOS AITSM).
// Rotas no hook A0_custom_field_defs.js (Skip Cloud): SEMPRE via pb.send('/backend/v1/...'),
// nunca fetch relativo.
import pb from '@/lib/pocketbase/client'

export type CustomFieldType =
  | 'texto_curto'
  | 'texto_longo'
  | 'numero'
  | 'data'
  | 'selecao'
  | 'sim_nao'

export interface CustomFieldDef {
  id: string
  name: string
  field_type: CustomFieldType
  options: string[]
  sort_order: number
  active: boolean
  created?: string
  updated?: string
}

export type CustomFieldValueMap = Record<string, string | number | boolean | null>

function normalizeDef(raw: Record<string, unknown>): CustomFieldDef {
  let options: string[] = []
  const rawOptions = raw.options
  if (Array.isArray(rawOptions)) {
    options = rawOptions.filter((o): o is string => typeof o === 'string')
  } else if (typeof rawOptions === 'string' && rawOptions.trim()) {
    try {
      const parsed = JSON.parse(rawOptions)
      if (Array.isArray(parsed)) options = parsed.filter((o): o is string => typeof o === 'string')
    } catch {
      options = []
    }
  }
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    field_type: (raw.field_type as CustomFieldType) ?? 'texto_curto',
    options,
    sort_order: Number(raw.sort_order ?? 0),
    active: raw.active !== false && raw.active !== undefined ? Boolean(raw.active) : false,
  }
}

/** Lista as definições. Admin/gestor recebem também as inativas (hook decide). */
export async function listCustomFieldDefs(includeInactive = false): Promise<CustomFieldDef[]> {
  const res = (await pb.send('/backend/v1/tickets/custom-fields/definitions', {
    method: 'GET',
    query: includeInactive ? { include_inactive: '1' } : undefined,
  })) as { fields?: Record<string, unknown>[] }

  const out: CustomFieldDef[] = []
  for (const raw of res?.fields ?? []) out.push(normalizeDef(raw))
  return out
}

export interface CustomFieldDefInput {
  name: string
  field_type: CustomFieldType
  options?: string[]
  sort_order?: number
  active?: boolean
}

export async function createCustomFieldDef(input: CustomFieldDefInput): Promise<CustomFieldDef> {
  const res = (await pb.send('/backend/v1/tickets/custom-fields/definitions', {
    method: 'POST',
    body: input,
  })) as { field?: Record<string, unknown> }
  return normalizeDef(res?.field ?? {})
}

export async function updateCustomFieldDef(
  id: string,
  input: Partial<CustomFieldDefInput>,
): Promise<CustomFieldDef> {
  const res = (await pb.send(`/backend/v1/tickets/custom-fields/definitions/${id}`, {
    method: 'PUT',
    body: input,
  })) as { field?: Record<string, unknown> }
  return normalizeDef(res?.field ?? {})
}

/**
 * "Excluir" = desativar (o hook nunca apaga a definição), preservando os
 * valores já gravados nos chamados.
 */
export async function deactivateCustomFieldDef(id: string): Promise<void> {
  await pb.send(`/backend/v1/tickets/custom-fields/definitions/${id}`, {
    method: 'DELETE',
  })
}

/** Valores gravados de um chamado. */
export async function getTicketCustomFieldValues(ticketId: string): Promise<CustomFieldValueMap> {
  const res = (await pb.send(`/backend/v1/tickets/${ticketId}/custom-fields/values`, {
    method: 'GET',
  })) as { values?: Record<string, unknown> }

  const out: CustomFieldValueMap = {}
  const values = res?.values ?? {}
  for (const key of Object.keys(values)) {
    const v = values[key]
    if (v === null || v === undefined) {
      out[key] = null
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out[key] = v
    } else {
      out[key] = String(v)
    }
  }
  return out
}

/** Salva (ou limpa) os valores de um chamado. Valores vazios são gravados como null. */
export async function saveTicketCustomFieldValues(
  ticketId: string,
  values: CustomFieldValueMap,
): Promise<void> {
  await pb.send(`/backend/v1/tickets/${ticketId}/custom-fields/values`, {
    method: 'PUT',
    body: { values },
  })
}
