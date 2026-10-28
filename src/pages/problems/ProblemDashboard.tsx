import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bug,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { getProblems, type ProblemRecord } from '@/services/problems'
import { ProblemStatusBadge, ProblemPriorityBadge } from '@/components/ProblemStatusBadge'
import { useRealtime } from '@/hooks/use-realtime'

const COLORS = [
  '#f59e0b',
  '#d97706',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#64748b',
]

export default function ProblemDashboard() {
  const [problems, setProblems] = useState<ProblemRecord[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const loadData = () =>
    getProblems()
      .then(setProblems)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('problems', () => loadData())

  const stats = useMemo(
    () => ({
      total: problems.length,
      open: problems.filter((p) => !['Encerrado'].includes(p.status)).length,
      investigating: problems.filter((p) => p.status === 'Em Investigação').length,
      causeFound: problems.filter((p) => p.status === 'Causa Identificada').length,
      workaroundDeployed: problems.filter((p) => p.status === 'Solução de Contorno Implantada')
        .length,
      inEffectiveness: problems.filter((p) =>
        ['Em Análise de Efetividade', 'Análise de Efetividade Pendente'].includes(p.status),
      ).length,
      pendingEval: problems.filter((p) => p.status === 'Análise de Efetividade Pendente').length,
      closed: problems.filter((p) => p.status === 'Encerrado').length,
      reopened: problems.filter((p) => (p.reopened_count || 0) > 0).length,
      critical: problems.filter((p) => p.priority === 'Crítica' && p.status !== 'Encerrado').length,
    }),
    [problems],
  )

  const byPriority = useMemo(() => {
    const m = new Map<string, number>()
    problems.forEach((p) => m.set(p.priority, (m.get(p.priority) || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [problems])

  const byMonth = useMemo(() => {
    const m = new Map<string, number>()
    problems.forEach((p) => {
      const d = new Date(p.created)
      const key = `${d.getMonth() + 1}/${d.getFullYear()}`
      m.set(key, (m.get(key) || 0) + 1)
    })
    return Array.from(m, ([k, v]) => ({ name: k, value: v })).slice(-6)
  }, [problems])

  const effectivenessRate = useMemo(() => {
    const evaluated = problems.filter((p) => p.effectiveness_result)
    if (!evaluated.length) return 0
    return Math.round(
      (evaluated.filter((p) => p.effectiveness_result === 'Efetiva').length / evaluated.length) *
        100,
    )
  }, [problems])

  const config: ChartConfig = { value: { label: 'Problemas' } }

  const handleAiAnalyze = () => {
    setAiLoading(true)
    import('@/services/problems').then(({ aiAnalyzeIncidents }) =>
      aiAnalyzeIncidents(30, 5)
        .then(setAiResult)
        .catch(() => {})
        .finally(() => setAiLoading(false)),
    )
  }

  const kpis = [
    { label: 'Total', value: stats.total, icon: Bug, color: 'text-blue-600 bg-blue-50' },
    {
      label: 'Abertos',
      value: stats.open,
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Em Investigação',
      value: stats.investigating,
      icon: Search,
      color: 'text-amber-500 bg-amber-500/10',
    },
    {
      label: 'Causa Identificada',
      value: stats.causeFound,
      icon: CheckCircle2,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Sol. Contorno Implantada',
      value: stats.workaroundDeployed,
      icon: CheckCircle2,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Em Análise Efetividade',
      value: stats.inEffectiveness,
      icon: Clock,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Aguardando Avaliação',
      value: stats.pendingEval,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: 'Encerrados',
      value: stats.closed,
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Reabertos',
      value: stats.reopened,
      icon: RefreshCw,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Críticos',
      value: stats.critical,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bug className="h-5 w-5" /> Dashboard de Problemas
        </h2>
        <Button size="sm" variant="outline" onClick={handleAiAnalyze} disabled={aiLoading}>
          <TrendingDown className="mr-1.5 h-4 w-4" />{' '}
          {aiLoading ? 'Analisando...' : 'IA: Analisar Recorrências'}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500">{k.label}</p>
                <p className="text-xl font-bold">{k.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {aiResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Análise de IA — Padrões de Recorrência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {aiResult.suggestion && (
              <p className="font-semibold text-amber-600">{aiResult.suggestion}</p>
            )}
            {aiResult.recurrences?.map((r: any, i: number) => (
              <div key={i} className="border rounded p-2">
                <p className="font-semibold">
                  {r.service}: {r.count} incidentes em 30 dias
                </p>
              </div>
            ))}
            {aiResult.ai_analysis && (
              <pre className="whitespace-pre-wrap text-muted-foreground">
                {aiResult.ai_analysis}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Problemas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <BarChart data={byMonth}>
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
            <CardTitle className="text-sm">Problemas por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-[200px]">
              <PieChart>
                <Pie
                  data={byPriority}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                >
                  {byPriority.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Taxa de Efetividade: {effectivenessRate}%</CardTitle>
          <Link to="/problems/reports">
            <Button size="sm" variant="ghost">
              Ver Relatórios
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Nº</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Incidentes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {problems.slice(0, 10).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <Link to={`/problems/${p.id}`} className="font-bold text-blue-600">
                        {p.number}
                      </Link>
                    </td>
                    <td className="p-3 max-w-xs truncate">{p.title}</td>
                    <td className="p-3">
                      <ProblemPriorityBadge priority={p.priority} />
                    </td>
                    <td className="p-3">
                      <ProblemStatusBadge status={p.status} />
                    </td>
                    <td className="p-3">
                      {p.incidents_before_count || 0} antes / {p.incidents_after_count || 0} depois
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
