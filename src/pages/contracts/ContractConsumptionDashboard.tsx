import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { getContracts, ContractRecord, CONTRACT_HOURS_LEVELS } from '@/services/contracts'
import { getContractPeriods, ContractPeriodRecord } from '@/services/contract-periods'
import { getQueues, QueueRecord } from '@/services/queues'
import { useRealtime } from '@/hooks/use-realtime'
import { exportToCsv } from '@/lib/export-utils'
import { formatHours, formatSeconds } from '@/lib/duration'
import { AlertTriangle, Ban, Clock, Download } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

interface LevelConsumption {
  key: string
  label: string
  contractedSeconds: number
  consumedSeconds: number
  balanceSeconds: number
  pct: number
}

interface ContractRow {
  contract: ContractRecord
  period?: ContractPeriodRecord
  contracted: number
  consumed: number
  balance: number
  pct: number
  levels: LevelConsumption[]
}

export default function ContractConsumptionDashboard() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [periods, setPeriods] = useState<ContractPeriodRecord[]>([])
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [ticketsByCompany, setTicketsByCompany] = useState<Record<string, any[]>>({})
  const [interactionsByTicket, setInteractionsByTicket] = useState<Record<string, any[]>>({})
  const [loadingLevels, setLoadingLevels] = useState(false)

  const loadData = async () => {
    try {
      const [c, p, q] = await Promise.all([getContracts(), getContractPeriods(), getQueues()])
      setContracts(c)
      setPeriods(p)
      setQueues(q)
      // Pré-carrega tickets por empresa e interações por ticket para cálculo
      // de consumo por nível em tempo real.
      setLoadingLevels(true)
      const ticketsMap: Record<string, any[]> = {}
      const allTickets: any[] = await pb
        .collection('tickets')
        .getFullList({ fields: 'id,company,queue' })
      allTickets.forEach((t) => {
        if (t.company) {
          if (!ticketsMap[t.company]) ticketsMap[t.company] = []
          ticketsMap[t.company].push(t)
        }
      })
      setTicketsByCompany(ticketsMap)

      // Busca interações em lotes de 50 tickets (limite de filtro do PB).
      const interactionsMap: Record<string, any[]> = {}
      const ticketIds = allTickets.map((t) => t.id)
      const batchSize = 50
      for (let i = 0; i < ticketIds.length; i += batchSize) {
        const batch = ticketIds.slice(i, i + batchSize)
        const filter = batch.map((id) => `ticket = "${id}"`).join(' || ')
        const interactions = await pb
          .collection('ticket_interactions')
          .getFullList({ filter, fields: 'id,ticket,duration_minutes' })
        interactions.forEach((it: any) => {
          if (!interactionsMap[it.ticket]) interactionsMap[it.ticket] = []
          interactionsMap[it.ticket].push(it)
        })
      }
      setInteractionsByTicket(interactionsMap)
      setLoadingLevels(false)
    } catch {
      setLoadingLevels(false)
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('contract_periods', () => loadData())
  useRealtime('ticket_interactions', () => loadData())

  // Mapa queueId -> level (para classificar consumo por nível)
  const queueLevelMap = useMemo(() => {
    const m = new Map<string, string>()
    queues.forEach((q) => {
      if (q.level) m.set(q.id, q.level)
    })
    return m
  }, [queues])

  const data: ContractRow[] = useMemo(() => {
    return contracts.map((c) => {
      const ap = periods.find((p) => p.contract === c.id && p.status === 'Ativo')
      const contracted = ap?.contracted_hours || c.monthly_hours || 0
      const consumed = ap?.consumed_hours || 0
      const balance = contracted - consumed
      const pct = contracted > 0 ? (consumed / contracted) * 100 : 0

      // Cálculo por nível: horas contratadas (do contrato) vs horas consumidas
      // (soma de duration_minutes das interações dos tickets da empresa cuja
      // fila tenha o nível correspondente).
      const companyTickets = ticketsByCompany[c.company] || []
      const levels: LevelConsumption[] = CONTRACT_HOURS_LEVELS.map((lvl) => {
        const contractedHours = Number((c as any)[lvl.key]) || 0
        const contractedSeconds = Math.round(contractedHours * 3600)

        let consumedSeconds = 0
        companyTickets.forEach((t) => {
          if (!t.queue) return
          const qLevel = queueLevelMap.get(t.queue)
          if (qLevel !== lvl.label) return
          const its = interactionsByTicket[t.id] || []
          its.forEach((it) => {
            const mins = Number(it.duration_minutes) || 0
            consumedSeconds += Math.round(mins * 60)
          })
        })

        const balanceSeconds = contractedSeconds - consumedSeconds
        const lvlPct = contractedSeconds > 0 ? (consumedSeconds / contractedSeconds) * 100 : 0
        return {
          key: lvl.key,
          label: lvl.label,
          contractedSeconds,
          consumedSeconds,
          balanceSeconds,
          pct: lvlPct,
        }
      })

      return { contract: c, period: ap, contracted, consumed, balance, pct, levels }
    })
  }, [contracts, periods, ticketsByCompany, interactionsByTicket, queueLevelMap])

  const totalContracted = data.reduce((s, d) => s + d.contracted, 0)
  const totalConsumed = data.reduce((s, d) => s + d.consumed, 0)
  const above80 = data.filter((d) => d.pct >= 80 && d.pct < 100)
  const at100 = data.filter((d) => d.pct >= 100)

  const kpis = [
    {
      label: 'Clientes Ativos',
      value: contracts.filter((c) => c.status === 'Ativo').length,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Horas Contratadas',
      value: formatHours(totalContracted),
      icon: Clock,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Horas Consumidas',
      value: formatHours(totalConsumed),
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Saldo Total',
      value: formatHours(totalContracted - totalConsumed),
      icon: Clock,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Acima de 80%',
      value: above80.length,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Limite Atingido',
      value: at100.length,
      icon: Ban,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ]

  const colorFor = (pct: number) =>
    pct >= 100
      ? 'bg-red-100 text-red-700'
      : pct >= 80
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700'

  const levelBarColor = (pct: number) =>
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'

  const chartData = data
    .filter((d) => d.contracted > 0)
    .map((d) => ({
      name: d.contract.number,
      Contratado: d.contracted,
      Consumido: d.consumed,
    }))

  const chartConfig: ChartConfig = {
    Contratado: { label: 'Contratado', color: 'hsl(var(--chart-2))' },
    Consumido: { label: 'Consumido', color: 'hsl(var(--chart-1))' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Consumo de Contratos</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportToCsv(
              'consumo-contratos.csv',
              data.map((d) => ({
                Código: d.contract.expand?.company?.code || '',
                Cliente: d.contract.expand?.company?.trade_name || '',
                Contratado: d.contracted,
                Consumido: d.consumed,
                Saldo: d.balance,
                Percentual: d.pct.toFixed(1) + '%',
                Status: d.contract.status,
              })),
              ['Código', 'Cliente', 'Contratado', 'Consumido', 'Saldo', 'Percentual', 'Status'],
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-3">
                <div className={`p-2 rounded-lg ${k.bg} w-fit mb-2`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <p className="text-[10px] text-slate-500">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contratado vs Consumido</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="Contratado" fill="hsl(var(--chart-2))" radius={4} />
                <Bar dataKey="Consumido" fill="hsl(var(--chart-1))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Detalhamento por nível de atendimento por contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Saldo de Horas por Nível de Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contrato</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Nível</TableHead>
                <TableHead className="text-xs">Contratado</TableHead>
                <TableHead className="text-xs">Consumido</TableHead>
                <TableHead className="text-xs">Saldo</TableHead>
                <TableHead className="text-xs min-w-[140px]">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.flatMap((d) =>
                d.levels
                  .filter((lvl) => lvl.contractedSeconds > 0 || lvl.consumedSeconds > 0)
                  .map((lvl) => (
                    <TableRow key={d.contract.id + '_' + lvl.key}>
                      <TableCell className="text-xs font-semibold text-blue-600">
                        {d.contract.number}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.contract.expand?.company?.trade_name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{lvl.label}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatSeconds(lvl.contractedSeconds)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatSeconds(lvl.consumedSeconds)}
                      </TableCell>
                      <TableCell
                        className={`text-xs font-mono ${lvl.balanceSeconds < 0 ? 'text-red-600 font-bold' : ''}`}
                      >
                        {formatSeconds(lvl.balanceSeconds)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 min-w-[80px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${levelBarColor(lvl.pct)}`}
                              style={{ width: `${Math.min(100, lvl.pct)}%` }}
                            />
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${colorFor(lvl.pct)}`}
                          >
                            {lvl.pct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )),
              )}
              {data.every((d) =>
                d.levels.every((lvl) => lvl.contractedSeconds === 0 && lvl.consumedSeconds === 0),
              ) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-slate-400 py-6">
                    {loadingLevels
                      ? 'Calculando consumo por nível...'
                      : 'Nenhum nível com horas contratadas encontrado.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalhamento por Cliente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contrato</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Contratado</TableHead>
                <TableHead className="text-xs">Consumido</TableHead>
                <TableHead className="text-xs">Saldo</TableHead>
                <TableHead className="text-xs">%</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.contract.id}>
                  <TableCell className="text-xs font-semibold text-blue-600">
                    {d.contract.number}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.contract.expand?.company?.trade_name || 'N/A'}
                  </TableCell>
                  <TableCell className="text-xs">{formatHours(d.contracted)}</TableCell>
                  <TableCell className="text-xs">{formatHours(d.consumed)}</TableCell>
                  <TableCell className="text-xs">{formatHours(d.balance)}</TableCell>
                  <TableCell className="text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorFor(d.pct)}`}
                    >
                      {d.pct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{d.contract.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
