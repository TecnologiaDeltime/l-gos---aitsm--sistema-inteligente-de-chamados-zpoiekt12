import { useEffect, useState } from 'react'
import {
  Inbox,
  Clock,
  PauseCircle,
  AlertTriangle,
  Flame,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTickets, TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .catch(() => {})
  }, [])

  const totalNovos = tickets.filter((t) => t.status === 'Novo').length
  const totalEmAtendimento = tickets.filter((t) => t.status === 'Em Atendimento').length
  const totalAguardando = tickets.filter((t) => t.status === 'Aguardando Cliente').length
  const totalSlaViolado = tickets.filter((t) => t.sla_status === 'Violado').length
  const totalP1 = tickets.filter((t) => t.priority === 'P1').length
  const totalEmRisco = tickets.filter(
    (t) => t.sla_status === 'Risco' || t.sla_status === 'Crítico',
  ).length
  const totalResolvidos = tickets.filter(
    (t) => t.status === 'Resolvido' || t.status === 'Encerrado',
  ).length

  const kpis = [
    {
      label: 'Chamados Novos',
      value: totalNovos,
      icon: Inbox,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Em Atendimento',
      value: totalEmAtendimento,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Aguardando Cliente',
      value: totalAguardando,
      icon: PauseCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'SLA Violado',
      value: totalSlaViolado,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Críticos (P1)',
      value: totalP1,
      icon: Flame,
      color: 'text-red-700',
      bg: 'bg-red-100',
    },
    {
      label: 'SLA em Risco',
      value: totalEmRisco,
      icon: AlertCircle,
      color: 'text-amber-700',
      bg: 'bg-amber-100',
    },
    {
      label: 'Resolvidos',
      value: totalResolvidos,
      icon: Calendar,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Backlog Total',
      value: tickets.length,
      icon: Layers,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <Card key={idx} className="border border-slate-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${kpi.bg}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Tickets Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Chamados Recentes</CardTitle>
          <Link to="/tickets" className="text-xs text-blue-600 hover:underline flex items-center">
            Ver Todos <ArrowUpRight className="h-3 w-3 ml-1" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-y text-slate-700">
                <tr>
                  <th className="p-3">Nº</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.slice(0, 6).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-blue-600">
                      <Link to={`/tickets/${t.id}`}>#{t.number}</Link>
                    </td>
                    <td className="p-3 font-medium text-slate-800 max-w-xs truncate">{t.title}</td>
                    <td className="p-3">{t.expand?.company?.trade_name || 'N/A'}</td>
                    <td className="p-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="p-3 w-36">
                      <SlaProgressBar slaStatus={t.sla_status} paused={t.sla_paused} />
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
