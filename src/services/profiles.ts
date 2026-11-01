import pb from '@/lib/pocketbase/client'
import {
  ProfileRecord,
  PermissionsMap,
  GRANULAR_SYSTEM_MODULES,
  ProfilePermissionRecord,
  PermissionLevel,
  GranularPermissionValue,
  ProfilePermissionMap,
} from '@/types/profiles'

export const getDefaultPermissions = (allGranted = false): PermissionsMap => {
  const map: PermissionsMap = {}
  GRANULAR_SYSTEM_MODULES.forEach((mod) => {
    map[mod.key] = {
      read: allGranted,
      write: allGranted,
      hidden: !allGranted,
    }
  })
  return map
}

export const getProfiles = async (): Promise<ProfileRecord[]> => {
  return await pb.collection('profiles').getFullList<ProfileRecord>({
    sort: '-is_system,name',
  })
}

export const getProfile = async (id: string): Promise<ProfileRecord> => {
  return await pb.collection('profiles').getOne<ProfileRecord>(id)
}

export const createProfile = async (
  data: Omit<ProfileRecord, 'id' | 'created' | 'updated'>,
): Promise<ProfileRecord> => {
  const record = await pb.collection('profiles').create<ProfileRecord>(data)
  // Seed initial full profile_permissions for newly created profile
  await initializeProfilePermissions(record.id, true)
  return record
}

export const updateProfile = async (
  id: string,
  data: Partial<ProfileRecord>,
): Promise<ProfileRecord> => {
  return await pb.collection('profiles').update<ProfileRecord>(id, data)
}

export const deleteProfile = async (id: string): Promise<boolean> => {
  return await pb.collection('profiles').delete(id)
}

/**
 * Funções para gerenciamento granular na collection `profile_permissions`
 */
export const getProfilePermissions = async (
  profileId: string,
): Promise<ProfilePermissionRecord[]> => {
  try {
    return await pb.collection('profile_permissions').getFullList<ProfilePermissionRecord>({
      filter: `profile = "${profileId}"`,
    })
  } catch (err) {
    console.error('Erro ao buscar profile_permissions:', err)
    return []
  }
}

/**
 * Garante que todas as chaves do catálogo existam na collection para o perfil.
 * Caso falte alguma chave, ela é inserida com `defaultGranted` (true por padrão para não quebrar acesso).
 */
/**
 * Normaliza o nível de permissão vindo do banco ou padrão
 */
export const normalizePermissionLevel = (
  level?: string | null,
  granted = true,
): PermissionLevel => {
  if (level === 'configure' || level === 'edit' || level === 'view') {
    return level
  }
  return granted ? 'edit' : 'view'
}

/**
 * Garante que todas as chaves do catálogo existam na collection para o perfil.
 * Caso falte alguma chave, ela é inserida com `defaultGranted` e nível padrão.
 * Retorna o mapa completo: chave -> { granted, level }
 */
export const initializeProfilePermissions = async (
  profileId: string,
  defaultGranted = true,
  defaultLevel: PermissionLevel = 'edit',
): Promise<ProfilePermissionMap> => {
  const existing = await getProfilePermissions(profileId)
  const map: ProfilePermissionMap = {}
  const existingKeys = new Set<string>()

  existing.forEach((r) => {
    const fullKey = `${r.module_key}.${r.item_key}`
    existingKeys.add(fullKey)
    const level = normalizePermissionLevel(r.level, !!r.granted)
    map[fullKey] = {
      granted: !!r.granted,
      level,
    }
  })

  // Criar registros faltantes
  const promises: Promise<any>[] = []
  for (const mod of GRANULAR_SYSTEM_MODULES) {
    for (const item of mod.items) {
      const fullKey = `${mod.key}.${item.key}`
      if (!existingKeys.has(fullKey)) {
        const itemLevel = item.defaultLevel || defaultLevel
        map[fullKey] = {
          granted: defaultGranted,
          level: itemLevel,
        }
        promises.push(
          pb
            .collection('profile_permissions')
            .create({
              profile: profileId,
              module_key: mod.key,
              item_key: item.key,
              granted: defaultGranted,
              level: itemLevel,
            })
            .catch(() => {}),
        )
      }
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises)
  }

  return map
}

/**
 * Salva a matriz granular completa com níveis (view | edit | configure + sem acesso).
 */
export const saveProfileGranularPermissions = async (
  profileId: string,
  granularMap: ProfilePermissionMap | Record<string, boolean | GranularPermissionValue>,
): Promise<void> => {
  const existing = await getProfilePermissions(profileId)
  const existingByKey: Record<string, ProfilePermissionRecord> = {}
  existing.forEach((r) => {
    existingByKey[`${r.module_key}.${r.item_key}`] = r
  })

  const promises: Promise<any>[] = []

  for (const mod of GRANULAR_SYSTEM_MODULES) {
    for (const item of mod.items) {
      const fullKey = `${mod.key}.${item.key}`
      const val = granularMap[fullKey]
      let isGranted = true
      let level: PermissionLevel = 'edit'

      if (typeof val === 'boolean') {
        isGranted = val
        level = val ? 'edit' : 'view'
      } else if (val && typeof val === 'object') {
        isGranted = !!val.granted
        level = normalizePermissionLevel(val.level, isGranted)
      }

      const existingRec = existingByKey[fullKey]

      if (existingRec) {
        if (existingRec.granted !== isGranted || existingRec.level !== level) {
          promises.push(
            pb.collection('profile_permissions').update(existingRec.id, {
              granted: isGranted,
              level,
            }),
          )
        }
      } else {
        promises.push(
          pb.collection('profile_permissions').create({
            profile: profileId,
            module_key: mod.key,
            item_key: item.key,
            granted: isGranted,
            level,
          }),
        )
      }
    }
  }

  await Promise.all(promises)
}
