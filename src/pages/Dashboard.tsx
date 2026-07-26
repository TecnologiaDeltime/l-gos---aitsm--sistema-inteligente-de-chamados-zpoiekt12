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
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Em Atendimento',
      value: totalEmAtendimento,
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Aguardando Cliente',
      value: totalAguardando,
      icon: PauseCircle,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'SLA Violado',
      value: totalSlaViolado,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Críticos (P1)',
      value: totalP1,
      icon: Flame,
      color: 'text-red-500',
      bg: 'bg-red-500/15',
    },
    {
      label: 'SLA em Risco',
      value: totalEmRisco,
      icon: AlertCircle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/15',
    },
    {
      label: 'Resolvidos',
      value: totalResolvidos,
      icon: Calendar,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Backlog Total',
      value: tickets.length,
      icon: Layers,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Painel Geral</h2>
          <p className="text-sm text-slate-400 mt-0.5">Visão geral dos chamados e SLAs</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <Card
              key={idx}
              className="itsm-card itsm-card-hover cursor-default transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-amber-400 tabular-nums">{kpi.value}</p>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="itsm-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Chamados Recentes
          </CardTitle>
          <Link
            to="/tickets"
            className="text-xs font-medium text-amber-500 hover:text-amber-400 hover:underline flex items-center transition-colors duration-150"
          >
            Ver Todos <ArrowUpRight className="h-3 w-3 ml-0.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="itsm-table-header">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 6).map((t, idx) => (
                  <tr
                    key={t.id}
                    className={`itsm-table-row itsm-table-row-hover ${idx % 2 === 1 ? 'itsm-table-row-alt' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-amber-500">
                      <Link to={`/tickets/${t.id}`} className="hover:underline">
                        #{t.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200 max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {t.expand?.company?.trade_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 w-36">
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
