import pb from '@/lib/pocketbase/client'
import { OperatorItem, CreateOperatorData, UpdateOperatorData } from '@/types/operators'

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

export const createOperator = async (data: CreateOperatorData): Promise<OperatorItem> => {
  const firstName = (data.first_name || '').trim()
  const lastName = (data.last_name || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const email = (data.email || '').trim().toLowerCase()

  const rawPayload: Record<string, any> = {
    ...data,
    email,
    first_name: firstName,
    last_name: lastName,
    name: fullName || firstName || email,
    active: data.active ?? true,
    emailVisibility: true,
  }

  const initialPassword = data.password && data.password.length >= 8 ? data.password : 'Skip@Pass'
  rawPayload.password = initialPassword
  rawPayload.passwordConfirm = data.passwordConfirm || initialPassword

  // Se o role vier vazio ou não for um enum válido, usa 'tecnico'
  const validRoles = [
    'admin',
    'gestor',
    'tecnico',
    'cliente_gestor',
    'cliente_solicitante',
    'auditor',
  ]
  if (!rawPayload.role || !validRoles.includes(rawPayload.role)) {
    rawPayload.role = 'tecnico'
  }

  // Se type vier vazio ou inválido, usa 'Interno'
  if (rawPayload.type !== 'Interno' && rawPayload.type !== 'Externo') {
    rawPayload.type = 'Interno'
  }

  const payload = cleanPayload(rawPayload)
  return await pb.collection('users').create<OperatorItem>(payload)
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
  })

  return tempPassword
}
