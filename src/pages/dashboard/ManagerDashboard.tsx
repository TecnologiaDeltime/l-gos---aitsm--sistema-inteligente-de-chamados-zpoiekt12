import { useEffect, useState, useMemo } from 'react'
import { getTickets, TicketRecord } from '@/services/tickets'
import { getUsers, UserItem } from '@/services/users'
import { getOperatorInteractions } from '@/services/ticket-interactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Crown } from 'lucide-react'
import { exportToCsv } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'

type MetricKey = 'sla' | 'attended' | 'resolved' | 'hours' | 'reopens' | 'resolution'

export default function ManagerDashboard() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [allInteractions, setAllInteractions] = useState<any[]>([])
  const [period, setPeriod] = useState('30')
  const [metric, setMetric] = useState<MetricKey>('sla')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const days = parseInt(period)
    const start = new Date()
    start.setDate(start.getDate() - days)
    Promise.all([getTickets(), getUsers(), getOperatorInteractions(undefined, start.toISOString())])
      .then(([t, u, i]) => {
        setTickets(t)
        setUsers(u)
        setAllInteractions(i)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const days = parseInt(period)
  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - days)
  const operators = users.filter((u: any) => ['tecnico', 'gestor', 'admin'].includes(u.role))

  const rankings = useMemo(() => {
    return operators.map((op: any) => {
      const opT = tickets.filter(
        (t) => t.assigned_to === op.id && new Date(t.created) >= periodStart,
      )
      const resolved = opT.filter((t) => t.status === 'Resolvido' || t.status === 'Encerrado')
      const slaMet = opT.filter((t) => t.sla_status === 'Dentro do Prazo')
      const reopened = opT.filter((t) => t.status === 'Reaberto')
      const opI = allInteractions.filter((i: any) => i.author === op.id)
      const hours = opI.reduce((s: number, i: any) => s + (i.duration_minutes || 0) / 60, 0)
      const slaPct = opT.length > 0 ? (slaMet.length / opT.length) * 100 : 0
      const resolutionRate = opT.length > 0 ? (resolved.length / opT.length) * 100 : 0
      const reopenRate = resolved.length > 0 ? (reopened.length / resolved.length) * 100 : 0
      return {
        op,
        attended: opT.length,
        resolved: resolved.length,
        slaPct,
        hours,
        reopenRate,
        resolutionRate,
        backlog: opT.filter((t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status))
          .length,
      }
    })
  }, [operators, tickets, allInteractions, periodStart])

  const sorted = [...rankings].sort((a, b) => {
    const m: Record<MetricKey, number> = {
      sla: b.slaPct - a.slaPct,
      attended: b.attended - a.attended,
      resolved: b.resolved - a.resolved,
      hours: b.hours - a.hours,
      reopens: a.reopenRate - b.reopenRate,
      resolution: b.resolutionRate - a.resolutionRate,
    }
    return m[metric]
  })

  const totalT = tickets.filter((t) => new Date(t.created) >= periodStart)
  const totalResolved = totalT.filter((t) => t.status === 'Resolvido' || t.status === 'Encerrado')
  const totalSlaMet = totalT.filter((t) => t.sla_status === 'Dentro do Prazo')
  const totalHours = allInteractions.reduce(
    (s: number, i: any) => s + (i.duration_minutes || 0) / 60,
    0,
  )
  const kpis = [
    { label: 'Total Chamados', value: totalT.length },
    { label: 'Resolvidos', value: totalResolved.length },
    {
      label: 'SLA %',
      value:
        totalT.length > 0 ? ((totalSlaMet.length / totalT.length) * 100).toFixed(1) + '%' : '0%',
    },
    { label: 'SLA Violado', value: totalT.filter((t) => t.sla_status === 'Violado').length },
    { label: 'Horas Totais', value: totalHours.toFixed(1) + 'h' },
    { label: 'Críticos', value: totalT.filter((t) => t.priority === 'P1').length },
    { label: 'Sem Atribuição', value: totalT.filter((t) => !t.assigned_to).length },
    { label: 'Operadores', value: operators.length },
  ]

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard Gerencial</h2>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sla">SLA %</SelectItem>
              <SelectItem value="attended">Atendidos</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="reopens">Reabertura</SelectItem>
              <SelectItem value="resolution">Resolução</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv(
                'ranking-operadores.csv',
                sorted.map((r) => ({
                  Operador: r.op.name || r.op.email,
                  Atendidos: r.attended,
                  Resolvidos: r.resolved,
                  'SLA %': r.slaPct.toFixed(1),
                  Horas: r.hours.toFixed(1),
                  'Reab %': r.reopenRate.toFixed(1),
                  'Resol %': r.resolutionRate.toFixed(1),
                  Backlog: r.backlog,
                })),
                [
                  'Operador',
                  'Atendidos',
                  'Resolvidos',
                  'SLA %',
                  'Horas',
                  'Reab %',
                  'Resol %',
                  'Backlog',
                ],
              )
            }
          >
            CSV
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Ranking de Operadores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs">Atendidos</TableHead>
                <TableHead className="text-xs">Resolvidos</TableHead>
                <TableHead className="text-xs">SLA %</TableHead>
                <TableHead className="text-xs">Horas</TableHead>
                <TableHead className="text-xs">Reab. %</TableHead>
                <TableHead className="text-xs">Resol. %</TableHead>
                <TableHead className="text-xs">Backlog</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, idx) => (
                <TableRow key={r.op.id}>
                  <TableCell className="text-xs font-bold">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{r.op.name || r.op.email}</TableCell>
                  <TableCell className="text-xs">{r.attended}</TableCell>
                  <TableCell className="text-xs">{r.resolved}</TableCell>
                  <TableCell className="text-xs font-bold">{r.slaPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs">{r.hours.toFixed(1)}h</TableCell>
                  <TableCell className="text-xs">{r.reopenRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs">{r.resolutionRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs">{r.backlog}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
