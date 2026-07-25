import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, FileText, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { getContracts, ContractRecord } from '@/services/contracts'
import { getTickets, TicketRecord } from '@/services/tickets'
import { useRealtime } from '@/hooks/use-realtime'

export default function ContractsDashboard() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])

  const loadData = async () => {
    try {
      const [c, t] = await Promise.all([getContracts(), getTickets()])
      setContracts(c)
      setTickets(t)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('contracts', () => loadData())
  useRealtime('tickets', () => loadData())

  const now = new Date()
  const active = contracts.filter((c) => c.status === 'Ativo')
  const expiringThisMonth = active.filter(
    (c) =>
      c.end_date &&
      new Date(c.end_date).getMonth() === now.getMonth() &&
      new Date(c.end_date).getFullYear() === now.getFullYear(),
  ).length
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const expiringNextMonth = active.filter(
    (c) =>
      c.end_date &&
      new Date(c.end_date).getMonth() === nextMonth.getMonth() &&
      new Date(c.end_date).getFullYear() === nextMonth.getFullYear(),
  ).length
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
  const expiringThisQuarter = active.filter(
    (c) => c.end_date && new Date(c.end_date) <= quarterEnd && new Date(c.end_date) >= now,
  ).length

  const expiring = active
    .filter((c) => c.end_date)
    .map((c) => ({
      ...c,
      daysLeft: Math.ceil((new Date(c.end_date!).getTime() - now.getTime()) / 86400000),
    }))
    .filter((c) => c.daysLeft >= 0 && c.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const colorFor = (d: number) =>
    d <= 7 ? 'bg-red-500' : d <= 15 ? 'bg-orange-500' : d <= 30 ? 'bg-amber-400' : 'bg-green-500'
  const txtColorFor = (d: number) =>
    d <= 7
      ? 'text-red-700'
      : d <= 15
        ? 'text-orange-700'
        : d <= 30
          ? 'text-amber-700'
          : 'text-green-700'

  const chartData = active
    .filter((c) => (c.monthly_hours || 0) > 0)
    .map((c) => {
      const consumed = tickets
        .filter(
          (t) => t.contract === c.id && (t.status === 'Resolvido' || t.status === 'Encerrado'),
        )
        .filter((t) => {
          const d = new Date(t.created)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((s, t) => s + (t.work_hours || 0), 0)
      return { name: c.number, Total: c.monthly_hours || 0, Consumido: consumed }
    })

  const recentlyExpired = contracts
    .filter((c) => c.end_date && new Date(c.end_date) < now)
    .map((c) => ({
      ...c,
      daysSince: Math.ceil((now.getTime() - new Date(c.end_date!).getTime()) / 86400000),
    }))
    .filter((c) => c.daysSince <= 30)
    .sort((a, b) => a.daysSince - b.daysSince)

  const chartConfig: ChartConfig = {
    Total: { label: 'Total' },
    Consumido: { label: 'Consumido', color: 'hsl(var(--chart-1))' },
  }
  const kpis = [
    { l: 'Contratos Ativos', v: active.length, i: FileText, c: 'text-blue-600', b: 'bg-blue-50' },
    {
      l: 'Expiram este mês',
      v: expiringThisMonth,
      i: CalendarClock,
      c: 'text-amber-600',
      b: 'bg-amber-50',
    },
    {
      l: 'Expiram próximo mês',
      v: expiringNextMonth,
      i: CalendarClock,
      c: 'text-orange-600',
      b: 'bg-orange-50',
    },
    {
      l: 'Expiram no trimestre',
      v: expiringThisQuarter,
      i: TrendingDown,
      c: 'text-red-600',
      b: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Dashboard de Contratos</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.i
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{k.l}</p>
                  <p className="text-2xl font-bold">{k.v}</p>
                </div>
                <div className={`p-3 rounded-xl ${k.b}`}>
                  <Icon className={`h-5 w-5 ${k.c}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cronograma de Renovação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {expiring.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Nenhum contrato expirando em 60 dias.
              </p>
            ) : (
              expiring.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className={`h-3 w-3 rounded-full ${colorFor(c.daysLeft)}`} />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/contracts/${c.id}`}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {c.number}
                    </Link>
                    <p className="text-[10px] text-slate-500">
                      {c.expand?.company?.trade_name || 'N/A'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${txtColorFor(c.daysLeft)}`}>
                    {c.daysLeft}d
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Consumo de Horas (Mês Atual)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Sem dados de consumo.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Total" fill="hsl(var(--chart-2))" radius={4} />
                  <Bar dataKey="Consumido" fill="hsl(var(--chart-1))" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contratos Expirados Recentemente (30 dias)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Número</th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Expirado há</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentlyExpired.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">
                      Nenhum contrato expirado recentemente.
                    </td>
                  </tr>
                ) : (
                  recentlyExpired.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <Link to={`/contracts/${c.id}`} className="font-semibold text-blue-600">
                          {c.number}
                        </Link>
                      </td>
                      <td className="p-3">{c.expand?.company?.trade_name || 'N/A'}</td>
                      <td className="p-3">{c.daysSince} dias</td>
                      <td className="p-3">{c.status}</td>
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
