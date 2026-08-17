import { useEffect, useMemo, useState } from 'react'
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
  GitBranch,
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
import { getUsers, UserItem } from '@/services/users'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
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

const TICKET_STATUSES = [
  'Novo',
  'Em Triagem',
  'Aguardando Atribuição',
  'Atribuído',
  'Em Atendimento',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Agendado',
  'Escalonado',
  'Resolvido',
  'Aguardando Validação',
  'Encerrado',
  'Cancelado',
  'Reaberto',
] as const

const TICKET_PRIORITIES = ['Crítica', 'Alta', 'Média', 'Baixa'] as const

const CLOSED_STATUSES = ['Encerrado', 'Cancelado']

export default function TicketList() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [prioridadeFilter, setPrioridadeFilter] = useState('all')
  const [analistaFilter, setAnalistaFilter] = useState('all')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([])
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchDelegate, setShowBatchDelegate] = useState(false)
  const { canResolveTicket } = usePermissions()
  const { toast } = useToast()
  const pbConnected = usePbHealth()

  const loadData = async () => {
    try {
      const [t, u, c] = await Promise.all([
        getTickets(),
        getUsers().catch(() => [] as UserItem[]),
        getCompanies().catch(() => [] as CompanyRecord[]),
      ])
      setTickets(t)
      setUsers(u)
      setCompanies(c)
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
    const mSt =
      statusFilter === 'all' ? !CLOSED_STATUSES.includes(t.status) : t.status === statusFilter
    const mPriority = prioridadeFilter === 'all' || t.priority === prioridadeFilter
    const mAnalist = analistaFilter === 'all' || t.assigned_to === analistaFilter
    const mClient = clienteFilter === 'all' || t.company === clienteFilter
    return ms && mSt && mPriority && mAnalist && mClient
  })

  // Conjunto de IDs de tickets que são pais de algum outro ticket carregado.
  const parentIds = useMemo(
    () => new Set(tickets.map((t) => t.parent_ticket_id).filter(Boolean) as string[]),
    [tickets],
  )

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nº, título ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-1 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (Abertos)</SelectItem>
              {TICKET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              {TICKET_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Analista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Analistas</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.trade_name || c.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Forward className="mr-1.5 h-4 w-4" /> Delegar ({selectedIds.size})
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
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
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
        <div className="itsm-table-container shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="itsm-table-header">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={
                        allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">SLA Resp.</th>
                  <th className="px-4 py-3">SLA Sol.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Nenhum chamado encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, idx) => (
                    <tr
                      key={t.id}
                      className={`itsm-table-row itsm-table-row-hover ${idx % 2 === 1 ? 'itsm-table-row-alt' : ''}`}
                    >
                      <td className="px-4 py-3 w-10">
                        <Checkbox
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={() => toggleSelectOne(t.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">
                        <div className="flex items-center gap-1">
                          <Link to={`/tickets/${t.id}`} className="hover:underline">
                            {t.number}
                          </Link>
                          {t.parent_ticket_id ? (
                            <Link
                              to={`/tickets/${t.parent_ticket_id}`}
                              title={`Ticket filho de ${t.expand?.parent_ticket_id?.number || '#'}`}
                              className="inline-flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <GitBranch className="h-3 w-3" />
                            </Link>
                          ) : parentIds.has(t.id) ? (
                            <span
                              title="Possui tickets filhos"
                              className="inline-flex items-center text-amber-500"
                            >
                              <GitBranch className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-sm truncate">
                        <Link to={`/tickets/${t.id}`} className="hover:underline">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.expand?.company?.trade_name || 'Geral'}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.expand?.assigned_to?.name || 'Não atribuído'}
                      </td>
                      <td className="px-4 py-3">
                        <SlaStatusBadge
                          type="response"
                          status={computeSlaResponseStatus(t)}
                          deadline={t.sla_response_deadline}
                          completedAt={t.sla_response_at}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SlaStatusBadge
                          type="solution"
                          status={computeSlaSolutionStatus(t)}
                          deadline={t.sla_solution_deadline}
                          completedAt={t.sla_solution_at}
                        />
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
