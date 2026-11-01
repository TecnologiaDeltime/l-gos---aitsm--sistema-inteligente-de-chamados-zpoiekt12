import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ModuleKey, ProfileRecord, GRANULAR_SYSTEM_MODULES } from '@/types/profiles'
import { getProfilePermissions } from '@/services/profiles'
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
  const [granularPermissions, setGranularPermissions] = useState<Record<string, boolean>>({})
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
      const map: Record<string, boolean> = {}
      list.forEach((r) => {
        map[`${r.module_key}.${r.item_key}`] = !!r.granted
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
   * Checagem granular: verifica se um item específico dentro de um módulo está concedido.
   * Regra 3: Administrador tem SEMPRE acesso total (retorna true).
   * Se o módulo pai estiver oculto, o item também fica inacessível.
   */
  const canAccessItem = (moduleKey: ModuleKey, itemKey: string): boolean => {
    if (isAdmin) return true

    // Se o módulo todo está oculto para o perfil, nenhum item é acessível
    if (isModuleHidden(moduleKey)) return false

    // Se temos permissão granular cadastrada na collection, ela prevalece
    const fullKey = `${moduleKey}.${itemKey}`
    if (fullKey in granularPermissions) {
      return granularPermissions[fullKey] === true
    }

    // Caso o registro ainda não tenha chegado ou o perfil tenha nascido recentemente:
    // por padrão é concedido se o módulo puder ser lido
    return canReadModule(moduleKey)
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
  const canAccessUnitReports = canAccessItem('reports', 'rep_unit') && canReadModule('reports')
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
    canAccessItem,
    canAccessPath,
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
