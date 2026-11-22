import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { useToast } from '@/hooks/use-toast'
import { getTicketsWithLastInteraction, TicketRecord } from '@/services/tickets'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { StaleBadge } from '@/components/StaleBadge'
import { isStaleClosed, computeLastActivityMs } from '@/lib/stale-time'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
import { formatTicketAge } from '@/lib/date-format'
import { normalizeSearchText } from '@/lib/search-text'

export default function TicketList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const loadTickets = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const isClient = user?.role === 'cliente_solicitante' || user?.role === 'cliente_gestor'
        const filterParts: string[] = []
        if (isClient && user?.email) {
          filterParts.push(`requester_email = "${user.email}"`)
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

  const types = Array.from(new Set(tickets.map((t) => t.type).filter(Boolean))).sort()

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (search.trim()) {
      const tokens = normalizeSearchText(search).split(/\s+/).filter(Boolean)
      const hay = normalizeSearchText(
        `${t.number || ''} ${t.title || ''} ${t.requester_name || ''} ${t.expand?.company?.trade_name || ''}`,
      )
      if (!tokens.every((token) => hay.includes(token))) return false
    }
    return true
  })

  const staleSeconds = (t: TicketRecord): number | null => {
    if (isStaleClosed(t.status)) return null
    return Math.max(
      0,
      Math.floor(
        (Date.now() - computeLastActivityMs(t.updated, t.created, t.last_interaction_at)) / 1000,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            Lista de todos os chamados do sistema com situação de SLA e tempo sem atualização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadTickets(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button onClick={() => navigate('/tickets/new')}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Chamado
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Buscar por número, título, solicitante ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Atribuído">Em aberto</SelectItem>
                <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aguardando Cliente">Aguardando Cliente</SelectItem>
                <SelectItem value="Aguardando Aprovação">Aguardando Aprovação</SelectItem>
                <SelectItem value="Agendado">Agendado</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
                <SelectItem value="Reaberto">Reaberto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="Crítica">Crítica</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${filtered.length} chamado(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum chamado encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Chamado</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[130px]">Prioridade</TableHead>
                    <TableHead className="w-[150px]">Solicitante</TableHead>
                    <TableHead className="w-[110px]">SLA Resposta</TableHead>
                    <TableHead className="w-[110px]">SLA Solução</TableHead>
                    <TableHead className="w-[150px]">Sem Atualização</TableHead>
                    <TableHead className="w-[110px] text-right">Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-semibold">
                        {t.number || t.id}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[340px] truncate text-sm font-medium">{t.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {t.type && (
                            <Badge variant="outline" className="text-[10px]">
                              {t.type}
                            </Badge>
                          )}
                          {t.expand?.company?.trade_name && (
                            <span className="text-xs text-muted-foreground">
                              {t.expand.company.trade_name}
                            </span>
                          )}
                          {t.sla_paused && (
                            <Badge variant="outline" className="text-[10px]">
                              SLA pausado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell className="text-sm">{t.requester_name}</TableCell>
                      <TableCell>
                        <SlaStatusBadge
                          type="response"
                          status={computeSlaResponseStatus(t)}
                          deadline={t.sla_response_deadline}
                          completedAt={t.sla_response_at || t.sla_response_start}
                        />
                      </TableCell>
                      <TableCell>
                        <SlaStatusBadge
                          type="solution"
                          status={computeSlaSolutionStatus(t)}
                          deadline={t.sla_solution_deadline}
                          completedAt={t.sla_solution_at}
                        />
                      </TableCell>
                      <TableCell>
                        <StaleBadge elapsedSeconds={staleSeconds(t)} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatTicketAge(t.created)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
