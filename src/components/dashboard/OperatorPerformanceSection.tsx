import { useState, useMemo } from 'react'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { formatMinutes } from '@/lib/duration'
import { computeOperatorPerformance } from '@/lib/dashboard-metrics'
import type { DashboardData } from '@/services/dashboard'

interface OperatorPerformanceSectionProps {
  data: DashboardData
}

export function OperatorPerformanceSection({ data }: OperatorPerformanceSectionProps) {
  const [selectedOp, setSelectedOp] = useState('all')
  const perfData = useMemo(() => computeOperatorPerformance(data), [data])

  const monthlyData = useMemo(() => {
    const monthShort = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const groups = new Map<string, Record<string, number>>()
    data.tickets.forEach((t) => {
      if (!t.created || !t.assigned_to) return
      if (selectedOp !== 'all' && t.assigned_to !== selectedOp) return
      const d = new Date(t.created)
      const key = `${monthShort[d.getMonth()]}/${d.getFullYear()}`
      const opName = data.users.find((u) => u.id === t.assigned_to)?.name || 'N/A'
      const group = groups.get(key) || {}
      group[opName] = (group[opName] || 0) + 1
      groups.set(key, group)
    })
    return Array.from(groups.entries())
      .sort((a, b) =>
        a[0].split('/')[1] + a[0].split('/')[0] < b[0].split('/')[1] + b[0].split('/')[0] ? -1 : 1,
      )
      .map(([month, vals]) => ({ month, ...vals }))
  }, [data, selectedOp])

  const chartConfig: ChartConfig = {}
  const opNames = new Set<string>()
  monthlyData.forEach((d) => Object.keys(d).forEach((k) => k !== 'month' && opNames.add(k)))
  opNames.forEach((name, i) => {
    chartConfig[name] = { label: name, color: `hsl(var(--chart-${(Number(i) % 5) + 1}))` }
  })

  const selectedPerf = perfData.find((p) => p.opId === selectedOp)

  return (
    <ChartCard
      title="Desempenho dos Operadores"
      action={
        <Select value={selectedOp} onValueChange={setSelectedOp}>
          <SelectTrigger className="h-7 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os operadores</SelectItem>
            {perfData.map((p) => (
              <SelectItem key={p.opId} value={p.opId}>
                {p.opName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {selectedOp !== 'all' && selectedPerf && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 mb-4">
          <MiniStat label="Atendidos" value={String(selectedPerf.attended)} />
          <MiniStat label="Horas" value={formatMinutes(selectedPerf.hoursMinutes)} />
          <MiniStat label="Média/Chamado" value={selectedPerf.avgHoursPerTicket} />
          <MiniStat label="Resolvidos" value={String(selectedPerf.resolved)} />
          <MiniStat label="Pendentes" value={String(selectedPerf.pending)} />
          <MiniStat label="SLA Cumprido" value={String(selectedPerf.slaMet)} />
          <MiniStat label="SLA Violado" value={String(selectedPerf.slaViolated)} />
        </div>
      )}
      {monthlyData.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Sem dados</p>
      ) : (
        <ChartContainer config={chartConfig} className="h-[280px]">
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {Array.from(opNames).map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={`hsl(var(--chart-${(i % 5) + 1}))`}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border border-border">
      <CardContent className="p-2">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
