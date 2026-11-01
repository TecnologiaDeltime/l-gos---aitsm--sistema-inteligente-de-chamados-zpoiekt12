import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  ModuleKey,
  ProfileRecord,
  GRANULAR_SYSTEM_MODULES,
  PermissionLevel,
  GranularPermissionValue,
  ProfilePermissionMap,
} from '@/types/profiles'
import { getProfilePermissions, normalizePermissionLevel } from '@/services/profiles'
import pb from '@/lib/pocketbase/client'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || 'cliente_solicitante'
  const profile = user?.expand?.profile_id as ProfileRecord | undefined

  const isAdmin = role === 'admin'
  const isGestor = role === 'gestor' || isAdmin
  const isTecnico = role === 'tecnico' || isGestor
  const isClienteGestor = role === 'cliente_gestor'
  const isCliente = role === 'cliente_solicitante' || isClienteGestor

  // Mapa de permissões granulares carregadas da collection profile_permissions
  // fullKey (module.item) -> { granted: boolean, level: 'view' | 'edit' | 'configure' }
  const [granularPermissions, setGranularPermissions] = useState<ProfilePermissionMap>({})
  const [loadingGranular, setLoadingGranular] = useState(false)

  const profileId = profile?.id || user?.profile_id

  const loadGranular = useCallback(async () => {
    if (!profileId || isAdmin) {
      setGranularPermissions({})
      return
    }

    try {
      setLoadingGranular(true)
      const list = await getProfilePermissions(profileId)
      const map: ProfilePermissionMap = {}
      list.forEach((r) => {
        const isGranted = !!r.granted
        const level = normalizePermissionLevel(r.level, isGranted)
        map[`${r.module_key}.${r.item_key}`] = {
          granted: isGranted,
          level,
        }
      })
      setGranularPermissions(map)
    } catch (err) {
      console.error('Erro ao carregar permissões granulares:', err)
    } finally {
      setLoadingGranular(false)
    }
  }, [profileId, isAdmin])

  useEffect(() => {
    loadGranular()
  }, [loadGranular])

  // Realtime subscription para atualizar permissões caso o Admin altere
  useEffect(() => {
    if (!profileId || isAdmin) return

    let unsubscribe: (() => void) | undefined
    pb.collection('profile_permissions')
      .subscribe('*', (e) => {
        if (e.record && (e.record as any).profile === profileId) {
          loadGranular()
        }
      })
      .then((unsub) => {
        unsubscribe = unsub
      })
      .catch(() => {})

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [profileId, isAdmin, loadGranular])

  /**
   * Helper to check granular module permissions (leitura/escrita/oculto)
   * Administrador tem SEMPRE acesso total (ignora a matriz).
   */
  const getModulePermission = (
    moduleKey: ModuleKey,
  ): { read: boolean; write: boolean; hidden: boolean } => {
    if (isAdmin) {
      return { read: true, write: true, hidden: false }
    }

    if (profile?.permissions?.[moduleKey]) {
      const p = profile.permissions[moduleKey]
      if (p.hidden) {
        return { read: false, write: false, hidden: true }
      }
      return {
        read: !!p.read,
        write: !!p.write,
        hidden: false,
      }
    }

    // Default fallback based on legacy role if profile not assigned yet
    switch (moduleKey) {
      case 'dashboard':
        return { read: true, write: !isCliente, hidden: false }
      case 'tickets':
        return { read: true, write: true, hidden: false }
      case 'tickets_children':
        return {
          read: isTecnico || isClienteGestor,
          write: isTecnico,
          hidden: !isTecnico && !isClienteGestor,
        }
      case 'cmdb':
        return { read: isTecnico, write: isGestor, hidden: !isTecnico }
      case 'changes':
        return { read: true, write: isTecnico, hidden: false }
      case 'problems':
        return { read: true, write: isTecnico, hidden: false }
      case 'visits':
        return { read: true, write: isTecnico, hidden: false }
      case 'atendimento':
        return { read: true, write: true, hidden: false }
      case 'reports':
        return {
          read: isTecnico || isClienteGestor,
          write: isGestor,
          hidden: !isTecnico && !isClienteGestor,
        }
      case 'settings':
        return { read: isAdmin, write: isAdmin, hidden: !isAdmin }
      case 'clients':
        return { read: isGestor, write: isGestor, hidden: !isGestor }
      case 'operators':
        return {
          read: isAdmin || isGestor,
          write: isAdmin || isGestor,
          hidden: !isAdmin && !isGestor,
        }
      case 'profiles':
        return { read: isAdmin, write: isAdmin, hidden: !isAdmin }
      case 'vault':
        return {
          read: isAdmin || isGestor || isTecnico,
          write: isAdmin || isGestor,
          hidden: !isAdmin && !isGestor && !isTecnico,
        }
      case 'sla_dashboard':
        return { read: isTecnico || isClienteGestor, write: isGestor, hidden: false }
      case 'notifications':
        return { read: true, write: true, hidden: false }
      case 'time_tracking':
        return { read: isTecnico, write: isTecnico, hidden: !isTecnico }
      case 'knowledge':
        return { read: true, write: isTecnico, hidden: false }
      case 'admin':
        return { read: isAdmin, write: isAdmin, hidden: !isAdmin }
      default:
        return { read: true, write: false, hidden: false }
    }
  }

  const canReadModule = (mod: ModuleKey) => {
    const perm = getModulePermission(mod)
    return !perm.hidden && perm.read
  }

  const canWriteModule = (mod: ModuleKey) => {
    const perm = getModulePermission(mod)
    return !perm.hidden && perm.write
  }

  const isModuleHidden = (mod: ModuleKey) => {
    const perm = getModulePermission(mod)
    return perm.hidden
  }

  /**
   * Resolve o objeto { granted, level } para um item ou módulo.
   * Pode ser chamado com:
   * - (moduleKey, itemKey) -> ex: getItemPermission('tickets', 'tickets_fila')
   * - (key) onde key é 'module.item' ou apenas 'module' ou 'item'
   */
  const getItemPermission = (
    moduleOrKey: ModuleKey | string,
    optionalItemKey?: string,
  ): GranularPermissionValue => {
    if (isAdmin) {
      return { granted: true, level: 'configure' }
    }

    let fullKey = ''
    let modKey: ModuleKey | undefined

    if (optionalItemKey) {
      modKey = moduleOrKey as ModuleKey
      fullKey = `${moduleOrKey}.${optionalItemKey}`
    } else if (moduleOrKey.includes('.')) {
      fullKey = moduleOrKey
      modKey = moduleOrKey.split('.')[0] as ModuleKey
    } else {
      // Pode ser apenas item_key ou apenas moduleKey
      // 1. Procurar no catálogo por item.key
      let foundMod: ModuleKey | undefined
      for (const m of GRANULAR_SYSTEM_MODULES) {
        if (m.key === moduleOrKey) {
          foundMod = m.key
          break
        }
        const it = m.items.find((i) => i.key === moduleOrKey)
        if (it) {
          foundMod = m.key
          fullKey = `${m.key}.${it.key}`
          break
        }
      }
      if (!fullKey && foundMod) {
        // Foi passado module_key
        modKey = foundMod
      }
    }

    // Se o módulo pai está oculto via legado, não tem acesso
    if (modKey && isModuleHidden(modKey)) {
      return { granted: false, level: 'view' }
    }

    // Se temos na matriz granular
    if (fullKey && fullKey in granularPermissions) {
      const entry = granularPermissions[fullKey]
      if (entry) {
        return entry
      }
    }

    // Se passou apenas moduleKey (sem item), mapeia do legado
    if (modKey && !fullKey) {
      const p = getModulePermission(modKey)
      if (p.hidden || (!p.read && !p.write)) {
        return { granted: false, level: 'view' }
      }
      return {
        granted: true,
        level: p.write ? 'edit' : 'view',
      }
    }

    // Fallback seguro: se ainda não chegou da collection ou é item novo do catálogo,
    // nasce concedido com nível 'edit' (ou 'view' se o módulo só for leitura)
    const canRead = modKey ? canReadModule(modKey) : true
    const canWrite = modKey ? canWriteModule(modKey) : false
    return {
      granted: canRead,
      level: canWrite ? 'edit' : 'view',
    }
  }

  /**
   * Checagem granular: verifica se um item específico dentro de um módulo está concedido.
   * Regra 3: Administrador tem SEMPRE acesso total (retorna true).
   * Se o módulo pai estiver oculto, o item também fica inacessível.
   */
  const canAccessItem = (
    moduleOrKey: ModuleKey | string,
    optionalItemKeyOrMinLevel?: string | PermissionLevel,
    optionalMinLevel?: PermissionLevel,
  ): boolean => {
    if (isAdmin) return true

    let itemPerm: GranularPermissionValue
    let minLevel: PermissionLevel = 'view'

    if (
      optionalItemKeyOrMinLevel === 'view' ||
      optionalItemKeyOrMinLevel === 'edit' ||
      optionalItemKeyOrMinLevel === 'configure'
    ) {
      itemPerm = getItemPermission(moduleOrKey)
      minLevel = optionalItemKeyOrMinLevel
    } else if (typeof optionalItemKeyOrMinLevel === 'string') {
      itemPerm = getItemPermission(moduleOrKey, optionalItemKeyOrMinLevel)
      if (optionalMinLevel) minLevel = optionalMinLevel
    } else {
      itemPerm = getItemPermission(moduleOrKey)
    }

    if (!itemPerm.granted) return false

    if (minLevel === 'view') return true
    if (minLevel === 'edit') return itemPerm.level === 'edit' || itemPerm.level === 'configure'
    if (minLevel === 'configure') return itemPerm.level === 'configure'
    return true
  }

  /**
   * Verbo canView(key): consegue visualizar/consultar o item ou módulo.
   * key pode ser 'tickets_fila', 'tickets.tickets_fila' ou 'tickets'
   */
  const canView = (key: string): boolean => {
    return canAccessItem(key, 'view')
  }

  /**
   * Verbo canEdit(key): consegue ver E editar/criar, mas não necessariamente excluir.
   * Atende 'edit' ou 'configure'.
   */
  const canEdit = (key: string): boolean => {
    return canAccessItem(key, 'edit')
  }

  /**
   * Verbo canDelete(key): acesso total que inclui excluir (nível 'configure').
   */
  const canDelete = (key: string): boolean => {
    return canAccessItem(key, 'configure')
  }

  /**
   * Verbo canConfigure(key): sinônimo de canDelete/acesso total de configuração.
   */
  const canConfigure = (key: string): boolean => {
    return canAccessItem(key, 'configure')
  }

  /**
   * Checagem granular por rota: verifica se a rota dada tem restrição granular no perfil.
   */
  const canAccessPath = (pathname: string): boolean => {
    if (isAdmin) return true

    // 1. Procurar item do catálogo que casa com esta rota exata ou início de path
    for (const mod of GRANULAR_SYSTEM_MODULES) {
      for (const item of mod.items) {
        if (!item.path) continue

        // Se o path tiver parâmetros de query (ex: /settings?tab=portal), checa apenas se pathname for /settings
        const itemBasePath = item.path.split('?')[0]
        if (
          itemBasePath === pathname ||
          (itemBasePath !== '/' && pathname.startsWith(itemBasePath + '/'))
        ) {
          // Se o item tem query param (ex: /settings?tab=portal), a rota base /settings não bloqueia por causa desse item
          if (item.path.includes('?')) {
            continue
          }
          return canAccessItem(mod.key, item.key)
        }
      }
    }

    return true
  }

  // Specific module checks for fast access
  const canManageProfiles = canWriteModule('profiles') || isAdmin
  const canManageOperators = isAdmin
  const canAccessVault =
    canAccessItem('vault', 'vault_cofre') && (canReadModule('vault') || isAdmin || isGestor)
  const canManageVault = canWriteModule('vault') || isAdmin
  const canManageClients = canWriteModule('clients')
  const canManageContracts = canWriteModule('clients')
  const canManageTeam = canWriteModule('operators') || isAdmin || isGestor
  const canManageQueues = canWriteModule('settings') || isGestor
  const canManageCategories = canWriteModule('settings') || isAdmin
  const canViewReports = canReadModule('reports')
  const canAssignTicket = canWriteModule('tickets') || isTecnico
  const canPauseSla = canWriteModule('tickets') || isTecnico
  const canResolveTicket = canWriteModule('tickets') || isTecnico
  const canViewCmdb = canReadModule('cmdb')
  const canManageCmdb = canWriteModule('cmdb')
  const canManageCiTypes = canWriteModule('cmdb') && isAdmin
  const isClienteSolicitante = role === 'cliente_solicitante'
  const canAccessUnitReports = false
  const canManageAutomations = isAdmin || isGestor
  const canPublishAutomations = isAdmin
  const canViewAutomations = isAdmin || isGestor || role === 'auditor'
  const canTestAutomations = isAdmin || isGestor

  return {
    role,
    profile,
    isAdmin,
    isGestor,
    isTecnico,
    isClienteGestor,
    isCliente,
    granularPermissions,
    loadingGranular,
    getModulePermission,
    canReadModule,
    canWriteModule,
    isModuleHidden,
    getItemPermission,
    canAccessItem,
    canAccessPath,
    canView,
    canEdit,
    canDelete,
    canConfigure,
    canManageProfiles,
    canManageOperators,
    canManageClients,
    canManageContracts,
    canManageTeam,
    canManageQueues,
    canManageCategories,
    canViewReports,
    canAssignTicket,
    canPauseSla,
    canResolveTicket,
    canViewCmdb,
    canManageCmdb,
    canManageCiTypes,
    isClienteSolicitante,
    canAccessUnitReports,
    canManageAutomations,
    canPublishAutomations,
    canViewAutomations,
    canTestAutomations,
    canAccessVault,
    canManageVault,
    reloadPermissions: loadGranular,
  }
}
