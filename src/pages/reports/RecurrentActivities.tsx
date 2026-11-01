import { useEffect, useState, useMemo } from 'react'
import { Download, TrendingUp, TrendingDown, Minus, RefreshCw, Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getTickets } from '@/services/tickets'
import { getCategories } from '@/services/categories'
import { getCompanies } from '@/services/companies'
import { exportToCsv } from '@/lib/export-utils'
import { useRealtime } from '@/hooks/use-realtime'
import { buildDateFilter, formatDate, computeRecurrentActivities } from '@/lib/sla-report-utils'

const PAGE_SIZE = 50

export default function RecurrentActivities() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)))
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [companyId, setCompanyId] = useState('all')
  const [companies, setCompanies] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [currTickets, setCurrTickets] = useState<any[]>([])
  const [prevTickets, setPrevTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const loadData = async () => {
    setLoading(true)
    setPage(0)
    try {
      const sd = startDate || formatDate(new Date(Date.now() - 30 * 86400000))
      const ed = endDate || formatDate(new Date())
      const startMs = new Date(sd).getTime()
      const endMs = new Date(ed).getTime()
      const periodMs = endMs - startMs
      const prevEnd = new Date(startMs - 1)
      const prevStart = new Date(startMs - periodMs - 1)
      const currFilter = buildDateFilter(sd, ed, companyId)
      const prevFilter = buildDateFilter(formatDate(prevStart), formatDate(prevEnd), companyId)
      const [curr, prev, cats, comps] = await Promise.all([
        getTickets(currFilter),
        getTickets(prevFilter),
        getCategories(),
        getCompanies(),
      ])
      setCurrTickets(curr)
      setPrevTickets(prev)
      setCategories(cats)
      setCompanies(comps)
    } catch (err) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('tickets', () => {
    loadData()
  })

  const rows = useMemo(
    () => computeRecurrentActivities(currTickets, prevTickets, categories),
    [currTickets, prevTickets, categories],
  )
  const maxTotal = rows.length > 0 ? rows[0].total : 1
  const top10 = rows.slice(0, 10).map((r) => ({ name: r.subactivity, total: r.total }))
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const chartConfig: ChartConfig = {
    total: { label: 'Chamados', color: 'hsl(var(--chart-1))' },
  }

  const trendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-slate-400" />
  }

  const handleExport = () => {
    exportToCsv(
      'atividades-recorrentes.csv',
      rows.map((r) => ({
        'Atividade Principal': r.mainActivity,
        Subatividade: r.subactivity,
        'Total de Chamados': r.total,
        'Média SLA Resposta (min)': r.avgResponseMin || '-',
        'Média SLA Solução (min)': r.avgSolutionMin || '-',
        '% do Total': r.pctOfTotal.toFixed(1) + '%',
        'Período Anterior': r.previousCount,
        Tendência: r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→',
      })),
      [
        'Atividade Principal',
        'Subatividade',
        'Total de Chamados',
        'Média SLA Resposta (min)',
        'Média SLA Solução (min)',
        '% do Total',
        'Período Anterior',
        'Tendência',
      ],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Repeat className="h-5 w-5 text-amber-600 dark:text-amber-400" /> Atividades Recorrentes
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={loading || rows.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            Nenhum dado encontrado para o período selecionado
          </CardContent>
        </Card>
      ) : (
        <>
          {top10.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top 10 Subatividades</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={top10} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                    <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={4} />
                    <Tooltip />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalhamento por Subatividade</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Atividade Principal</TableHead>
                      <TableHead className="text-xs">Subatividade</TableHead>
                      <TableHead className="text-xs text-center">Total</TableHead>
                      <TableHead className="text-xs text-center">SLA Resp. (min)</TableHead>
                      <TableHead className="text-xs text-center">SLA Sol. (min)</TableHead>
                      <TableHead className="text-xs text-center">% do Total</TableHead>
                      <TableHead className="text-xs">Proporção</TableHead>
                      <TableHead className="text-xs text-center">Tendência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((r) => (
                      <TableRow key={r.subcategoryId}>
                        <TableCell className="text-xs font-medium">{r.mainActivity}</TableCell>
                        <TableCell className="text-xs">{r.subactivity}</TableCell>
                        <TableCell className="text-xs text-center font-semibold">
                          {r.total}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {r.avgResponseMin || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {r.avgSolutionMin || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {r.pctOfTotal.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-xs">
                          <Progress value={(r.total / maxTotal) * 100} className="h-2" />
                        </TableCell>
                        <TableCell className="text-xs text-center">{trendIcon(r.trend)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t">
                  <span className="text-xs text-slate-500">
                    Página {page + 1} de {totalPages} ({rows.length} registros)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
