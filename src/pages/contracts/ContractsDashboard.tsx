import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, FileText, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { getContracts, ContractRecord } from '@/services/contracts'
import { getTickets, TicketRecord } from '@/services/tickets'
import { PeriodFilter, usePeriodFilter } from '@/components/contracts/PeriodFilter'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

export default function ContractsDashboard() {
  const [periodFilter, setPeriodFilter] = usePeriodFilter()
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [interactionsByTicket, setInteractionsByTicket] = useState<Record<string, any[]>>({})

  const loadData = async () => {
    try {
      const [c, t] = await Promise.all([getContracts(), getTickets()])
      setContracts(c)
      setTickets(t)

      // Carrega interações no período selecionado para os tickets existentes
      if (t.length > 0) {
        const ticketIds = t.map((item) => item.id)
        const batchSize = 50
        const interactionsMap: Record<string, any[]> = {}
        const dateFilter = `created >= "${periodFilter.startIso}" && created <= "${periodFilter.endIso}"`

        for (let i = 0; i < ticketIds.length; i += batchSize) {
          const batch = ticketIds.slice(i, i + batchSize)
          const batchTicketFilter = batch.map((id) => `ticket = "${id}"`).join(' || ')
          const filter = `(${batchTicketFilter}) && ${dateFilter}`
          const interactions = await pb
            .collection('ticket_interactions')
            .getFullList({ filter, fields: 'id,ticket,duration_minutes,hour_type,created' })
          interactions.forEach((it: any) => {
            if (!interactionsMap[it.ticket]) interactionsMap[it.ticket] = []
            interactionsMap[it.ticket].push(it)
          })
        }
        setInteractionsByTicket(interactionsMap)
      } else {
        setInteractionsByTicket({})
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadData()
  }, [periodFilter.startIso, periodFilter.endIso])

  useRealtime('contracts', () => loadData())
  useRealtime('tickets', () => loadData())
  useRealtime('ticket_interactions', () => loadData())

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

  const chartData = useMemo(() => {
    return active
      .filter((c) => (c.monthly_hours || 0) > 0)
      .map((c) => {
        // Tickets vinculados diretamente ao contrato ou secundariamente à empresa
        const contractTickets = tickets.filter(
          (t) => t.contract === c.id || (!t.contract && t.company === c.company),
        )

        // Consumo no período: soma das interações no período filtrado
        let totalMinutes = 0
        contractTickets.forEach((t) => {
          const its = interactionsByTicket[t.id] || []
          its.forEach((it) => {
            totalMinutes += Number(it.duration_minutes) || 0
          })
        })

        // Se houver work_hours diretamente no ticket caso não haja interações com duration_minutes
        if (totalMinutes === 0) {
          const startMs = new Date(periodFilter.startIso.replace(' ', 'T')).getTime()
          const endMs = new Date(periodFilter.endIso.replace(' ', 'T')).getTime()
          const ticketHours = contractTickets
            .filter((t) => {
              const d = new Date(t.created).getTime()
              return d >= startMs && d <= endMs
            })
            .reduce((s, t) => s + (t.work_hours || 0), 0)
          totalMinutes = Math.round(ticketHours * 60)
        }

        const consumedHours = Math.round((totalMinutes / 60) * 100) / 100
        return {
          name: c.number,
          Total: c.monthly_hours || 0,
          Consumido: consumedHours,
        }
      })
  }, [active, tickets, interactionsByTicket, periodFilter])

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
      <div>
        <h2 className="text-xl font-bold">Dashboard de Contratos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visão geral de vencimentos, status e consumo de horas no período selecionado
        </p>
      </div>

      {/* Filtro de Período */}
      <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />

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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Consumo de Horas</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Período: {periodFilter.formattedLabel}
              </p>
            </div>
            <span className="text-[10px] rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              {periodFilter.mode === 'current_month' ? 'Mensal' : 'Customizado'}
            </span>
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
