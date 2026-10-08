import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  MapPin,
  Car,
  DollarSign,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { getExpenses } from '@/services/expenses'
import { getTravelEntries } from '@/services/travel-entries'
import { getTechnicianGoals, type TechnicianGoalRecord } from '@/services/technician-goals'
import { getTickets, type TicketRecord } from '@/services/tickets'
import { useRealtime } from '@/hooks/use-realtime'
import { Target, Award, ArrowRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export default function VisitManagerDashboard() {
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [travel, setTravel] = useState<any[]>([])
  const [techGoals, setTechGoals] = useState<TechnicianGoalRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])

  const loadData = async () => {
    try {
      const [v, t, e, tr, tg, tk] = await Promise.all([
        getVisits(),
        getUsers(),
        getExpenses(),
        getTravelEntries(),
        getTechnicianGoals(),
        getTickets(),
      ])
      setVisits(v)
      setTechs(t)
      setExpenses(e)
      setTravel(tr)
      setTechGoals(tg)
      setTickets(tk)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('technical_visits', () => loadData())
  useRealtime('technician_goals', () => loadData())

  const activeTechs = techs.filter((t: any) => ['tecnico', 'gestor', 'admin'].includes(t.role))
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisits = visits.filter((v) => v.scheduled_date?.slice(0, 10) === todayStr)
  const completed = todayVisits.filter((v) => v.status === 'Concluída')
  const pending = todayVisits.filter((v) => v.status === 'Agendada')
  const cancelled = todayVisits.filter((v) => v.status === 'Cancelada')
  const inProgress = todayVisits.filter((v) => v.status === 'Em Andamento')
  const late = pending.filter(
    (v) => v.scheduled_time && v.scheduled_time < new Date().toTimeString().slice(0, 5),
  )
  const totalMileage = visits.reduce((s, v) => s + (v.calculated_mileage || 0), 0)
  const pendingExpenses = expenses.filter((e) =>
    ['Rascunho', 'Aguardando Aprovação'].includes(e.approval_status),
  )
  const pendingReimb = visits.filter(
    (v) =>
      v.reimbursement_status &&
      ['Aguardando Aprovação', 'Aguardando Envio'].includes(v.reimbursement_status || ''),
  )
  const techStatusCount = activeTechs.reduce((acc: Record<string, number>, t: any) => {
    const v = visits.find((v) => v.technician === t.id && v.status === 'Em Andamento')
    const status = v?.technician_status || 'Disponível'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const kpis = [
    {
      label: 'Técnicos Ativos',
      value: activeTechs.length,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Visitas Hoje',
      value: todayVisits.length,
      icon: Clock,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Em Andamento',
      value: inProgress.length,
      icon: Activity,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Concluídas',
      value: completed.length,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Pendentes',
      value: pending.length,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Atrasadas',
      value: late.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Canceladas',
      value: cancelled.length,
      icon: XCircle,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
    },
    {
      label: 'KM Total',
      value: totalMileage.toFixed(0) + 'km',
      icon: Car,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  // Ranking de Metas vs Realizado dos Técnicos
  const techPerformanceRanking = useMemo(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    return activeTechs
      .map((tech: any) => {
        // Metas do técnico (mês atual ou geral)
        const userGoals = techGoals.filter((g) => g.technician === tech.id)
        const specificGoal = userGoals.find(
          (g) => g.period_type === 'mensal' && g.period_month === currentMonthKey,
        )
        const generalGoal = userGoals.find((g) => g.period_type === 'geral')
        const activeGoal = specificGoal || generalGoal

        const targetResp = activeGoal?.response_sla_target ?? 90
        const targetSol = activeGoal?.solution_sla_target ?? 85
        const targetEff = activeGoal?.resolution_effectiveness_target ?? 80

        // Chamados atribuídos ao técnico
        const techTickets = tickets.filter((tk) => tk.assigned_to === tech.id)
        const totalTickets = techTickets.length

        // SLA Resposta realizado
        const respCandidates = techTickets.filter(
          (tk) => tk.sla_response_deadline || tk.sla_response_at || tk.sla_status,
        )
        const respMet = respCandidates.filter((tk) => {
          if (tk.sla_response_at && tk.sla_response_deadline) {
            return (
              new Date(tk.sla_response_at).getTime() <= new Date(tk.sla_response_deadline).getTime()
            )
          }
          return tk.sla_status === 'Dentro do Prazo' || tk.sla_status === 'Atenção'
        }).length
        const actualResp = respCandidates.length > 0 ? (respMet / respCandidates.length) * 100 : 0

        // SLA Solução realizado
        const solCandidates = techTickets.filter(
          (tk) => tk.sla_solution_deadline || tk.sla_solution_at || tk.sla_status,
        )
        const solMet = solCandidates.filter((tk) => {
          if (tk.sla_solution_at && tk.sla_solution_deadline) {
            return (
              new Date(tk.sla_solution_at).getTime() <= new Date(tk.sla_solution_deadline).getTime()
            )
          }
          return tk.sla_status === 'Dentro do Prazo' || tk.sla_status === 'Atenção'
        }).length
        const actualSol = solCandidates.length > 0 ? (solMet / solCandidates.length) * 100 : 0

        // Efetividade de Resolução realizada
        const resolvedCount = techTickets.filter((tk) =>
          ['Resolvido', 'Encerrado'].includes(tk.status),
        ).length
        const actualEff = totalTickets > 0 ? (resolvedCount / totalTickets) * 100 : 0

        // Média global de cumprimento de metas (score percentual de atingimento)
        const scoreResp = targetResp > 0 ? Math.min(100, (actualResp / targetResp) * 100) : 100
        const scoreSol = targetSol > 0 ? Math.min(100, (actualSol / targetSol) * 100) : 100
        const scoreEff = targetEff > 0 ? Math.min(100, (actualEff / targetEff) * 100) : 100
        const averageCompliance = Math.round((scoreResp + scoreSol + scoreEff) / 3)

        return {
          tech,
          totalTickets,
          targetResp,
          actualResp: Math.round(actualResp * 10) / 10,
          targetSol,
          actualSol: Math.round(actualSol * 10) / 10,
          targetEff,
          actualEff: Math.round(actualEff * 10) / 10,
          averageCompliance,
        }
      })
      .sort((a, b) => b.averageCompliance - a.averageCompliance)
  }, [activeTechs, techGoals, tickets])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold">Dashboard de Gestão de Visitas</h2>
        <Link to="/sla-goals">
          <Button size="sm" variant="outline" className="text-xs">
            <Target className="h-4 w-4 mr-1.5 text-blue-600" /> Gerenciar Metas dos Técnicos
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${k.bg}`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status dos Técnicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(techStatusCount).map(([status, count]) => (
              <div key={status} className="flex justify-between text-xs">
                <span className="text-slate-500">{status}</span>
                <Badge>{count as React.ReactNode}</Badge>
              </div>
            ))}
            {activeTechs.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Despesas pendentes</span>
              <span className="font-bold text-amber-600">{pendingExpenses.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Reembolsos pendentes</span>
              <span className="font-bold text-orange-600">{pendingReimb.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Visitas sem check-out</span>
              <span className="font-bold text-red-600">{inProgress.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Metas vs. Realizado por Técnico (Ranking Simples) */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Ranking de Metas vs. Realizado por Técnico
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativo de atingimento dos 3 percentuais (SLA Resposta, SLA Solução, Efetividade)
            </p>
          </div>
          <Link
            to="/sla-goals"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Ver todas metas <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-y">
                <tr>
                  <th className="p-3">Posição</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3 text-center">SLA Resposta (Real vs Meta)</th>
                  <th className="p-3 text-center">SLA Solução (Real vs Meta)</th>
                  <th className="p-3 text-center">Efetividade (Real vs Meta)</th>
                  <th className="p-3 text-center">Atingimento Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {techPerformanceRanking.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhum técnico ativo com metas registradas.
                    </td>
                  </tr>
                ) : (
                  techPerformanceRanking.map((item, idx) => (
                    <tr
                      key={item.tech.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                    >
                      <td className="p-3 font-bold text-slate-500">#{idx + 1}</td>
                      <td className="p-3 font-medium">{item.tech.name || item.tech.email}</td>
                      <td className="p-3 text-center">
                        <span
                          className={
                            item.actualResp >= item.targetResp
                              ? 'font-semibold text-emerald-600'
                              : 'text-amber-600'
                          }
                        >
                          {item.actualResp}%
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          (meta: {item.targetResp}%)
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={
                            item.actualSol >= item.targetSol
                              ? 'font-semibold text-emerald-600'
                              : 'text-amber-600'
                          }
                        >
                          {item.actualSol}%
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          (meta: {item.targetSol}%)
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={
                            item.actualEff >= item.targetEff
                              ? 'font-semibold text-emerald-600'
                              : 'text-indigo-600'
                          }
                        >
                          {item.actualEff}%
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          (meta: {item.targetEff}%)
                        </span>
                      </td>
                      <td className="p-3 text-center min-w-[140px]">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={item.averageCompliance} className="h-2 w-16" />
                          <Badge
                            variant={item.averageCompliance >= 95 ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {item.averageCompliance}%
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visitas de Hoje</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Endereço</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {todayVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhuma visita hoje.
                    </td>
                  </tr>
                ) : (
                  todayVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium">{v.scheduled_time || '-'}</td>
                      <td className="p-3">{v.expand?.technician?.name || '-'}</td>
                      <td className="p-3">
                        {v.expand?.ticket?.expand?.company?.trade_name || v.client_address || '-'}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        <MapPin className="inline h-3 w-3" /> {v.client_address || '-'}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{v.status}</Badge>
                      </td>
                      <td className="p-3">
                        {v.expand?.ticket ? (
                          <Link
                            to={`/tickets/${v.ticket}`}
                            className="text-blue-600 hover:underline"
                          >
                            #{v.expand.ticket.number}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
