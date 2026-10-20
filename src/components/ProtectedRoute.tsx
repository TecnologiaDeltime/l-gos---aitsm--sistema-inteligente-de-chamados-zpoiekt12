import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { ForceChangePasswordDialog } from '@/components/ForceChangePasswordDialog'
import { ModuleKey } from '@/types/profiles'

interface ProtectedRouteProps {
  children: ReactNode
  requiredModule?: ModuleKey
  requireWrite?: boolean
}

export function ProtectedRoute({
  children,
  requiredModule,
  requireWrite = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth()
  const { canReadModule, canWriteModule, isModuleHidden } = usePermissions()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredModule) {
    if (isModuleHidden(requiredModule)) {
      return <Navigate to="/dashboard" replace />
    }
    if (requireWrite && !canWriteModule(requiredModule)) {
      return <Navigate to="/dashboard" replace />
    }
    if (!requireWrite && !canReadModule(requiredModule)) {
      return <Navigate to="/dashboard" replace />
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
