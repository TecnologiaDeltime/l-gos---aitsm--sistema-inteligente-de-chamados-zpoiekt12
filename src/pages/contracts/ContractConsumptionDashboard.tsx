import { useEffect, useState } from 'react'
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
import { getContracts, ContractRecord } from '@/services/contracts'
import { getContractPeriods, ContractPeriodRecord } from '@/services/contract-periods'
import { useRealtime } from '@/hooks/use-realtime'
import { exportToCsv } from '@/lib/export-utils'
import { AlertTriangle, Ban, Clock, Download } from 'lucide-react'

export default function ContractConsumptionDashboard() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [periods, setPeriods] = useState<ContractPeriodRecord[]>([])

  const loadData = async () => {
    try {
      const [c, p] = await Promise.all([getContracts(), getContractPeriods()])
      setContracts(c)
      setPeriods(p)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('contract_periods', () => loadData())

  const data = contracts.map((c) => {
    const ap = periods.find((p) => p.contract === c.id && p.status === 'Ativo')
    const contracted = ap?.contracted_hours || c.monthly_hours || 0
    const consumed = ap?.consumed_hours || 0
    const balance = contracted - consumed
    const pct = contracted > 0 ? (consumed / contracted) * 100 : 0
    return { contract: c, period: ap, contracted, consumed, balance, pct }
  })

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
      value: totalContracted.toFixed(0) + 'h',
      icon: Clock,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Horas Consumidas',
      value: totalConsumed.toFixed(0) + 'h',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Saldo Total',
      value: (totalContracted - totalConsumed).toFixed(0) + 'h',
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
                  <TableCell className="text-xs">{d.contracted.toFixed(1)}h</TableCell>
                  <TableCell className="text-xs">{d.consumed.toFixed(1)}h</TableCell>
                  <TableCell className="text-xs">{d.balance.toFixed(1)}h</TableCell>
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
