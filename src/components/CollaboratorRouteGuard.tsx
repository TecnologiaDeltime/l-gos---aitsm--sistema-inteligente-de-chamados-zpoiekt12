/**
 * Guarda de sessão do Portal do Colaborador.
 *
 * O colaborador NÃO usa o login de operadores (/login): ele tem tela própria
 * (/portal/colaborador) e sessão independente (token próprio no localStorage,
 * via hook de backend). Este componente garante que:
 *  - sem sessão de colaborador -> volta para /portal/colaborador;
 *  - com sessão válida -> renderiza o painel.
 * Admin em impersonação também passa (sessão em sessionStorage tem prioridade).
 */
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCollaboratorAuth } from '@/services/collaborator-portal'
import { readImpersonation } from '@/services/collaborator-impersonation'
import { Loader2 } from 'lucide-react'

export function CollaboratorRouteGuard({ children }: { children: ReactNode }) {
  const { collaborator, loading } = useCollaboratorAuth()
  const impersonation = readImpersonation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!collaborator && !impersonation) {
    return <Navigate to="/portal/colaborador" replace />
  }

  return <>{children}</>
}
