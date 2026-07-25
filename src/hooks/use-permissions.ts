import { useAuth } from '@/hooks/use-auth'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || 'cliente_solicitante'

  const isAdmin = role === 'admin'
  const isGestor = role === 'gestor' || isAdmin
  const isTecnico = role === 'tecnico' || isGestor
  const isClienteGestor = role === 'cliente_gestor'
  const isCliente = role === 'cliente_solicitante' || isClienteGestor

  const canManageClients = isAdmin || isGestor
  const canManageContracts = isAdmin || isGestor
  const canManageTeam = isAdmin || isGestor
  const canManageQueues = isAdmin || isGestor
  const canManageCategories = isAdmin
  const canViewReports = isTecnico || isClienteGestor
  const canAssignTicket = isTecnico
  const canPauseSla = isTecnico
  const canResolveTicket = isTecnico

  return {
    role,
    isAdmin,
    isGestor,
    isTecnico,
    isClienteGestor,
    isCliente,
    canManageClients,
    canManageContracts,
    canManageTeam,
    canManageQueues,
    canManageCategories,
    canViewReports,
    canAssignTicket,
    canPauseSla,
    canResolveTicket,
  }
}
