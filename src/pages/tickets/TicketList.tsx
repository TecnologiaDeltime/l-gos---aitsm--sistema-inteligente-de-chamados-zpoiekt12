import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PlusCircle,
  Search,
  Filter,
  LayoutGrid,
  List,
  Settings2,
  Volume2,
  VolumeX,
  WifiOff,
  Forward,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTickets, updateTicket, TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'
import { KanbanBoard } from '@/components/KanbanBoard'
import { BatchDelegateDialog } from '@/components/BatchDelegateDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { KANBAN_COLUMNS } from '@/lib/kanban-constants'
import { getHiddenColumns, setHiddenColumns } from '@/lib/kanban-columns'
import { useToast } from '@/hooks/use-toast'
import { isSoundEnabled, setSoundEnabled } from '@/lib/ticket-alerts'
import { usePbHealth } from '@/hooks/use-pb-health'

export default function TicketList() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [contractSearch, setContractSearch] = useState('')
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([])
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchDelegate, setShowBatchDelegate] = useState(false)
  const { canResolveTicket } = usePermissions()
  const { toast } = useToast()
  const pbConnected = usePbHealth()

  const loadData = async () => {
    try {
      setTickets(await getTickets())
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setHiddenColumnsState(getHiddenColumns())
    loadData()
  }, [])
  useRealtime('tickets', () => {
    loadData()
  })

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  const toggleColumn = (status: string) => {
    const newHidden = hiddenColumns.includes(status)
      ? hiddenColumns.filter((s) => s !== status)
      : [...hiddenColumns, status]
    if (newHidden.length >= KANBAN_COLUMNS.length) return
    setHiddenColumns(newHidden)
    setHiddenColumnsState(newHidden)
  }

  const handleKanbanStatusChange = async (
    ticketId: string,
    newStatus: string,
    oldStatus: string,
  ) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)))
    try {
      await updateTicket(ticketId, { status: newStatus })
    } catch {
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: oldStatus } : t)))
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do chamado. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const filtered = tickets.filter((t) => {
    const ms =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.number.toLowerCase().includes(search.toLowerCase()) ||
      t.requester_name.toLowerCase().includes(search.toLowerCase())
    const mSt = statusFilter === 'all' || t.status === statusFilter
    const mC =
      contractSearch === '' ||
      (t.expand?.contract?.number || '').toLowerCase().includes(contractSearch.toLowerCase()) ||
      (t.expand?.company?.trade_name || '').toLowerCase().includes(contractSearch.toLowerCase())
    return ms && mSt && mC
  })

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))
  const someFilteredSelected = filtered.some((t) => selectedIds.has(t.id)) && !allFilteredSelected

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
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
              placeholder="Buscar por nº, título ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative w-40">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Contrato..."
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-1 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Novo">Novo</SelectItem>
              <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
              <SelectItem value="Aguardando Cliente">Aguardando Cliente</SelectItem>
              <SelectItem value="Resolvido">Resolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            title={soundOn ? 'Desativar som de notificação' : 'Ativar som de notificação'}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button
            variant={view === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" /> Kanban
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('table')}
          >
            <List className="mr-1.5 h-4 w-4" /> Tabela
          </Button>
          {view === 'table' && selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowBatchDelegate(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Forward className="mr-1.5 h-4 w-4" /> Delegar em lote ({selectedIds.size})
            </Button>
          )}
          {view === 'kanban' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="mr-1.5 h-4 w-4" /> Colunas
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Personalizar Colunas</p>
                  {KANBAN_COLUMNS.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${status}`}
                        checked={!hiddenColumns.includes(status)}
                        onCheckedChange={() => toggleColumn(status)}
                        disabled={
                          !hiddenColumns.includes(status) &&
                          hiddenColumns.length >= KANBAN_COLUMNS.length - 1
                        }
                      />
                      <label htmlFor={`col-${status}`} className="text-xs cursor-pointer">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Link to="/tickets/new">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Abrir Chamado
            </Button>
          </Link>
        </div>
      </div>

      {!pbConnected && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <WifiOff className="h-4 w-4" />
          <span>Tempo real desconectado — as atualizações automáticas estão pausadas.</span>
        </div>
      )}
      {view === 'kanban' ? (
        <KanbanBoard
          tickets={filtered}
          canEdit={canResolveTicket}
          onStatusChange={handleKanbanStatusChange}
          hiddenColumns={hiddenColumns}
        />
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="p-3.5 w-10">
                    <Checkbox
                      checked={
                        allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3.5">Nº</th>
                  <th className="p-3.5">Título</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Prioridade</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Responsável</th>
                  <th className="p-3.5">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Nenhum chamado encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 w-10">
                        <Checkbox
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={() => toggleSelectOne(t.id)}
                        />
                      </td>
                      <td className="p-3.5 font-bold text-blue-600">
                        <Link to={`/tickets/${t.id}`}>#{t.number}</Link>
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 max-w-sm truncate dark:text-slate-100">
                        <Link to={`/tickets/${t.id}`} className="hover:underline">
                          {t.title}
                        </Link>
                      </td>
                      <td className="p-3.5">{t.expand?.company?.trade_name || 'Geral'}</td>
                      <td className="p-3.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="p-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="p-3.5">{t.expand?.assigned_to?.name || 'Não atribuído'}</td>
                      <td className="p-3.5 w-36">
                        <SlaProgressBar slaStatus={t.sla_status} paused={t.sla_paused} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <BatchDelegateDialog
        ticketIds={Array.from(selectedIds)}
        open={showBatchDelegate}
        onOpenChange={setShowBatchDelegate}
        onDelegated={() => {
          setSelectedIds(new Set())
          loadData()
        }}
      />
    </div>
  )
}
