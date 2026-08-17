import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getChanges, type ChangeRecord } from '@/services/changes'
import { getChangeTypes, type ChangeTypeRecord } from '@/services/change-types'
import {
  ChangeStatusBadge,
  RiskLevelBadge,
  ChangePriorityBadge,
} from '@/components/ChangeStatusBadge'
import { CHANGE_STATUSES } from '@/lib/change-constants'
import { useRealtime } from '@/hooks/use-realtime'

export default function ChangeList() {
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [types, setTypes] = useState<ChangeTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const loadData = async () => {
    try {
      const [c, t] = await Promise.all([getChanges(), getChangeTypes()])
      setChanges(c)
      setTypes(t)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('changes', () => loadData())

  const filtered = changes.filter((c) => {
    const ms =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.number.toLowerCase().includes(search.toLowerCase())
    const mSt = statusFilter === 'all' || c.status === statusFilter
    const mTy = typeFilter === 'all' || c.change_type === typeFilter
    return ms && mSt && mTy
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nº ou título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CHANGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Link to="/changes/new">
          <Button className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova Requisição de Mudança (RDM)
          </Button>
        </Link>
      </div>
      <div className="itsm-table-container shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="itsm-table-header">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Risco</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    Nenhuma mudança encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`itsm-table-row itsm-table-row-hover ${idx % 2 === 1 ? 'itsm-table-row-alt' : ''}`}
                  >
                    <td className="px-4 py-3 font-bold text-primary">
                      <Link to={`/changes/${c.id}`} className="hover:underline">
                        {c.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-sm truncate">
                      <Link to={`/changes/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.expand?.change_type?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <ChangePriorityBadge priority={c.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge level={c.risk_level} />
                    </td>
                    <td className="px-4 py-3">
                      <ChangeStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">{c.expand?.requester?.name || '-'}</td>
                    <td className="px-4 py-3">
                      {c.expand?.responsible?.name || c.expand?.assigned_to?.name || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
