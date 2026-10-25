import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getTickets, TicketRecord } from '@/services/tickets'
import { getOperatorInteractions, TicketInteractionRecord } from '@/services/ticket-interactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  RefreshCw,
} from 'lucide-react'
import { formatMinutes } from '@/lib/duration'

type PeriodOption = '7' | '30' | '60' | '90'

function trend(curr: number, prev: number) {
  if (prev === 0) return { dir: 'neutral' as const, pct: 0 }
  const diff = ((curr - prev) / prev) * 100
  if (Math.abs(diff) < 5) return { dir: 'neutral' as const, pct: diff }
  return { dir: diff > 0 ? ('up' as const) : ('down' as const), pct: diff }
}

function TrendIcon({ dir }: { dir: 'up' | 'down' | 'neutral' }) {
  if (dir === 'up') return <TrendingUp className="h-3 w-3 text-green-500" />
  if (dir === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-slate-400" />
}

export default function OperatorDashboard() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [interactions, setInteractions] = useState<TicketInteractionRecord[]>([])
  const [period, setPeriod] = useState<PeriodOption>('30')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const days = parseInt(period)
    const start = new Date()
    start.setDate(start.getDate() - days)
    Promise.all([
      getTickets(`assigned_to = "${user.id}"`),
      getOperatorInteractions(user.id, start.toISOString()),
    ])
      .then(([t, i]) => {
        setTickets(t)
        setInteractions(i)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, period])

  const days = parseInt(period)
  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - days)
  const prevStart = new Date()
  prevStart.setDate(prevStart.getDate() - days * 2)
  const currT = tickets.filter((t) => new Date(t.created) >= periodStart)
  const prevT = tickets.filter((t) => {
    const d = new Date(t.created)
    return d >= prevStart && d < periodStart
  })
  const resolved = currT.filter((t) => t.status === 'Resolvido' || t.status === 'Encerrado')
  const slaMet = currT.filter((t) => t.sla_status === 'Dentro do Prazo')
  const slaViolated = currT.filter((t) => t.sla_status === 'Violado')
  const totalHours = interactions.reduce((s, i) => s + (i.duration_minutes || 0) / 60, 0)
  const backlog = tickets.filter((t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status))
  const slaPct = currT.length > 0 ? (slaMet.length / currT.length) * 100 : 0
  const prevSlaPct =
    prevT.length > 0
      ? (prevT.filter((t) => t.sla_status === 'Dentro do Prazo').length / prevT.length) * 100
      : 0
  const resolutionRate = currT.length > 0 ? (resolved.length / currT.length) * 100 : 0
  const reopenRate =
    resolved.length > 0
      ? (currT.filter((t) => t.status === 'Reaberto').length / resolved.length) * 100
      : 0
  const avgHrs = currT.length > 0 ? totalHours / currT.length : 0

  const kpis = [
    {
      label: 'Atendidos',
      value: currT.length,
      ...trend(currT.length, prevT.length),
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Resolvidos',
      value: resolved.length,
      ...trend(
        resolved.length,
        prevT.filter((t) => t.status === 'Resolvido' || t.status === 'Encerrado').length,
      ),
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'SLA %',
      value: slaPct.toFixed(1) + '%',
      ...trend(slaPct, prevSlaPct),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Horas',
      value: formatMinutes(totalHours * 60),
      ...trend(totalHours, 0),
      icon: Timer,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Taxa Resol.',
      value: resolutionRate.toFixed(1) + '%',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      dir: 'neutral' as const,
      pct: 0,
    },
    {
      label: 'Reabertura',
      value: reopenRate.toFixed(1) + '%',
      icon: RefreshCw,
      color: 'text-red-600',
      bg: 'bg-red-50',
      dir: 'neutral' as const,
      pct: 0,
    },
    {
      label: 'Horas/Chamado',
      value: formatMinutes(avgHrs * 60),
      icon: Timer,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      dir: 'neutral' as const,
      pct: 0,
    },
    {
      label: 'Backlog',
      value: backlog.length,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      dir: 'neutral' as const,
      pct: 0,
    },
  ]

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
      </div>
    )

  const hoursByType = interactions.reduce((acc: Record<string, number>, i) => {
    const ht = i.hour_type || 'Não classificado'
    acc[ht] = (acc[ht] || 0) + (i.duration_minutes || 0) / 60
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Meu Painel de Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicadores individuais de produtividade e cumprimento de SLA
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-44 h-9 text-xs bg-secondary/50 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i} className="itsm-card itsm-card-hover border-border/80 bg-card/90">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`p-2 rounded-lg bg-secondary/70 border border-border/60`}>
                    <Icon className={`h-4 w-4 ${k.color}`} />
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 border border-border/50">
                    <TrendIcon dir={k.dir} />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {Math.abs(k.pct).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5 tabular-nums">
                  {k.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="itsm-card overflow-hidden">
          <CardHeader className="border-b border-border/80 bg-secondary/20 px-5 py-3.5">
            <CardTitle className="text-sm font-semibold text-foreground">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Dentro do Prazo</span>
              <span className="font-bold text-emerald-400 tabular-nums">{slaMet.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Violado</span>
              <span className="font-bold text-rose-400 tabular-nums">{slaViolated.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Em Risco</span>
              <span className="font-bold text-amber-400 tabular-nums">
                {currT.filter((t) => t.sla_status === 'Risco' || t.sla_status === 'Crítico').length}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Pausado</span>
              <span className="font-bold text-slate-400 tabular-nums">
                {currT.filter((t) => t.sla_status === 'Pausado').length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card overflow-hidden">
          <CardHeader className="border-b border-border/80 bg-secondary/20 px-5 py-3.5">
            <CardTitle className="text-sm font-semibold text-foreground">Horas por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {Object.entries(hoursByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, hours]) => (
                <div
                  key={type}
                  className="flex justify-between items-center text-xs p-2 rounded-lg bg-secondary/30"
                >
                  <span className="text-muted-foreground">{type}</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatMinutes(hours * 60)}
                  </span>
                </div>
              ))}
            {interactions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sem apontamentos no período
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
