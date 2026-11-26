import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Loader2,
  Plus,
  Columns2,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { useAlertMute } from '@/hooks/use-alert-mute'
import { getTicketsWithLastInteraction, updateTicket, TicketRecord } from '@/services/tickets'
import { getUsers, UserItem } from '@/services/users'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { KanbanBoard } from '@/components/KanbanBoard'
import { TicketSplitView } from '@/components/tickets/TicketSplitView'
import TicketDetail from '@/pages/tickets/TicketDetail'
import { BatchDelegateDialog } from '@/components/BatchDelegateDialog'
import { getHiddenColumns } from '@/lib/kanban-columns'
import { splitTextWithHighlight, normalizeSearchText } from '@/lib/search-text'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { StaleBadge } from '@/components/StaleBadge'
import { isStaleClosed, computeLastActivityMs } from '@/lib/stale-time'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
import { formatDateTime, formatTicketAge } from '@/lib/date-format'
import { cn } from '@/lib/utils'

type ViewMode = 'split' | 'kanban' | 'table'
type SortKey = 'number' | 'created' | 'priority' | 'status' | 'stale'

interface SeverityCardConfig {
  key: string
  label: string
  priority: string
  num: string
  badge: string
  card: string
}

const SEVERITY_CARDS: SeverityCardConfig[] = [
  {
    key: 'critica',
    label: 'CRÍTICA',
    priority: 'Crítica',
    num: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-200/70 text-red-800 dark:bg-red-500/25 dark:text-red-300',
    card: 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-500/40',
  },
  {
    key: 'alta',
    label: 'ALTA',
    priority: 'Alta',
    num: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-200/70 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
    card: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40',
  },
  {
    key: 'media',
    label: 'MÉDIA',
    priority: 'Média',
    num: 'text-yellow-600 dark:text-yellow-400',
    badge: 'bg-yellow-200/70 text-yellow-800 dark:bg-yellow-500/25 dark:text-yellow-300',
    card: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-500/40',
  },
  {
    key: 'baixa',
    label: 'BAIXA',
    priority: 'Baixa',
    num: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300',
    card: 'border-slate-300 bg-slate-100 dark:bg-slate-800/60 dark:border-slate-500/40',
  },
]

const PRIORITY_ORDER: Record<string, number> = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 }

const STATUS_OPTIONS = [
  'Novo',
  'Atribuído',
  'Em Atendimento',
  'Pendente',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Agendado',
  'Resolvido',
  'Encerrado',
  'Cancelado',
  'Reaberto',
  'Reprovado',
]

