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
import { getProblems, type ProblemRecord } from '@/services/problems'
import { ProblemStatusBadge, ProblemPriorityBadge } from '@/components/ProblemStatusBadge'
import { PROBLEM_STATUSES, PROBLEM_PRIORITIES } from '@/lib/problem-constants'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'

interface Props {
  title?: string
  fixedFilter?: string
  showCreate?: boolean
}

export default function ProblemList({
  title = 'Lista de Problemas',
  fixedFilter,
  showCreate = true,
}: Props) {
  const { user } = useAuth()
  const [problems, setProblems] = useState<ProblemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const loadData = async () => {
    try {
      const filter = fixedFilter ? `(${fixedFilter})` : undefined
      setProblems(await getProblems(filter))
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('problems', () => loadData())
  useRealtime('problem_incidents', () => loadData())

  const filtered = problems.filter((p) => {
    const ms =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.number.toLowerCase().includes(search.toLowerCase())
    const mSt = statusFilter === 'all' || p.status === statusFilter
    const mPr = priorityFilter === 'all' || p.priority === priorityFilter
    return ms && mSt && mPr
  })

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {showCreate && (
          <Link to="/problems/new">
            <Button className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Problema
            </Button>
          </Link>
        )}
      </div>
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
        {!fixedFilter && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {PROBLEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PROBLEM_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="itsm-table-container shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="itsm-table-header">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    Nenhum problema encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`itsm-table-row itsm-table-row-hover ${idx % 2 === 1 ? 'itsm-table-row-alt' : ''}`}
                  >
                    <td className="px-4 py-3 font-bold text-primary">
                      <Link to={`/problems/${p.id}`} className="hover:underline">
                        {p.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-sm truncate">
                      <Link to={`/problems/${p.id}`} className="hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <ProblemPriorityBadge priority={p.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <ProblemStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">{p.expand?.company?.trade_name || '-'}</td>
                    <td className="px-4 py-3">{p.expand?.responsible?.name || '-'}</td>
                    <td className="px-4 py-3">{p.origin || '-'}</td>
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
