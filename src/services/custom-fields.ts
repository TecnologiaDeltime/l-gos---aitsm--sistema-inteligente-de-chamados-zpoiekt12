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
  /** Regras de validação (0 = sem regra; required = preenchimento obrigatório). */
  required: boolean
  min_chars: number
  max_chars: number
  min_value: number
  max_value: number
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
    required: Boolean(raw.required),
    min_chars: Number(raw.min_chars ?? 0) || 0,
    max_chars: Number(raw.max_chars ?? 0) || 0,
    min_value: Number(raw.min_value ?? 0) || 0,
    max_value: Number(raw.max_value ?? 0) || 0,
  }
}

/**
 * Valida o valor de um campo contra as regras da definição.
 * Retorna null quando válido, ou a mensagem de erro em português.
 */
export function validateCustomFieldValue(
  def: CustomFieldDef,
  value: CustomFieldValueMap[string],
): string | null {
  const empty = value === null || value === undefined || value === '' || value === false
  if (empty) {
    if (def.required) return 'Campo obrigatório'
    return null
  }

  if (def.field_type === 'numero') {
    const num = Number(value)
    if (!Number.isFinite(num)) return 'Valor deve ser um número válido'
    if (def.min_value > 0 && num < def.min_value && def.max_value > 0 && num > def.max_value) {
      return `Valor deve estar entre ${def.min_value} e ${def.max_value}`
    }
    if (def.min_value > 0 && num < def.min_value) {
      return `Valor deve ser maior ou igual a ${def.min_value}`
    }
    if (def.max_value > 0 && num > def.max_value) {
      return `Valor deve ser menor ou igual a ${def.max_value}`
    }
  } else if (def.field_type === 'texto_curto' || def.field_type === 'texto_longo') {
    const txt = String(value)
    if (def.min_chars > 0 && txt.length < def.min_chars) {
      return `Mínimo de ${def.min_chars} caracteres`
    }
    if (def.max_chars > 0 && txt.length > def.max_chars) {
      return `Máximo de ${def.max_chars} caracteres`
    }
  } else if (def.field_type === 'selecao') {
    if (def.options.indexOf(String(value)) === -1) {
      return 'Escolha uma das opções da lista'
    }
  }

  return null
}

/** Valida todos os valores do card; retorna mapa field_id -> mensagem de erro. */
export function validateCustomFieldValues(
  defs: CustomFieldDef[],
  values: CustomFieldValueMap,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const def of defs) {
    if (!def.active) continue
    const err = validateCustomFieldValue(def, values[def.id] ?? null)
    if (err) errors[def.id] = err
  }
  return errors
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
  /** Regras de validação (opcional; 0/undefined = sem regra). */
  required?: boolean
  min_chars?: number
  max_chars?: number
  min_value?: number
  max_value?: number
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
