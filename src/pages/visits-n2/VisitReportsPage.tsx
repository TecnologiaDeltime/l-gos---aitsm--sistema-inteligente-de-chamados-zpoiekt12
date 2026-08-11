import { useEffect, useState, useMemo } from 'react'
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
import { Download, BarChart3 } from 'lucide-react'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getTravelEntries } from '@/services/travel-entries'
import { getExpenses } from '@/services/expenses'
import { getReimbursements } from '@/services/reimbursements'
import { getServiceOrders } from '@/services/visit-extras'
import { getUsers } from '@/services/users'
import { exportToCsv } from '@/lib/export-utils'
import { useRealtime } from '@/hooks/use-realtime'

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export default function VisitReportsPage() {
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [travel, setTravel] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [reimbs, setReimbs] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [period, setPeriod] = useState('all')

  const loadData = async () => {
    try {
      const [v, t, e, r, o, u] = await Promise.all([
        getVisits(),
        getTravelEntries(),
        getExpenses(),
        getReimbursements(),
        getServiceOrders(),
        getUsers(),
      ])
      setVisits(v)
      setTravel(t)
      setExpenses(e)
      setReimbs(r)
      setOrders(o)
      setTechs(u)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('technical_visits', () => loadData())

  const filtered = useMemo(() => {
    if (period === 'all') return visits
    const days = period === '7' ? 7 : period === '30' ? 30 : 90
    const cutoff = new Date(Date.now() - days * 86400000)
    return visits.filter((v) => new Date(v.created) >= cutoff)
  }, [visits, period])

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((v) => m.set(v.status, (m.get(v.status) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byType = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((v) =>
      m.set(v.appointment_type || 'N/D', (m.get(v.appointment_type || 'N/D') || 0) + 1),
    )
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered])

  const byTech = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((v) => {
      const name = techs.find((t) => t.id === v.technician)?.name || 'N/A'
      m.set(name, (m.get(name) || 0) + 1)
    })
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [filtered, techs])

  const config: ChartConfig = { value: { label: 'Qtd' } }
  const totalKm = travel.reduce((s, t) => s + (t.actual_distance || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.value || 0), 0)
  const totalReimb = reimbs.reduce((s, r) => s + (r.total_requested || 0), 0)

  const handleExport = () => {
    exportToCsv(
      'relatorio-visitas.csv',
      filtered.map((v) => ({
        Data: v.scheduled_date || '',
        Técnico: techs.find((t) => t.id === v.technician)?.name || '',
        Status: v.status,
        Tipo: v.appointment_type || '',
        KM: v.calculated_mileage || 0,
        Endereço: v.client_address || '',
      })),
      ['Data', 'Técnico', 'Status', 'Tipo', 'KM', 'Endereço'],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Relatórios de Visitas
        </h2>
        <div className="flex gap-2">
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
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Visitas</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">KM Total</p>
            <p className="text-2xl font-bold text-purple-600">{totalKm.toFixed(0)}km</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Despesas</p>
            <p className="text-2xl font-bold text-amber-600">R$ {totalExpenses.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Reembolsos</p>
            <p className="text-2xl font-bold text-orange-600">R$ {totalReimb.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm">Por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byType}>
                <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                <YAxis />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Por Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byTech}>
                <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                <YAxis />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
