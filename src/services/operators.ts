import pb from '@/lib/pocketbase/client'
import {
  OperatorItem,
  CreateOperatorData,
  UpdateOperatorData,
  CreateOperatorResponse,
} from '@/types/operators'

export const getOperators = async (options?: {
  search?: string
  status?: string
  team?: string
  profileId?: string
}): Promise<OperatorItem[]> => {
  const filters: string[] = []

  if (options?.status === 'active') {
    filters.push('active = true')
  } else if (options?.status === 'inactive') {
    filters.push('active = false')
  }

  if (options?.team && options.team !== 'all') {
    filters.push(`team = "${options.team}"`)
  }

  if (options?.profileId && options.profileId !== 'all') {
    filters.push(`profile_id = "${options.profileId}"`)
  }

  if (options?.search?.trim()) {
    const q = options.search.trim().replace(/"/g, '\\"')
    filters.push(
      `(name ~ "${q}" || first_name ~ "${q}" || last_name ~ "${q}" || email ~ "${q}" || extension ~ "${q}" || mobile ~ "${q}")`,
    )
  }

  const filter = filters.length > 0 ? filters.join(' && ') : undefined

  return await pb.collection('users').getFullList<OperatorItem>({
    filter,
    sort: 'name',
    expand: 'profile_id,company',
  })
}

export const getOperator = async (id: string): Promise<OperatorItem> => {
  return await pb.collection('users').getOne<OperatorItem>(id, {
    expand: 'profile_id,company',
  })
}

const cleanPayload = (data: Record<string, any>): Record<string, any> => {
  const cleaned: Record<string, any> = {}
  for (const [key, val] of Object.entries(data)) {
    // Omite undefined
    if (val === undefined) continue
    // Se for string vazia em campos relation, omite para evitar "Cannot be empty relation" ou validação de ID
    if (
      typeof val === 'string' &&
      val.trim() === '' &&
      ['company', 'unit', 'profile_id'].includes(key)
    ) {
      continue
    }
    // Normaliza strings aparando espaços
    if (typeof val === 'string') {
      cleaned[key] = val.trim()
    } else {
      cleaned[key] = val
    }
  }
  return cleaned
}

export const createOperator = async (data: CreateOperatorData): Promise<CreateOperatorResponse> => {
  const firstName = (data.first_name || '').trim()
  const lastName = (data.last_name || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const email = (data.email || '').trim().toLowerCase()

  const initialPassword =
    data.password && data.password.length >= 8 ? data.password : 'Skip@Pass123'
  const passwordConfirm = data.passwordConfirm || initialPassword

  const validRoles = [
    'admin',
    'gestor',
    'tecnico',
    'cliente_gestor',
    'cliente_solicitante',
    'auditor',
  ]
  const role = data.role && validRoles.includes(data.role) ? data.role : 'tecnico'
  const type = data.type === 'Externo' ? 'Externo' : 'Interno'

  const rawPayload: Record<string, any> = {
    ...data,
    email,
    password: initialPassword,
    passwordConfirm: passwordConfirm,
    first_name: firstName,
    last_name: lastName,
    name: fullName || firstName || email,
    role,
    type,
    active: data.active ?? true,
    must_change_password: true,
  }

  const payload = cleanPayload(rawPayload)

  // 1. Tenta a rota dedicada backend (com envio de e-mail de primeiro acesso e senha)
  try {
    const res = await pb.send<{
      success: boolean
      record: OperatorItem
      email_sent: boolean
      email_error?: string | null
      message: string
    }>('/backend/v1/operators/create', {
      method: 'POST',
      body: payload,
    })

    if (res && res.success) {
      return {
        record: res.record,
        email_sent: !!res.email_sent,
        email_error: res.email_error,
        message: res.message || 'Operador criado com sucesso!',
      }
    }
  } catch (backendErr: any) {
    // Se a rota retornou erro de validação (ex: e-mail já existe, senha curta), repassa diretamente
    if (backendErr?.status && backendErr.status < 500) {
      const serverMessage =
        backendErr?.response?.error ||
        backendErr?.data?.error ||
        backendErr?.message ||
        'Erro ao criar operador'
      throw new Error(serverMessage)
    }
    // Se a rota personalizada não estiver disponível (ex: 404), tenta fallback direto na coleção
    console.warn(
      'Rota /backend/v1/operators/create falhou, tentando fallback direto na coleção:',
      backendErr,
    )
  }

  // 2. Fallback: criação direta na coleção users
  const createdRecord = await pb.collection('users').create<OperatorItem>(payload)
  return {
    record: createdRecord,
    email_sent: false,
    email_error: 'E-mail automático indisponível via fallback direto.',
    message:
      'Operador criado com sucesso. O e-mail de primeiro acesso deve ser enviado manualmente.',
  }
}

export const updateOperator = async (
  id: string,
  data: UpdateOperatorData,
): Promise<OperatorItem> => {
  const rawPayload: Record<string, any> = { ...data }
  if (data.email) {
    rawPayload.email = data.email.trim().toLowerCase()
  }

  if (data.first_name !== undefined || data.last_name !== undefined) {
    const existing = await getOperator(id)
    const firstName =
      data.first_name !== undefined
        ? (data.first_name || '').trim()
        : (existing.first_name || '').trim()
    const lastName =
      data.last_name !== undefined
        ? (data.last_name || '').trim()
        : (existing.last_name || '').trim()
    rawPayload.first_name = firstName
    rawPayload.last_name = lastName
    rawPayload.name =
      [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || existing.email
  }

  // Se password foi informado na atualização, valida e inclui confirmação se ausente
  if (rawPayload.password && !rawPayload.passwordConfirm) {
    rawPayload.passwordConfirm = rawPayload.password
  }

  const payload = cleanPayload(rawPayload)
  return await pb.collection('users').update<OperatorItem>(id, payload)
}

export const deleteOperator = async (id: string): Promise<boolean> => {
  // 1. Tenta a rota dedicada backend (com verificação de vínculos operacionais e permissão de admin)
  try {
    const res = await pb.send<{
      success: boolean
      message?: string
    }>(`/backend/v1/operators/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (res && res.success) {
      return true
    }
  } catch (backendErr: any) {
    if (backendErr?.status && backendErr.status < 500) {
      const serverMessage =
        backendErr?.response?.error ||
        backendErr?.data?.error ||
        backendErr?.message ||
        'Erro ao excluir operador'
      throw new Error(serverMessage)
    }
    console.warn(
      'Rota /backend/v1/operators/:id falhou ou indisponível, tentando fallback na coleção users:',
      backendErr,
    )
  }

  // 2. Fallback direto na coleção users
  return await pb.collection('users').delete(id)
}

export const resetOperatorPassword = async (id: string): Promise<string> => {
  // Generate secure temporary password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  let tempPassword = 'P@'
  for (let i = 0; i < 8; i++) {
    tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  tempPassword += '8x'

  await pb.collection('users').update(id, {
    password: tempPassword,
    passwordConfirm: tempPassword,
    must_change_password: true,
  })

  return tempPassword
}
