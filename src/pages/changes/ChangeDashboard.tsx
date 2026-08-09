import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { getChanges, type ChangeRecord } from '@/services/changes'
import { ChangeStatusBadge } from '@/components/ChangeStatusBadge'
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

export default function ChangeDashboard() {
  const [changes, setChanges] = useState<ChangeRecord[]>([])

  const loadData = () => {
    getChanges()
      .then(setChanges)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('changes', () => loadData())

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    changes.forEach((c) => m.set(c.status, (m.get(c.status) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [changes])

  const byRisk = useMemo(() => {
    const m = new Map<string, number>()
    changes.forEach((c) => m.set(c.risk_level || 'N/D', (m.get(c.risk_level || 'N/D') || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [changes])

  const pending = changes.filter((c) => c.approval_status === 'Pendente').length
  const completed = changes.filter((c) => c.status === 'Concluída').length
  const rejected = changes.filter((c) => c.status === 'Recusada').length
  const upcoming = changes.filter(
    (c) => c.planned_start && new Date(c.planned_start) > new Date() && c.status === 'Agendada',
  ).length
  const config: ChartConfig = { value: { label: 'Mudanças' } }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <GitBranch className="h-5 w-5" /> Dashboard de Mudanças
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total de Mudanças</p>
              <p className="text-2xl font-bold">{changes.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <GitBranch className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Aguardando Aprovação</p>
              <p className="text-2xl font-bold text-amber-600">{pending}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Concluídas</p>
              <p className="text-2xl font-bold text-green-600">{completed}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Agendadas</p>
              <p className="text-2xl font-bold text-purple-600">{upcoming}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50">
              <AlertTriangle className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mudanças por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[240px]">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
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
            <CardTitle className="text-sm">Mudanças por Nível de Risco</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[240px]">
              <BarChart data={byRisk}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mudanças Recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Nº</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Risco</th>
                  <th className="p-3">Solicitante</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {changes.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <Link to={`/changes/${c.id}`} className="font-bold text-blue-600">
                        {c.number}
                      </Link>
                    </td>
                    <td className="p-3 max-w-xs truncate">{c.title}</td>
                    <td className="p-3">
                      <ChangeStatusBadge status={c.status} />
                    </td>
                    <td className="p-3">{c.risk_level || '-'}</td>
                    <td className="p-3">{c.expand?.requester?.name || '-'}</td>
                  </tr>
                ))}
                {changes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Nenhuma mudança registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
