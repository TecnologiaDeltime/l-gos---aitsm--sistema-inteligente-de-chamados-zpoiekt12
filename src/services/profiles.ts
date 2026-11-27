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
import { moduleAccessFullKey } from '@/lib/permissions-registry'

/**
 * Erros 429 (Too Many Requests) do backend: o seed/salvamento da matriz
 * granular pode gerar >100 writes de uma vez e o rate limit rejeita o excesso.
 * Retentamos com backoff crescente em vez de abortar o save inteiro.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimitError = (err: any): boolean => err?.status === 429 || err?.response?.status === 429

async function writePermissionWithRetry(op: () => Promise<any>, retries = 5): Promise<any> {
  try {
    return await op()
  } catch (err: any) {
    if (isRateLimitError(err) && retries > 0) {
      await sleep(400 * (6 - retries))
      return writePermissionWithRetry(op, retries - 1)
    }
    throw err
  }
}

/**
 * Executa writes de permissões em lotes pequenos e sequenciais para não
 * estourar o rate limit do backend (evita o erro genérico de "Save").
 */
async function runPermissionWritesBatches(
  ops: Array<() => Promise<any>>,
  batchSize = 6,
): Promise<void> {
  for (let i = 0; i < ops.length; i += batchSize) {
    await Promise.all(ops.slice(i, i + batchSize).map((op) => writePermissionWithRetry(op)))
  }
}

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

  // Criar registros faltantes em lotes (evita 429 Too Many Requests)
  const ops: Array<() => Promise<any>> = []
  for (const mod of GRANULAR_SYSTEM_MODULES) {
    // Toggle implícito de acesso ao módulo inteiro (chave reservada __module):
    // semeado liberado por padrão — só persiste explicitamente quando o admin
    // bloquear/liberar, e a ausência do registro mantém o módulo liberado.
    const modAccessFullKey = moduleAccessFullKey(mod.key)
    if (!existingKeys.has(modAccessFullKey)) {
      map[modAccessFullKey] = {
        granted: true,
        level: defaultLevel,
      }
    }
    for (const item of mod.items) {
      const fullKey = `${mod.key}.${item.key}`
      if (!existingKeys.has(fullKey)) {
        const itemLevel = item.defaultLevel || defaultLevel
        map[fullKey] = {
          granted: defaultGranted,
          level: itemLevel,
        }
        ops.push(() =>
          pb.collection('profile_permissions').create({
            profile: profileId,
            module_key: mod.key,
            item_key: item.key,
            granted: defaultGranted,
            level: itemLevel,
          }),
        )
      }
    }
  }

  // Falha de duplicidade (corrida entre chamadas simultâneas) não deve quebrar o fluxo
  await runPermissionWritesBatches(ops).catch(() => {})

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

  const ops: Array<() => Promise<any>> = []

  for (const mod of GRANULAR_SYSTEM_MODULES) {
    // Persistir o toggle de acesso ao módulo inteiro (chave reservada __module)
    const modAccessFullKey = moduleAccessFullKey(mod.key)
    const modAccessVal = granularMap[modAccessFullKey]
    let modAccessGranted = true
    let modAccessLevel: PermissionLevel = 'edit'
    if (typeof modAccessVal === 'boolean') {
      modAccessGranted = modAccessVal
      modAccessLevel = modAccessVal ? 'edit' : 'view'
    } else if (modAccessVal && typeof modAccessVal === 'object') {
      modAccessGranted = !!modAccessVal.granted
      modAccessLevel = normalizePermissionLevel(modAccessVal.level, modAccessGranted)
    }

    const modAccessRec = existingByKey[modAccessFullKey]
    if (modAccessRec) {
      if (modAccessRec.granted !== modAccessGranted || modAccessRec.level !== modAccessLevel) {
        ops.push(() =>
          pb.collection('profile_permissions').update(modAccessRec.id, {
            granted: modAccessGranted,
            level: modAccessLevel,
          }),
        )
      }
    } else {
      ops.push(() =>
        pb.collection('profile_permissions').create({
          profile: profileId,
          module_key: mod.key,
          item_key: '__module',
          granted: modAccessGranted,
          level: modAccessLevel,
        }),
      )
    }

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
          ops.push(() =>
            pb.collection('profile_permissions').update(existingRec.id, {
              granted: isGranted,
              level,
            }),
          )
        }
      } else {
        ops.push(() =>
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

  await runPermissionWritesBatches(ops)
}
