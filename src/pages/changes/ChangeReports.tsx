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
import { getChanges, type ChangeRecord } from '@/services/changes'
import { exportToCsv } from '@/lib/export-utils'
import { useRealtime } from '@/hooks/use-realtime'

const COLORS = ['#f59e0b', '#10b981', '#d97706', '#ef4444', '#b45309']

export default function ChangeReports() {
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [period, setPeriod] = useState('all')

  const loadData = () => {
    getChanges()
      .then(setChanges)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('changes', () => loadData())

  const filtered = useMemo(() => {
    if (period === 'all') return changes
    const now = new Date()
    const days = period === '7' ? 7 : period === '30' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 86400000)
    return changes.filter((c) => new Date(c.created) >= cutoff)
  }, [changes, period])

  const byType = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((c) =>
      m.set(
        c.expand?.change_type?.name || 'N/D',
        (m.get(c.expand?.change_type?.name || 'N/D') || 0) + 1,
      ),
    )
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((c) => m.set(c.status, (m.get(c.status) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byRisk = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((c) => m.set(c.risk_level || 'N/D', (m.get(c.risk_level || 'N/D') || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const config: ChartConfig = { value: { label: 'Mudanças' } }

  const handleExport = () => {
    exportToCsv(
      'relatorio-mudancas.csv',
      filtered.map((c) => ({
        number: c.number,
        title: c.title,
        status: c.status,
        priority: c.priority,
        risk_level: c.risk_level,
        type: c.expand?.change_type?.name || '',
        requester: c.expand?.requester?.name || '',
        created: c.created,
      })),
      ['number', 'title', 'status', 'priority', 'risk_level', 'type', 'requester', 'created'],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Relatórios de Mudanças
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
            <p className="text-xs text-slate-500">Concluídas</p>
            <p className="text-2xl font-bold text-green-600">
              {filtered.filter((c) => c.status === 'Concluída').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Canceladas/Recusadas</p>
            <p className="text-2xl font-bold text-red-600">
              {filtered.filter((c) => ['Cancelada', 'Recusada'].includes(c.status)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Em Andamento</p>
            <p className="text-2xl font-bold text-primary">
              {
                filtered.filter((c) =>
                  ['Em Planejamento', 'Agendada', 'Em Execução', 'Em Validação'].includes(c.status),
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byType} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
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
            <CardTitle className="text-sm">Por Risco</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <PieChart>
                <Pie
                  data={byRisk}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                >
                  {byRisk.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
