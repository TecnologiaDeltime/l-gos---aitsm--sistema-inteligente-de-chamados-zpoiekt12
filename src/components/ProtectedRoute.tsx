import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { ForceChangePasswordDialog } from '@/components/ForceChangePasswordDialog'
import { ModuleKey } from '@/types/profiles'

interface ProtectedRouteProps {
  children: ReactNode
  requiredModule?: ModuleKey
  requiredItem?: string
  requireWrite?: boolean
}

export function ProtectedRoute({
  children,
  requiredModule,
  requiredItem,
  requireWrite = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth()
  const {
    canReadModule,
    canWriteModule,
    isModuleHidden,
    canAccessItem,
    canAccessPath,
    isAdmin,
  } = usePermissions()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Se for admin, acesso total garantido (Regra 3 - Administrador é imune)
  if (!isAdmin) {
    // Fallback padrão se a rota atual for bloqueada:
    // Se a rota bloqueada for o próprio /operator-dashboard, cai no /dashboard
    const fallbackTarget = location.pathname === '/operator-dashboard' ? '/dashboard' : '/dashboard'

    // 1. Checagem por requiredModule
    if (requiredModule) {
      if (isModuleHidden(requiredModule)) {
        return <Navigate to={fallbackTarget} replace />
      }
      if (requireWrite && !canWriteModule(requiredModule)) {
        return <Navigate to={fallbackTarget} replace />
      }
      if (!requireWrite && !canReadModule(requiredModule)) {
        return <Navigate to={fallbackTarget} replace />
      }

      // Se há um requiredItem explícito
      if (requiredItem && !canAccessItem(requiredModule, requiredItem)) {
        return <Navigate to={fallbackTarget} replace />
      }
    }

    // 2. Checagem granular automática pelo caminho da URL (ex.: /reports/monthly-client, /atendimento, /settings/ticket-templates)
    if (!canAccessPath(location.pathname)) {
      return <Navigate to={fallbackTarget} replace />
    }
  }

  const mustChangePassword = !!user?.must_change_password

  return (
    <>
      {mustChangePassword && <ForceChangePasswordDialog open={true} />}
      {children}
    </>
  )
}
