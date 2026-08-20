import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, UserCheck, ArrowRight, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUsers, UserItem } from '@/services/users'
import { usePermissions } from '@/hooks/use-permissions'

export default function TeamList() {
  const [users, setUsers] = useState<UserItem[]>([])
  const { canManageOperators, canManageProfiles } = usePermissions()

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Equipe e Operadores</h2>
          <p className="text-xs text-muted-foreground">
            Visão geral dos colaboradores e operadores do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageOperators && (
            <Link to="/operators">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <UserCheck className="h-4 w-4" />
                Gerenciar Operadores
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {canManageProfiles && (
            <Link to="/profiles">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Shield className="h-4 w-4" />
                Perfis de Acesso
              </Button>
            </Link>
          )}
          <Link to="/team/new">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <UserPlus className="mr-1.5 h-4 w-4" /> Novo Usuário
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{u.name || u.email}</p>
                <p className="text-xs text-slate-500 capitalize">{u.role || 'Usuário'}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t">
              <p>E-mail: {u.email}</p>
              <p>Cargo: {u.position || 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
