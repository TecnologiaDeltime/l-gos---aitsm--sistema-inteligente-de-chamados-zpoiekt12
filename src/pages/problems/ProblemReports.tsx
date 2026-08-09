import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { getProblems, type ProblemRecord } from '@/services/problems'
import { exportToCsv } from '@/lib/export-utils'
import { useRealtime } from '@/hooks/use-realtime'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function ProblemReports() {
  const [problems, setProblems] = useState<ProblemRecord[]>([])
  const [period, setPeriod] = useState('all')

  const loadData = () =>
    getProblems()
      .then(setProblems)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('problems', () => loadData())

  const filtered = useMemo(() => {
    if (period === 'all') return problems
    const now = new Date()
    const days = period === '7' ? 7 : period === '30' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 86400000)
    return problems.filter((p) => new Date(p.created) >= cutoff)
  }, [problems, period])

  const byPriority = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((p) => m.set(p.priority, (m.get(p.priority) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byOrigin = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((p) => m.set(p.origin || 'N/D', (m.get(p.origin || 'N/D') || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((p) => m.set(p.status, (m.get(p.status) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const effectiveness = useMemo(() => {
    const evaluated = filtered.filter((p) => p.effectiveness_result)
    const efetiva = evaluated.filter((p) => p.effectiveness_result === 'Efetiva').length
    const parcial = evaluated.filter(
      (p) => p.effectiveness_result === 'Parcialmente efetiva',
    ).length
    const naoEfetiva = evaluated.filter((p) => p.effectiveness_result === 'Não efetiva').length
    const rate = evaluated.length > 0 ? Math.round((efetiva / evaluated.length) * 100) : 0
    return { efetiva, parcial, naoEfetiva, total: evaluated.length, rate }
  }, [filtered])

  const reopened = filtered.filter((p) => (p.reopened_count || 0) > 0).length
  const recurrenceRate = filtered.length > 0 ? Math.round((reopened / filtered.length) * 100) : 0
  const config: ChartConfig = { value: { label: 'Problemas' } }

  const handleExport = () => {
    exportToCsv(
      'relatorio-problemas.csv',
      filtered.map((p) => ({
        number: p.number,
        title: p.title,
        status: p.status,
        priority: p.priority,
        origin: p.origin,
        effectiveness_result: p.effectiveness_result || '',
        created: p.created,
      })),
      ['number', 'title', 'status', 'priority', 'origin', 'effectiveness_result', 'created'],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Relatórios de Problemas
        </h2>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Encerrados</p>
            <p className="text-2xl font-bold text-green-600">
              {filtered.filter((p) => p.status === 'Encerrado').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Taxa de Efetividade</p>
            <p className="text-2xl font-bold text-blue-600">{effectiveness.rate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Taxa de Recorrência</p>
            <p className="text-2xl font-bold text-red-600">{recurrenceRate}%</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byPriority}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byOrigin} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9 }} />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Efetividade das Soluções de Contorno</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p>
            Efetiva: {effectiveness.efetiva} | Parcialmente efetiva: {effectiveness.parcial} | Não
            efetiva: {effectiveness.naoEfetiva}
          </p>
          <p className="font-semibold">
            Taxa de Efetividade = {effectiveness.efetiva} / {effectiveness.total} × 100 ={' '}
            {effectiveness.rate}%
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
