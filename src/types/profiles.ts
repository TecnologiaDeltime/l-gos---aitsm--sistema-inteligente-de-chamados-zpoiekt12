export type PermissionLevel = 'read' | 'write' | 'hidden'

export interface ModulePermission {
  read: boolean
  write: boolean
  hidden: boolean
}

export type ModuleKey =
  | 'dashboard'
  | 'tickets'
  | 'tickets_children'
  | 'atendimento'
  | 'cmdb'
  | 'changes'
  | 'problems'
  | 'visits'
  | 'reports'
  | 'settings'
  | 'clients'
  | 'operators'
  | 'profiles'
  | 'sla_dashboard'
  | 'notifications'
  | 'time_tracking'
  | 'vault'
  | 'knowledge'
  | 'admin'

export interface GranularPermissionItem {
  key: string
  label: string
  description?: string
  path?: string // Rota associada para guard
  defaultGranted?: boolean
}

export interface GranularModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  category: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração'
  items: GranularPermissionItem[]
}

import { GRANULAR_SYSTEM_MODULES as REGISTRY_MODULES } from '@/lib/permissions-registry'

export const GRANULAR_SYSTEM_MODULES: GranularModuleDefinition[] = REGISTRY_MODULES
export {
  registerFeature,
  autoRegisterMenuItems,
  getGranularSystemModules,
} from '@/lib/permissions-registry'
// Mapeamento compatível legado
export const SYSTEM_MODULES = GRANULAR_SYSTEM_MODULES.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  category: m.category,
}))

export type PermissionsMap = Record<string, ModulePermission>

export interface ProfileRecord {
  id: string
  name: string
  description?: string
  is_system?: boolean
  permissions: PermissionsMap
  created: string
  updated: string
}

export interface ProfilePermissionRecord {
  id: string
  profile: string
  module_key: string
  item_key: string
  granted: boolean
  created?: string
  updated?: string
}
