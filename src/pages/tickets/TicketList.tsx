import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
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
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getTicketsWithLastInteraction, TicketRecord } from '@/services/tickets'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { StaleBadge } from '@/components/StaleBadge'
import { isStaleClosed, computeLastActivityMs } from '@/lib/stale-time'
import { computeSlaSolutionStatus } from '@/lib/sla-status'

export default function TicketList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const loadTickets = useCallback(async () => {
    setLoading(true)
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.email])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${t.number || ''} ${t.title} ${t.requester_name || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            Lista de todos os chamados do sistema com situação de SLA.
          </p>
        </div>
        <Button onClick={() => navigate('/tickets/new')}>Novo Chamado</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por número, título ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="md:w-[180px]">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${filtered.length} chamado(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum chamado encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{t.number || t.id}</span>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <SlaStatusBadge
                      type="solution"
                      status={computeSlaSolutionStatus(t)}
                      deadline={t.sla_solution_deadline}
                      completedAt={t.sla_solution_at}
                    />
                    <StaleBadge
                      elapsedSeconds={
                        isStaleClosed(t.status)
                          ? null
                          : Math.max(
                              0,
                              Math.floor(
                                (Date.now() -
                                  computeLastActivityMs(
                                    t.updated,
                                    t.created,
                                    t.last_interaction_at,
                                  )) /
                                  1000,
                              ),
                            )
                      }
                    />
                  </div>
                  <div className="mt-1.5 text-sm font-medium">{t.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Solicitante: {t.requester_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.type}
                    </Badge>
                    {t.last_interaction_at && (
                      <span>
                        Última interação: {new Date(t.last_interaction_at).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
