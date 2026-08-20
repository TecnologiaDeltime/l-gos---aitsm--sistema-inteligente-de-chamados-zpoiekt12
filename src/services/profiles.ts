import pb from '@/lib/pocketbase/client'
import { ProfileRecord, PermissionsMap, SYSTEM_MODULES, ModuleKey } from '@/types/profiles'

export const getDefaultPermissions = (allGranted = false): PermissionsMap => {
  const map: Partial<PermissionsMap> = {}
  SYSTEM_MODULES.forEach((mod) => {
    map[mod.key] = {
      read: allGranted,
      write: allGranted,
      hidden: !allGranted,
    }
  })
  return map as PermissionsMap
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
  return await pb.collection('profiles').create<ProfileRecord>(data)
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
