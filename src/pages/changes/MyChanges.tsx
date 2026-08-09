import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getMyChanges, type ChangeRecord } from '@/services/changes'
import { ChangeStatusBadge, RiskLevelBadge } from '@/components/ChangeStatusBadge'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'

export default function MyChanges() {
  const { user } = useAuth()
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    if (!user) return
    getMyChanges(user.id)
      .then(setChanges)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('changes', () => loadData())

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <User className="h-5 w-5" /> Minhas Mudanças
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {changes.length === 0 ? (
          <p className="text-center text-sm text-slate-500 col-span-full py-8">
            Você não possui mudanças atribuídas.
          </p>
        ) : (
          changes.map((c) => (
            <Link
              key={c.id}
              to={`/changes/${c.id}`}
              className="block rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-primary text-sm">{c.number}</span>
                <ChangeStatusBadge status={c.status} />
              </div>
              <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">{c.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{c.expand?.change_type?.name || '-'}</span>
                <span>·</span>
                <RiskLevelBadge level={c.risk_level} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.expand?.requester?.name === user?.name
                  ? 'Solicitante'
                  : c.expand?.responsible?.name === user?.name
                    ? 'Responsável'
                    : 'Atribuído'}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
