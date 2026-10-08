import { useMemo } from 'react'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ExecutiveKpiCard } from '@/components/dashboard/ExecutiveKpiCard'
import { CheckCircle, Calendar, Percent } from 'lucide-react'
import { computeVisitMetrics, computeMonthlyVisits } from '@/lib/dashboard-metrics'
import { formatMinutes } from '@/lib/duration'
import type { DashboardData } from '@/services/dashboard'

interface VisitsSectionProps {
  data: DashboardData
}

export function VisitsSection({ data }: VisitsSectionProps) {
  const metrics = useMemo(() => computeVisitMetrics(data.visits), [data.visits])
  const chartData = useMemo(() => computeMonthlyVisits(data.visits), [data.visits])

  const chartConfig: ChartConfig = {
    Agendadas: { label: 'Agendadas', color: 'hsl(var(--chart-1))' },
    Concluidas: { label: 'Concluídas', color: 'hsl(var(--chart-2))' },
  }

  const detailVisits = data.visits.slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ExecutiveKpiCard
          label="Visitas Agendadas"
          value={metrics.scheduled}
          icon={Calendar}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <ExecutiveKpiCard
          label="Visitas Concluídas"
          value={metrics.completed}
          icon={CheckCircle}
          color="text-green-600"
          bg="bg-green-50"
        />
        <ExecutiveKpiCard
          label="Taxa de Conclusão"
          value={`${metrics.completionRate.toFixed(1)}%`}
          icon={Percent}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>
      <ChartCard title="Visitas Agendadas x Concluídas por Mês">
        {chartData.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sem dados</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px]">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Agendadas" fill="hsl(var(--chart-1))" radius={4} />
              <Bar dataKey="Concluidas" fill="hsl(var(--chart-2))" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>
      <ChartCard title="Análise de Visitas (Detalhe)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b">
              <tr>
                <th className="p-2">Data Agendada</th>
                <th className="p-2">Data Realizada</th>
                <th className="p-2">Operador</th>
                <th className="p-2">Cliente</th>
                <th className="p-2">Chamado</th>
                <th className="p-2">Status</th>
                <th className="p-2">KM</th>
                <th className="p-2">Tempo</th>
                <th className="p-2">Deslocamento</th>
                <th className="p-2">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detailVisits.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-muted-foreground">
                    Sem visitas
                  </td>
                </tr>
              ) : (
                detailVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-secondary/30">
                    <td className="p-2">
                      {v.scheduled_date || '-'}
                      {v.scheduled_time ? ` ${v.scheduled_time}` : ''}
                    </td>
                    <td className="p-2">
                      {v.checkout_at ? new Date(v.checkout_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-2">{v.expand?.technician?.name || '-'}</td>
                    <td className="p-2">
                      {v.expand?.ticket?.expand?.company?.trade_name || v.client_address || '-'}
                    </td>
                    <td className="p-2">{v.expand?.ticket?.number || '-'}</td>
                    <td className="p-2">{v.status}</td>
                    <td className="p-2">{v.calculated_mileage?.toFixed(1) || '0'}km</td>
                    <td className="p-2 tabular-nums">{formatMinutes(v.total_time || 0)}</td>
                    <td className="p-2">
                      {v.reimbursement_amount ? `R$ ${v.reimbursement_amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-2 max-w-[150px] truncate">{v.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}
