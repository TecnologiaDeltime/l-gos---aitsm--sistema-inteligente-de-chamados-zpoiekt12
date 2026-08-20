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

export const createOperator = async (data: CreateOperatorData): Promise<OperatorItem> => {
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  const payload: any = {
    ...data,
    name: fullName,
    active: data.active ?? true,
    emailVisibility: true,
  }

  if (!payload.password) {
    payload.password = 'Skip@Pass'
    payload.passwordConfirm = 'Skip@Pass'
  }

  return await pb.collection('users').create<OperatorItem>(payload)
}

export const updateOperator = async (
  id: string,
  data: UpdateOperatorData,
): Promise<OperatorItem> => {
  const payload: any = { ...data }
  if (data.first_name !== undefined || data.last_name !== undefined) {
    const existing = await getOperator(id)
    const firstName = data.first_name !== undefined ? data.first_name : existing.first_name || ''
    const lastName = data.last_name !== undefined ? data.last_name : existing.last_name || ''
    payload.name = [firstName, lastName].filter(Boolean).join(' ').trim()
  }

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
