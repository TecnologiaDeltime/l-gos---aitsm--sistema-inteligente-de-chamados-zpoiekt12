import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bug, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getKnownErrors } from '@/services/problems'
import { KNOWN_ERROR_STATUSES } from '@/lib/problem-constants'
import { useRealtime } from '@/hooks/use-realtime'

export default function KnownErrors() {
  const [errors, setErrors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = () =>
    getKnownErrors()
      .then(setErrors)
      .catch(() => {})
      .finally(() => setLoading(false))
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('known_errors', () => loadData())
  useRealtime('problems', () => loadData())

  const filtered = errors.filter(
    (e) =>
      (e.known_cause || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.expand?.problem?.number || '').toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Bug className="h-5 w-5" /> Base de Erros Conhecidos
      </h2>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar erros conhecidos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500 col-span-full py-8">
            Nenhum erro conhecido registrado.
          </p>
        ) : (
          filtered.map((ke) => (
            <div key={ke.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <Link
                  to={`/problems/${ke.problem}`}
                  className="font-bold text-primary text-sm hover:underline"
                >
                  {ke.expand?.problem?.number || 'N/A'}
                </Link>
                <Badge variant="outline" className="text-[10px]">
                  {ke.status || 'Ativo'}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2">{ke.known_cause}</p>
              {ke.symptoms && (
                <p className="text-xs text-muted-foreground line-clamp-2">{ke.symptoms}</p>
              )}
              {ke.affected_services && (
                <p className="text-xs text-muted-foreground">Serviços: {ke.affected_services}</p>
              )}
              {ke.workaround && (
                <p className="text-xs text-muted-foreground">
                  Solução de contorno: {ke.workaround}
                </p>
              )}
              {ke.expand?.responsible && (
                <p className="text-xs text-slate-500">Responsável: {ke.expand.responsible.name}</p>
              )}
              <p className="text-xs text-slate-400">
                Criado em: {new Date(ke.created).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