export default function TicketList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit, canAssignTicket } = usePermissions()
  const { toast } = useToast()
  const { isMuted, toggleMute } = useAlertMute()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [analystFilter, setAnalystFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [view, setView] = useState<ViewMode>('table')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDelegateOpen, setBatchDelegateOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [analysts, setAnalysts] = useState<UserItem[]>([])
  const [clients, setClients] = useState<CompanyRecord[]>([])

  const loadTickets = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const isClient = user?.role === 'cliente_solicitante' || user?.role === 'cliente_gestor'
        const filterParts: string[] = []
        if (isClient && user?.email) {
          // Aspas SIMPLES: o backend de produção rejeita filtros com aspas duplas (400).
          filterParts.push(`requester_email = '${user.email}'`)
        }
        const filter = filterParts.length ? filterParts.join(' && ') : undefined
        const data = await getTicketsWithLastInteraction(filter, '-created')
        setTickets(data)
      } catch (err) {
        console.error(err)
        toast({
          title: 'Erro ao carregar chamados',
          description: 'Não foi possível buscar a lista de chamados.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user?.role, user?.email],
  )

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  // Carrega analistas e clientes para os filtros (uma única vez)
  useEffect(() => {
    getUsers("(role = 'tecnico' || role = 'gestor' || role = 'admin') && active = true")
      .then(setAnalysts)
      .catch(() => setAnalysts([]))
    getCompanies()
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  // Atualização silenciosa periódica (mantém SLA e tempo sem atualização frescos)
  useEffect(() => {
    const interval = setInterval(() => loadTickets(true), 60_000)
    return () => clearInterval(interval)
  }, [loadTickets])

  const handleStatusChange = async (ticketId: string, newStatus: string, _oldStatus: string) => {
    try {
      await updateTicket(ticketId, { status: newStatus })
      await loadTickets(true)
      toast({ title: `Status alterado para ${newStatus}` })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao alterar status',
        description: 'Não foi possível mover o chamado de coluna.',
        variant: 'destructive',
      })
    }
  }

  const staleSeconds = useCallback((t: TicketRecord): number | null => {
    if (isStaleClosed(t.status)) return null
    return Math.max(
      0,
      Math.floor(
        (Date.now() - computeLastActivityMs(t.updated, t.created, t.last_interaction_at)) / 1000,
      ),
    )
  }, [])

  const matchesFilters = useCallback(
    (t: TicketRecord, opts: { ignorePriority?: boolean }) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!opts.ignorePriority && priorityFilter !== 'all' && t.priority !== priorityFilter)
        return false
      if (analystFilter !== 'all') {
        const assigneeId = t.expand?.assigned_to?.id || (t as any).assigned_to
        if (assigneeId !== analystFilter) return false
      }
      if (clientFilter !== 'all') {
        const companyId = t.expand?.company?.id || (t as any).company
        if (companyId !== clientFilter) return false
      }
      if (search.trim()) {
        const tokens = normalizeSearchText(search).split(/\s+/).filter(Boolean)
        const hay = normalizeSearchText(
          `${t.number || ''} ${t.title || ''} ${t.requester_name || ''} ${t.expand?.company?.trade_name || ''}`,
        )
        if (!tokens.every((token) => hay.includes(token))) return false
      }
      return true
    },
    [statusFilter, priorityFilter, analystFilter, clientFilter, search],
  )

  const filtered = useMemo(() => {
    const list = tickets.filter((t) => matchesFilters(t, {}))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'number':
          return (a.number || '').localeCompare(b.number || '', 'pt-BR', { numeric: true }) * dir
        case 'priority':
          return ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir
        case 'status':
          return (a.status || '').localeCompare(b.status || '', 'pt-BR') * dir
        case 'stale': {
          const sa = staleSeconds(a) ?? -1
          const sb = staleSeconds(b) ?? -1
          return (sa - sb) * dir
        }
        case 'created':
        default:
          return (new Date(a.created).getTime() - new Date(b.created).getTime()) * dir
      }
    })
  }, [tickets, matchesFilters, sortKey, sortDir, staleSeconds])

  // Cards de criticidade: contagem SEM o filtro de prioridade (mas respeitando
  // os demais filtros) para que o card mostre o total real da severidade.
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const card of SEVERITY_CARDS) counts[card.key] = 0
    for (const t of tickets) {
      if (!matchesFilters(t, { ignorePriority: true })) continue
      const card = SEVERITY_CARDS.find((c) => c.priority === t.priority)
      if (card) counts[card.key] += 1
    }
    return counts
  }, [tickets, matchesFilters])

  const togglePriorityCard = (priority: string) => {
    setPriorityFilter((prev) => (prev === priority ? 'all' : priority))
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'created' || key === 'stale' ? 'desc' : 'asc')
    }
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filtered.forEach((t) => next.delete(t.id))
      } else {
        filtered.forEach((t) => next.add(t.id))
      }
      return next
    })
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Tela Dividida: a lista própria pode seguir os filtros da Fila ("Filtrada")
  // ou mostrar a base completa ("Todos") — padrão: seguir os filtros.
  const [splitListIgnoresFilters, setSplitListIgnoresFilters] = useState(false)
  const toggleSplitListFilters = () => setSplitListIgnoresFilters((v) => !v)

  // Tela Dividida no celular: ao tocar num item da lista, rola suavemente até a
  // ficha abaixo (ancorada em #ticket-detail-panel). No desktop nada muda.
  const handleSplitSelectTicket = (id: string) => {
    setSelectedTicketId(id)
    if (window.matchMedia('(max-width: 1023px)').matches && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('ticket-detail-panel')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }
  }

  const highlight = (text: string) =>
    splitTextWithHighlight(text, search).map((seg, i) =>
      seg.isMatch ? (
        <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-500/40">
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    )

  const kanbanView = (
    <KanbanBoard
      tickets={filtered}
      canEdit={canEdit('tickets')}
      onStatusChange={handleStatusChange}
      hiddenColumns={getHiddenColumns()}
    />
  )

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide hover:text-foreground"
      >
        {label}
        {sortKey === k ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      {/* Cards de criticidade — totais por severidade, clicáveis para filtrar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SEVERITY_CARDS.map((card) => {
          const active = priorityFilter === card.priority
          const count = severityCounts[card.key] ?? 0
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => togglePriorityCard(card.priority)}
              title={`Filtrar chamados de prioridade ${card.priority}`}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition-all hover:shadow-md',
                card.card,
                active && 'ring-2 ring-primary ring-offset-1',
              )}
            >
              <span className={cn('text-3xl font-bold leading-none', card.num)}>{count}</span>
              <span className="flex flex-col items-start gap-1">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
                    card.badge,
                  )}
                >
                  {card.label}
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  chamado(s) na lista
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Barra de filtros + seletor de visualização */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº, título ou solicitante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-8 lg:h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-[150px] lg:h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (Abertos)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-11 w-[140px] lg:h-9">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {SEVERITY_CARDS.map((c) => (
              <SelectItem key={c.priority} value={c.priority}>
                {c.priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={analystFilter} onValueChange={setAnalystFilter}>
          <SelectTrigger className="h-11 w-[150px] lg:h-9">
            <SelectValue placeholder="Analista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Analistas</SelectItem>
            {analysts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-11 w-[150px] lg:h-9">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name || c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 lg:h-9 lg:w-9"
            title={isMuted ? 'Reativar alertas sonoros' : 'Silenciar alertas sonoros'}
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-red-500" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={view === 'split' ? 'default' : 'ghost'}
              className="h-8 px-2 lg:h-7"
              onClick={() => setView('split')}
            >
              <Columns2 className="mr-1 h-3.5 w-3.5" />
              Dividida
            </Button>
            <Button
              size="sm"
              variant={view === 'kanban' ? 'default' : 'ghost'}
              className="h-8 px-2 lg:h-7"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="mr-1 h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button
              size="sm"
              variant={view === 'table' ? 'default' : 'ghost'}
              className="h-8 px-2 lg:h-7"
              onClick={() => setView('table')}
            >
              <List className="mr-1 h-3.5 w-3.5" />
              Tabela
            </Button>
          </div>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shadow-md shadow-primary/20 lg:h-9 lg:w-9"
            title="Abrir Tickets"
            onClick={() => navigate('/tickets/new')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {refreshing && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
        </p>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : view === 'table' ? (
        <Card>
          <CardContent>
            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <span className="text-sm font-medium">
                  {selectedIds.size} chamado(s) selecionado(s)
                </span>
                {canAssignTicket && (
                  <Button size="sm" variant="outline" onClick={() => setBatchDelegateOpen(true)}>
                    Delegar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Limpar
                </Button>
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum chamado encontrado com os filtros atuais.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <SortHead label="Nº" k="number" />
                      <TableHead>Título</TableHead>
                      <TableHead className="w-[130px]">Cliente</TableHead>
                      <SortHead label="Abertura" k="created" />
                      <SortHead label="Prioridade" k="priority" />
                      <SortHead label="Status" k="status" />
                      <TableHead className="w-[140px]">Responsável</TableHead>
                      <TableHead className="w-[100px]">SLA Resp.</TableHead>
                      <TableHead className="w-[140px]">Venc. SLA Sol.</TableHead>
                      <TableHead className="w-[100px]">SLA Sol.</TableHead>
                      <SortHead label="Tempo sem atualização" k="stale" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const solutionStatus = computeSlaSolutionStatus(t)
                      return (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/tickets/${t.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(t.id)}
                              onCheckedChange={() => toggleSelect(t.id)}
                              aria-label={`Selecionar ${t.number || t.id}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-sm font-semibold">
                            {highlight(t.number || t.id)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[320px] truncate text-sm font-medium">
                              {highlight(t.title || '')}
                            </div>
                            {t.sla_paused && (
                              <span className="text-[10px] text-muted-foreground">SLA pausado</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.expand?.company?.trade_name || t.expand?.company?.name || '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-xs">{formatDateTime(t.created)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatTicketAge(t.created)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={t.priority} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={t.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {t.expand?.assigned_to?.name || 'Não atribuído'}
                          </TableCell>
                          <TableCell>
                            <SlaStatusBadge
                              type="response"
                              status={computeSlaResponseStatus(t)}
                              deadline={t.sla_response_deadline}
                              completedAt={t.sla_response_at || t.sla_response_start}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {t.sla_solution_deadline
                              ? formatDateTime(t.sla_solution_deadline)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <SlaStatusBadge
                              type="solution"
                              status={solutionStatus}
                              deadline={t.sla_solution_deadline}
                              completedAt={t.sla_solution_at}
                            />
                          </TableCell>
                          <TableCell>
                            <StaleBadge elapsedSeconds={staleSeconds(t)} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : view === 'split' ? (
        <TicketSplitView
          tickets={tickets}
          filtered={filtered}
          selectedTicketId={selectedTicketId}
          onSelectTicket={handleSplitSelectTicket}
          listIgnoresFilters={splitListIgnoresFilters}
          onToggleListFilters={toggleSplitListFilters}
        />
      ) : (
        kanbanView
      )}

      <BatchDelegateDialog
        ticketIds={Array.from(selectedIds)}
        open={batchDelegateOpen}
        onOpenChange={setBatchDelegateOpen}
        onDelegated={() => {
          setSelectedIds(new Set())
          loadTickets(true)
        }}
      />
    </div>
  )
}
