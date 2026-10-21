import { useAuth } from '@/hooks/use-auth'
import { ModuleKey, ProfileRecord } from '@/types/profiles'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || 'cliente_solicitante'
  const profile = user?.expand?.profile_id as ProfileRecord | undefined

  const isAdmin = role === 'admin'
  const isGestor = role === 'gestor' || isAdmin
  const isTecnico = role === 'tecnico' || isGestor
  const isClienteGestor = role === 'cliente_gestor'
  const isCliente = role === 'cliente_solicitante' || isClienteGestor

  /**
   * Helper to check granular module permissions
   * If profile is present and contains permissions, we use that.
   * If user is admin, they always have read=true, write=true, hidden=false.
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

  // Specific module checks for fast access
  const canManageProfiles = canWriteModule('profiles') || isAdmin
  // Somente administradores podem incluir e excluir operadores
  const canManageOperators = isAdmin
  const canAccessVault = canReadModule('vault') || isAdmin || isGestor
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
  const canAccessUnitReports = canReadModule('reports')
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
    getModulePermission,
    canReadModule,
    canWriteModule,
    isModuleHidden,
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
  }
}
