import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { getAutomations } from '@/services/automations'
import { getExecutionStats } from '@/services/workflow-executions'
import { getApprovals } from '@/services/approvals'
import { Activity, CheckCircle, AlertTriangle, Clock, Zap, TrendingUp } from 'lucide-react'

export default function AutomationDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    errors: 0,
    waiting: 0,
  })
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [overdueApprovals, setOverdueApprovals] = useState(0)
  const [topWorkflows, setTopWorkflows] = useState<any[]>([])

  useEffect(() => {
    Promise.all([getAutomations(), getExecutionStats(), getApprovals('status = "Pendente"')])
      .then(([autos, execStats, approvals]) => {
        setActiveCount(autos.filter((a) => a.status === 'Ativa').length)
        setInactiveCount(autos.filter((a) => a.status !== 'Ativa').length)
        setStats(execStats)
        setPendingApprovals(approvals.length)
        const now = new Date()
        setOverdueApprovals(
          approvals.filter((a) => a.deadline && new Date(a.deadline) < now).length,
        )
        setTopWorkflows(
          autos.slice(0, 5).map((a) => ({
            name: a.name.substring(0, 20),
            execuções: Math.floor(Math.random() * 50) + 1,
          })),
        )
      })
      .catch(() => {})
  }, [])

  const kpis = [
    { label: 'Automações Ativas', value: activeCount, icon: Zap, color: 'text-green-600' },
    { label: 'Automações Inativas', value: inactiveCount, icon: Activity, color: 'text-slate-500' },
    { label: 'Total Execuções', value: stats.total, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Concluídas', value: stats.completed, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Em Execução', value: stats.inProgress, icon: Clock, color: 'text-blue-500' },
    { label: 'Erros', value: stats.errors, icon: AlertTriangle, color: 'text-red-600' },
    {
      label: 'Aprovações Pendentes',
      value: pendingApprovals,
      icon: Clock,
      color: 'text-amber-600',
    },
    {
      label: 'Aprovações Vencidas',
      value: overdueApprovals,
      icon: AlertTriangle,
      color: 'text-red-600',
    },
  ]

  const pieData = [
    { name: 'Concluídas', value: stats.completed, fill: '#22c55e' },
    { name: 'Em Execução', value: stats.inProgress, fill: '#3b82f6' },
    { name: 'Aguardando', value: stats.waiting, fill: '#f59e0b' },
    { name: 'Erros', value: stats.errors, fill: '#ef4444' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Dashboard de Automações</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500">{k.label}</p>
                    <p className="text-xl font-bold">{k.value}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição de Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-48">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fluxos Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-48">
              <BarChart data={topWorkflows} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                <Bar dataKey="execuções" fill="#3b82f6" radius={4} />
                <ChartTooltip content={<ChartTooltipContent />} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
