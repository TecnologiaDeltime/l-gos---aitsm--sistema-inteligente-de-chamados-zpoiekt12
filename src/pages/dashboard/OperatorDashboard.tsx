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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )

  const hoursByType = interactions.reduce((acc: Record<string, number>, i) => {
    const ht = i.hour_type || 'Não classificado'
    acc[ht] = (acc[ht] || 0) + (i.duration_minutes || 0) / 60
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Meu Painel de Performance</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-40 h-8 text-xs">
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${k.bg}`}>
                    <Icon className={`h-4 w-4 ${k.color}`} />
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon dir={k.dir} />
                    <span className="text-[10px] text-slate-500">
                      {Math.abs(k.pct).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="text-xl font-bold text-slate-900">{k.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Dentro do Prazo</span>
              <span className="font-bold text-green-600">{slaMet.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Violado</span>
              <span className="font-bold text-red-600">{slaViolated.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Em Risco</span>
              <span className="font-bold text-amber-600">
                {currT.filter((t) => t.sla_status === 'Risco' || t.sla_status === 'Crítico').length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Pausado</span>
              <span className="font-bold text-slate-600">
                {currT.filter((t) => t.sla_status === 'Pausado').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Horas por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(hoursByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, hours]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-slate-500">{type}</span>
                  <span className="font-bold">{formatMinutes(hours * 60)}</span>
                </div>
              ))}
            {interactions.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
