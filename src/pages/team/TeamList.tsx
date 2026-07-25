import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUsers, UserItem } from '@/services/users'

export default function TeamList() {
  const [users, setUsers] = useState<UserItem[]>([])

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Equipe e Usuários</h2>
        <Link to="/team/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
        </Link>
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
