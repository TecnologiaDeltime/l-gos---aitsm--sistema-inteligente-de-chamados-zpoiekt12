import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { ForceChangePasswordDialog } from '@/components/ForceChangePasswordDialog'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { ModuleKey } from '@/types/profiles'

interface ProtectedRouteProps {
  children: ReactNode
  requiredModule?: ModuleKey
  requiredItem?: string
  requireWrite?: boolean
}

/**
 * Tela de "Acesso negado" exibida quando o perfil do usuário não permite
 * acessar o módulo da rota (toggle por módulo ou permissões granulares)
 * em vez de redirecionar em silêncio.
 */
function AccessDeniedScreen() {
  const location = useLocation()

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Acesso negado</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Seu perfil de acesso não tem permissão para abrir esta tela
          {location.pathname ? (
            <>
              {' '}
              (
              <code className="text-xs bg-secondary/60 px-1.5 py-0.5 rounded">
                {location.pathname}
              </code>
              )
            </>
          ) : null}
          . Solicite ao administrador do sistema a liberação do módulo correspondente em{' '}
          <strong className="text-foreground">Perfis de Acesso</strong>.
        </p>
        <Button asChild className="min-h-[44px]">
          <a href="/dashboard">Voltar ao início</a>
        </Button>
      </div>
    </div>
  )
}

export function ProtectedRoute({
  children,
  requiredModule,
  requiredItem,
  requireWrite = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth()
  const { canReadModule, canWriteModule, isModuleHidden, canAccessItem, canAccessPath, isAdmin } =
    usePermissions()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Cliente autenticado em rota de operador: volta para o portal dele
  // (ponto focal) — a área interna é exclusiva de operadores.
  if (user?.role === 'cliente_solicitante' || user?.role === 'cliente_gestor') {
    return <Navigate to="/portal" replace />
  }

  // Se for admin, acesso total garantido (Regra 3 - Administrador é imune)
  if (!isAdmin) {
    // Fallback padrão se a rota atual for bloqueada:
    // Se a rota bloqueada for o próprio /operator-dashboard, cai no /dashboard
    const fallbackTarget = '/dashboard'

    // 1. Checagem por requiredModule
    if (requiredModule) {
      if (isModuleHidden(requiredModule)) {
        return <AccessDeniedScreen />
      }
      if (requireWrite && !canWriteModule(requiredModule)) {
        return <AccessDeniedScreen />
      }
      if (!requireWrite && !canReadModule(requiredModule)) {
        return <AccessDeniedScreen />
      }

      // Se há um requiredItem explícito
      if (requiredItem && !canAccessItem(requiredModule, requiredItem)) {
        return <AccessDeniedScreen />
      }
    }

    // 2. Checagem granular automática pelo caminho da URL (ex.: /reports/monthly-client, /atendimento, /settings/ticket-templates)
    if (!canAccessPath(location.pathname)) {
      return <AccessDeniedScreen />
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
