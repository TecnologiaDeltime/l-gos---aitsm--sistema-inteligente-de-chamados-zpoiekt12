import { useState, useMemo } from 'react'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { Button } from '@/components/ui/button'
import { computeMonthlyChart } from '@/lib/dashboard-metrics'
import type { TicketRecord } from '@/services/tickets'

interface TicketsChartSectionProps {
  tickets: TicketRecord[]
  onDrillDown: (tickets: TicketRecord[], title: string) => void
}

const GRANULARITIES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

export function TicketsChartSection({ tickets, onDrillDown }: TicketsChartSectionProps) {
  const [granularity, setGranularity] = useState('mensal')
  const chartData = useMemo(() => computeMonthlyChart(tickets, granularity), [tickets, granularity])
  const total = chartData.reduce((s, d) => s + d.Abertos, 0)

  const chartConfig: ChartConfig = {
    Abertos: { label: 'Chamados Abertos', color: 'hsl(var(--chart-1))' },
    Resolvidos: { label: 'Resolvidos/Fechados', color: 'hsl(var(--chart-2))' },
  }

  const handleClick = (data: any) => {
    if (!data || !data.activeLabel) return
    const periodLabel = data.activeLabel
    const filtered = tickets.filter((t) => {
      if (!t.created) return false
      const d = new Date(t.created)
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
      const key = `${monthShort[d.getMonth()]}/${d.getFullYear()}`
      return key === periodLabel
    })
    onDrillDown(filtered, `Chamados — ${periodLabel}`)
  }

  return (
    <ChartCard
      title="Chamados Abertos x Resolvidos por Mês"
      action={
        <div className="flex gap-1">
          {GRANULARITIES.map((g) => (
            <Button
              key={g.value}
              size="sm"
              variant={granularity === g.value ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => setGranularity(g.value)}
            >
              {g.label}
            </Button>
          ))}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Sem dados para o período</p>
      ) : (
        <ChartContainer config={chartConfig} className="h-[280px]">
          <BarChart data={chartData} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const pct = total > 0 ? ((d.Abertos / total) * 100).toFixed(1) : '0'
                return (
                  <div className="rounded-lg border bg-card p-2 text-xs shadow-lg">
                    <p className="font-semibold">{d.label}</p>
                    <p>
                      Abertos: {d.Abertos} ({pct}%)
                    </p>
                    <p>Resolvidos: {d.Resolvidos}</p>
                  </div>
                )
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Abertos" fill="hsl(var(--chart-1))" radius={4} cursor="pointer" />
            <Bar dataKey="Resolvidos" fill="hsl(var(--chart-2))" radius={4} cursor="pointer" />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}
