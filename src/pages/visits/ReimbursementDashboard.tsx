import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { DollarSign, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { getReimbursements, ReimbursementRecord } from '@/services/reimbursements'
import { getUsers } from '@/services/users'
import { exportToCsv } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'

const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export default function ReimbursementDashboard() {
  const [reimbs, setReimbs] = useState<ReimbursementRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])

  const loadData = async () => {
    try {
      setReimbs(await getReimbursements())
      setTechs(await getUsers())
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('reimbursements', () => loadData())

  const totalRequested = reimbs.reduce((s, r) => s + (r.total_requested || 0), 0)
  const totalApproved = reimbs.reduce((s, r) => s + (r.total_approved || 0), 0)
  const totalPaid = reimbs.reduce((s, r) => s + (r.total_paid || 0), 0)
  const pending = reimbs.filter((r) =>
    ['Aguardando Aprovação', 'Aguardando Envio'].includes(r.status),
  )
  const rejected = reimbs.filter((r) => r.status === 'Rejeitado')
  const avgPerVisit = reimbs.length > 0 ? totalRequested / reimbs.length : 0

  const kpis = [
    {
      label: 'Total Solicitado',
      value: 'R$ ' + totalRequested.toFixed(2),
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Aprovado',
      value: 'R$ ' + totalApproved.toFixed(2),
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Total Pago',
      value: 'R$ ' + totalPaid.toFixed(2),
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Pendentes',
      value: pending.length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Rejeitados',
      value: rejected.length,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Média/Visita',
      value: 'R$ ' + avgPerVisit.toFixed(2),
      icon: AlertTriangle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  const statusData = [
    'Aguardando Aprovação',
    'Aprovado',
    'Rejeitado',
    'Pago',
    'Parcialmente Aprovado',
  ]
    .map((s) => ({
      name: s,
      value: reimbs.filter((r) => r.status === s).length,
    }))
    .filter((d) => d.value > 0)

  const chartConfig: ChartConfig = { value: { label: 'Qtd', color: 'hsl(var(--chart-1))' } }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard de Reembolsos</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportToCsv(
              'reembolsos.csv',
              reimbs.map((r) => ({
                Técnico: techs.find((t) => t.id === r.technician)?.name || '',
                Status: r.status,
                Solicitado: r.total_requested,
                Aprovado: r.total_approved,
                Pago: r.total_paid,
              })),
              ['Técnico', 'Status', 'Solicitado', 'Aprovado', 'Pago'],
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-4">
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
      <div className="grid gap-4 md:grid-cols-2">
        {statusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status dos Reembolsos</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valor por Técnico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y">
                  <tr>
                    <th className="p-3">Técnico</th>
                    <th className="p-3">Solicitado</th>
                    <th className="p-3">Aprovado</th>
                    <th className="p-3">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {techs
                    .filter((t: any) => ['tecnico', 'gestor', 'admin'].includes(t.role))
                    .map((t: any) => {
                      const techReimbs = reimbs.filter((r) => r.technician === t.id)
                      if (techReimbs.length === 0) return null
                      return (
                        <tr key={t.id}>
                          <td className="p-3 font-medium">{t.name}</td>
                          <td className="p-3">
                            R${' '}
                            {techReimbs
                              .reduce((s, r) => s + (r.total_requested || 0), 0)
                              .toFixed(2)}
                          </td>
                          <td className="p-3">
                            R${' '}
                            {techReimbs.reduce((s, r) => s + (r.total_approved || 0), 0).toFixed(2)}
                          </td>
                          <td className="p-3">
                            R$ {techReimbs.reduce((s, r) => s + (r.total_paid || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
