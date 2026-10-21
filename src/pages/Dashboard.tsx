import { useEffect, useState } from 'react'
import {
  Inbox,
  Clock,
  PauseCircle,
  AlertTriangle,
  Flame,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  Hourglass,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTickets, TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'
import { useRegisterRefresh } from '@/contexts/AutoRefreshContext'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const PENDING_STATUSES = [
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Aguardando Validação',
  'Agendado',
]

const CLOSED_STATUSES = ['Encerrado', 'Cancelado']

type FilterKey =
  | 'novos'
  | 'emAtendimento'
  | 'aguardandoCliente'
  | 'slaViolado'
  | 'criticos'
  | 'slaRisco'
  | 'pendente'
  | 'resolvidos'
  | 'backlog'

const FILTER_PREDICATES: Record<FilterKey, (t: TicketRecord) => boolean> = {
  novos: (t) => t.status === 'Novo',
  emAtendimento: (t) => t.status === 'Em Atendimento',
  aguardandoCliente: (t) => t.status === 'Aguardando Cliente',
  slaViolado: (t) => t.sla_status === 'Violado',
  criticos: (t) => t.priority === 'Crítica',
  slaRisco: (t) => t.sla_status === 'Risco' || t.sla_status === 'Crítico',
  pendente: (t) => PENDING_STATUSES.includes(t.status),
  resolvidos: (t) => t.status === 'Resolvido' || t.status === 'Encerrado',
  backlog: () => true,
}

interface KpiConfig {
  label: string
  value: number
  icon: typeof Inbox
  color: string
  bg: string
  filterKey: FilterKey
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchTickets = (isBackground: boolean = false) => {
    if (!isBackground) {
      setLoading(true)
    }
    setLoadError(null)
    return getTickets()
      .then((data) => {
        setTickets(data)
        setLoadError(null)
      })
      .catch((err: any) => {
        console.error('Falha ao carregar chamados no Dashboard:', err)
        const msg =
          err?.response?.message ||
          err?.message ||
          'Erro ao carregar chamados. Verifique sua conexão ou permissões.'
        setLoadError(msg)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useRegisterRefresh('dashboard-page', () => fetchTickets(true))

  useEffect(() => {
    fetchTickets()
  }, [])

  const openTickets = tickets.filter((t) => !CLOSED_STATUSES.includes(t.status))

  const totalNovos = openTickets.filter((t) => t.status === 'Novo').length
  const totalEmAtendimento = openTickets.filter((t) => t.status === 'Em Atendimento').length
  const totalAguardando = openTickets.filter((t) => t.status === 'Aguardando Cliente').length
  const totalSlaViolado = openTickets.filter((t) => t.sla_status === 'Violado').length
  const totalP1 = openTickets.filter((t) => t.priority === 'Crítica').length
  const totalEmRisco = openTickets.filter(
    (t) => t.sla_status === 'Risco' || t.sla_status === 'Crítico',
  ).length
  const totalResolvidos = openTickets.filter(
    (t) => t.status === 'Resolvido' || t.status === 'Encerrado',
  ).length
  const totalPendente = openTickets.filter((t) => PENDING_STATUSES.includes(t.status)).length

  const kpis: KpiConfig[] = [
    {
      label: 'Chamados Novos',
      value: totalNovos,
      icon: Inbox,
      color: 'text-slate-600 dark:text-amber-400',
      bg: 'bg-slate-500/10 dark:bg-amber-500/10',
      filterKey: 'novos',
    },
    {
      label: 'Em Atendimento',
      value: totalEmAtendimento,
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/10',
      filterKey: 'emAtendimento',
    },
    {
      label: 'Aguardando Cliente',
      value: totalAguardando,
      icon: PauseCircle,
      color: 'text-slate-600 dark:text-yellow-400',
      bg: 'bg-slate-500/10 dark:bg-yellow-500/10',
      filterKey: 'aguardandoCliente',
    },
    {
      label: 'SLA Violado',
      value: totalSlaViolado,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
      filterKey: 'slaViolado',
    },
    {
      label: 'Críticos (P1)',
      value: totalP1,
      icon: Flame,
      color: 'text-red-600 dark:text-red-500',
      bg: 'bg-red-500/15',
      filterKey: 'criticos',
    },
    {
      label: 'SLA em Risco',
      value: totalEmRisco,
      icon: AlertCircle,
      color: 'text-slate-600 dark:text-amber-500',
      bg: 'bg-slate-500/15 dark:bg-amber-500/15',
      filterKey: 'slaRisco',
    },
    {
      label: 'Status Pendente',
      value: totalPendente,
      icon: Hourglass,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      filterKey: 'pendente',
    },
    {
      label: 'Resolvidos',
      value: totalResolvidos,
      icon: Calendar,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      filterKey: 'resolvidos',
    },
    {
      label: 'Backlog Total',
      value: openTickets.length,
      icon: Layers,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/10',
      filterKey: 'backlog',
    },
  ]

  const handleCardClick = (key: FilterKey) => {
    setActiveFilter((prev) => (prev === key ? null : key))
  }

  const displayedTickets = activeFilter
    ? openTickets.filter(FILTER_PREDICATES[activeFilter])
    : openTickets

  const tableTickets = activeFilter ? displayedTickets : displayedTickets.slice(0, 10)

  const activeKpiLabel = activeFilter ? kpis.find((k) => k.filterKey === activeFilter)?.label : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Painel de Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral dos chamados e SLAs</p>
        </div>
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors duration-150"
          >
            <X className="h-3 w-3" /> Limpar filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          const isActive = activeFilter === kpi.filterKey
          return (
            <Card
              key={idx}
              className={cn(
                'itsm-card itsm-card-hover cursor-pointer transition-all duration-200',
                isActive && 'ring-2 ring-primary shadow-md',
              )}
              onClick={() => handleCardClick(kpi.filterKey)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn('p-2.5 rounded-lg', kpi.bg)}>
                    <Icon className={cn('h-5 w-5', kpi.color)} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                  <p
                    className={cn(
                      'text-xs font-medium mt-0.5',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {kpi.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {loadError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm">
              Não foi possível carregar os dados dos chamados: {loadError}
            </span>
          </div>
          <button
            onClick={() => fetchTickets(false)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <Card className="itsm-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            {activeKpiLabel ? `Chamados: ${activeKpiLabel}` : 'Chamados Recentes'}
          </CardTitle>
          <Link
            to="/tickets"
            className="text-xs font-medium text-primary hover:text-primary/80 hover:underline flex items-center transition-colors duration-150"
          >
            Ver Todos <ArrowUpRight className="h-3 w-3 ml-0.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="itsm-table-header">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando chamados...
                    </td>
                  </tr>
                ) : tableTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {loadError
                        ? 'Ocorreu um erro ao carregar os chamados.'
                        : 'Nenhum chamado encontrado para este filtro.'}
                    </td>
                  </tr>
                ) : (
                  tableTickets.map((t, idx) => (
                    <tr
                      key={t.id}
                      className={`itsm-table-row itsm-table-row-hover ${idx % 2 === 1 ? 'itsm-table-row-alt' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-primary">
                        <Link to={`/tickets/${t.id}`} className="hover:underline">
                          {t.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.expand?.company?.trade_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 w-36">
                        <SlaProgressBar slaStatus={t.sla_status} paused={t.sla_paused} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
