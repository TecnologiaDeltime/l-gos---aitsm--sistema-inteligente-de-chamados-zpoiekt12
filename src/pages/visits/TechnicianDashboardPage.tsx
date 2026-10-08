import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Target,
  BarChart3,
  Timer,
  CheckCircle2,
  CalendarDays,
  Percent,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from 'recharts'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getOperatorInteractions, TicketInteractionRecord } from '@/services/ticket-interactions'
import { getTickets, TicketRecord } from '@/services/tickets'
import { getSlaGoals, SlaGoalRecord } from '@/services/sla-goals'
import { useRealtime } from '@/hooks/use-realtime'
import { formatHours, formatMinutes } from '@/lib/duration'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function formatHoursNumberLabel(value: any): string {
  if (value === undefined || value === null) return ''
  const n = Number(value)
  if (isNaN(n) || n === 0) return '0h'
  return `${n.toFixed(1)}h`
}

export default function TechnicianDashboardPage() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [interactions, setInteractions] = useState<TicketInteractionRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [goals, setGoals] = useState<SlaGoalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtro de mês: padrão é o mês atual (ou null se usuário limpar, mas com navegação)
  // Estrutura do mês selecionado: { year, month } (month 0-11)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>({
    year: now.getFullYear(),
    month: now.getMonth(),
  })

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [allVisits, allInteractions, allTickets, allGoals] = await Promise.all([
        getVisits(`technician = "${user.id}"`),
        getOperatorInteractions(user.id),
        getTickets(`assigned_to = "${user.id}"`),
        getSlaGoals(),
      ])
      setVisits(allVisits)
      setInteractions(allInteractions)
      setTickets(allTickets)
      setGoals(allGoals)
    } catch {
      /* intentionally ignored */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useRealtime('technical_visits', () => loadData())
  useRealtime('ticket_interactions', () => loadData())
  useRealtime('tickets', () => loadData())
  useRealtime('sla_goals', () => loadData())

  // Data de hoje (local)
  const todayDate = new Date()
  const todayYear = todayDate.getFullYear()
  const todayMonth = todayDate.getMonth()
  const todayDay = todayDate.getDate()
  const todayDateStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`

  // ==============================================================
  // 1. Bloco de Horas do Dia e Visitas Hoje (mantidos)
  // ==============================================================
  const todayVisits = useMemo(() => {
    return visits.filter((v) => {
      const dateStr = v.scheduled_date ? v.scheduled_date.slice(0, 10) : ''
      return dateStr === todayDateStr
    })
  }, [visits, todayDateStr])

  const todayInteractions = useMemo(() => {
    return interactions.filter((i) => {
      if (!i.created) return false
      const d = new Date(i.created)
      return (
        d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDay
      )
    })
  }, [interactions, todayYear, todayMonth, todayDay])

  const todayInteractionsMinutes = useMemo(() => {
    return todayInteractions.reduce((s, i) => s + (i.duration_minutes || 0), 0)
  }, [todayInteractions])

  // ==============================================================
  // 2. Filtro do Mês e Horas das Interações no Mês Filtrado
  // Se não houver filtro, usa o mês atual (ou último mês)
  // ==============================================================
  const activeMonthRange = useMemo(() => {
    if (selectedMonth) {
      const start = new Date(selectedMonth.year, selectedMonth.month, 1, 0, 0, 0, 0)
      const end = new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999)
      return { start, end, label: `${MONTH_NAMES[selectedMonth.month]} de ${selectedMonth.year}` }
    }
    // "se não houver filtro mostre do ultimo mês"
    const lastMonthDate = new Date(todayYear, todayMonth - 1, 1)
    const start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    )
    return {
      start,
      end,
      label: `Último mês (${MONTH_NAMES[lastMonthDate.getMonth()]} de ${lastMonthDate.getFullYear()})`,
    }
  }, [selectedMonth, todayYear, todayMonth])

  // Interações no período do filtro
  const filteredInteractions = useMemo(() => {
    return interactions.filter((i) => {
      if (!i.created) return false
      const d = new Date(i.created)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })
  }, [interactions, activeMonthRange])

  const filteredInteractionsMinutes = useMemo(() => {
    return filteredInteractions.reduce((s, i) => s + (i.duration_minutes || 0), 0)
  }, [filteredInteractions])

  // Chamados do técnico no período do filtro (por data de criação)
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (!t.created) return false
      const d = new Date(t.created)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })
  }, [tickets, activeMonthRange])

  // Chamados resolvidos no período do filtro (para métrica de resolução)
  const filteredResolvedTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (!['Resolvido', 'Encerrado'].includes(t.status)) return false
      // Usa data de resolução se existir, senão updated/created
      const resDateStr = t.resolution_date || t.closure_date || t.updated || t.created
      if (!resDateStr) return false
      const d = new Date(resDateStr)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })
  }, [tickets, activeMonthRange])

  // ==============================================================
  // 3. Tempo médio de atendimento e Tempo médio de resolução
  // No período do filtro aplicado (se não houver filtro, do último mês)
  //
  // Tempo médio de atendimento: média de minutos trabalhados nas interações
  // por chamado atendido no período (ou média de duração das interações)
  // Tempo médio de resolução: tempo entre created e resolução do chamado
  // ==============================================================
  const { avgAttendanceMinutes, avgResolutionMinutes } = useMemo(() => {
    // Tempo médio de atendimento:
    // Agrupa as durações das interações por chamado no período
    const ticketDurations = new Map<string, number>()
    filteredInteractions.forEach((i) => {
      if (!i.ticket) return
      ticketDurations.set(
        i.ticket,
        (ticketDurations.get(i.ticket) || 0) + (i.duration_minutes || 0),
      )
    })

    const attendanceMinutesList = Array.from(ticketDurations.values()).filter((m) => m > 0)
    const avgAttendance =
      attendanceMinutesList.length > 0
        ? Math.round(
            attendanceMinutesList.reduce((acc, val) => acc + val, 0) / attendanceMinutesList.length,
          )
        : 0

    // Tempo médio de resolução:
    // Diferença em minutos entre created e resolution_date (ou closure_date)
    const resolutionMinutesList: number[] = []
    filteredResolvedTickets.forEach((t) => {
      if (!t.created) return
      const resDate = t.resolution_date || t.closure_date
      if (!resDate) return
      const createdMs = new Date(t.created).getTime()
      const resolvedMs = new Date(resDate).getTime()
      const diffMin = Math.round((resolvedMs - createdMs) / 60000)
      if (diffMin >= 0) {
        resolutionMinutesList.push(diffMin)
      }
    })

    const avgResolution =
      resolutionMinutesList.length > 0
        ? Math.round(
            resolutionMinutesList.reduce((acc, val) => acc + val, 0) / resolutionMinutesList.length,
          )
        : 0

    return {
      avgAttendanceMinutes: avgAttendance,
      avgResolutionMinutes: avgResolution,
    }
  }, [filteredInteractions, filteredResolvedTickets])

  // ==============================================================
  // 4. Últimos 3 meses (interações, chamados resolvidos, visitas)
  // ==============================================================
  const last3MonthsData = useMemo(() => {
    // Gera os 3 meses: mês atual, mês -1, mês -2
    const months: Array<{
      year: number
      month: number
      label: string
      key: string
      start: Date
      end: Date
      hours: number
      interactionsCount: number
    }> = []

    for (let i = 2; i >= 0; i--) {
      const d = new Date(todayYear, todayMonth - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const start = new Date(y, m, 1, 0, 0, 0, 0)
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
      months.push({
        year: y,
        month: m,
        label: `${MONTH_SHORT[m]}/${String(y).slice(-2)}`,
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        start,
        end,
        hours: 0,
        interactionsCount: 0,
      })
    }

    // Calcula horas de interações de cada mês
    interactions.forEach((it) => {
      if (!it.created) return
      const itDate = new Date(it.created)
      const targetMonth = months.find((m) => itDate >= m.start && itDate <= m.end)
      if (targetMonth) {
        targetMonth.hours += (it.duration_minutes || 0) / 60
        targetMonth.interactionsCount += 1
      }
    })

    return months.map((m) => ({
      ...m,
      Horas: Number(m.hours.toFixed(2)),
    }))
  }, [interactions, todayYear, todayMonth])

  // Início e fim da janela de 3 meses para contar resolvidos e visitas
  const threeMonthsWindow = useMemo(() => {
    const start = new Date(todayYear, todayMonth - 2, 1, 0, 0, 0, 0)
    const end = new Date(todayYear, todayMonth + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }, [todayYear, todayMonth])

  // Total de chamados resolvidos dos últimos 3 meses
  const totalResolved3Months = useMemo(() => {
    return tickets.filter((t) => {
      if (!['Resolvido', 'Encerrado'].includes(t.status)) return false
      const resDateStr = t.resolution_date || t.closure_date || t.updated || t.created
      if (!resDateStr) return false
      const d = new Date(resDateStr)
      return d >= threeMonthsWindow.start && d <= threeMonthsWindow.end
    }).length
  }, [tickets, threeMonthsWindow])

  // Quantidade de visitas realizadas dos últimos 3 meses
  const totalVisitsCompleted3Months = useMemo(() => {
    return visits.filter((v) => {
      if (v.status !== 'Concluída') return false
      const vDateStr = v.checkout_at || v.scheduled_date || v.created
      if (!vDateStr) return false
      const d = new Date(vDateStr)
      return d >= threeMonthsWindow.start && d <= threeMonthsWindow.end
    }).length
  }, [visits, threeMonthsWindow])

  // ==============================================================
  // 5. Metas do Técnico mostrando SOMENTE os percentuais de atuação dele
  // Metas cadastradas em sla_goals + percentual atingido pelo técnico
  // ==============================================================
  const technicianGoals = useMemo(() => {
    if (!user) return []

    const userGoals = goals.filter((g) => g.technician === user.id)

    // Calcula cumprimento de SLA do técnico nos chamados atribuídos a ele
    // Usa a janela do filtro selecionado (ou últimos 30 dias se sem filtro)
    const relevantTickets = filteredTickets.length > 0 ? filteredTickets : tickets

    const responseTotal = relevantTickets.filter(
      (t) => t.sla_response_deadline || t.sla_response_at || t.sla_status,
    ).length
    const responseMet = relevantTickets.filter((t) => {
      if (t.sla_response_at && t.sla_response_deadline) {
        return new Date(t.sla_response_at).getTime() <= new Date(t.sla_response_deadline).getTime()
      }
      return t.sla_status === 'Dentro do Prazo' || t.sla_status === 'Atenção'
    }).length

    const solutionTotal = relevantTickets.filter(
      (t) => t.sla_solution_deadline || t.sla_solution_at || t.sla_status,
    ).length
    const solutionMet = relevantTickets.filter((t) => {
      if (t.sla_solution_at && t.sla_solution_deadline) {
        return new Date(t.sla_solution_at).getTime() <= new Date(t.sla_solution_deadline).getTime()
      }
      return t.sla_status === 'Dentro do Prazo' || t.sla_status === 'Atenção'
    }).length

    const actualResponsePct = responseTotal > 0 ? (responseMet / responseTotal) * 100 : 0
    const actualSolutionPct = solutionTotal > 0 ? (solutionMet / solutionTotal) * 100 : 0

    // Meta cadastrada para resposta e solução
    const goalResponse = userGoals.find((g) => g.sla_type === 'Resposta')
    const goalSolution = userGoals.find((g) => g.sla_type === 'Solução')

    // Atuação geral: percentual de resolução no período
    const resolutionPct =
      relevantTickets.length > 0
        ? (relevantTickets.filter((t) => ['Resolvido', 'Encerrado'].includes(t.status)).length /
            relevantTickets.length) *
          100
        : 0

    const list: Array<{
      title: string
      actualPct: number
      targetPct?: number
      progressPct: number // progresso da meta (ex: 80% atingido de uma meta de 90% = 88.8% ou clamp 100%)
      statusText: string
      colorClass: string
    }> = []

    // Meta de SLA de Resposta
    const targetResp = goalResponse?.target_percentage ?? 90
    const respProgress =
      targetResp > 0 ? Math.min(100, (actualResponsePct / targetResp) * 100) : 100
    list.push({
      title: 'SLA de Resposta',
      actualPct: actualResponsePct,
      targetPct: targetResp,
      progressPct: respProgress,
      statusText:
        actualResponsePct >= targetResp
          ? 'Meta atingida'
          : `${(targetResp - actualResponsePct).toFixed(1)}% abaixo da meta`,
      colorClass: actualResponsePct >= targetResp ? 'text-emerald-600' : 'text-amber-600',
    })

    // Meta de SLA de Solução
    const targetSol = goalSolution?.target_percentage ?? 85
    const solProgress = targetSol > 0 ? Math.min(100, (actualSolutionPct / targetSol) * 100) : 100
    list.push({
      title: 'SLA de Solução',
      actualPct: actualSolutionPct,
      targetPct: targetSol,
      progressPct: solProgress,
      statusText:
        actualSolutionPct >= targetSol
          ? 'Meta atingida'
          : `${(targetSol - actualSolutionPct).toFixed(1)}% abaixo da meta`,
      colorClass: actualSolutionPct >= targetSol ? 'text-emerald-600' : 'text-amber-600',
    })

    // Taxa de Efetividade / Resolução de Chamados
    list.push({
      title: 'Efetividade de Resolução',
      actualPct: resolutionPct,
      targetPct: 80,
      progressPct: Math.min(100, (resolutionPct / 80) * 100),
      statusText:
        resolutionPct >= 80
          ? 'Meta atingida'
          : `${(80 - resolutionPct).toFixed(1)}% abaixo da meta`,
      colorClass: resolutionPct >= 80 ? 'text-emerald-600' : 'text-indigo-600',
    })

    return list
  }, [user, goals, filteredTickets, tickets])

  // Controles de navegação de mês
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => {
      const base = prev || { year: todayYear, month: todayMonth }
      if (base.month === 0) {
        return { year: base.year - 1, month: 11 }
      }
      return { year: base.year, month: base.month - 1 }
    })
  }

  const handleNextMonth = () => {
    setSelectedMonth((prev) => {
      const base = prev || { year: todayYear, month: todayMonth }
      if (base.month === 11) {
        return { year: base.year + 1, month: 0 }
      }
      return { year: base.year, month: base.month + 1 }
    })
  }

  const handleCurrentMonth = () => {
    setSelectedMonth({ year: todayYear, month: todayMonth })
  }

  const handleClearMonthFilter = () => {
    setSelectedMonth(null)
  }

  const isCurrentMonthSelected =
    selectedMonth && selectedMonth.year === todayYear && selectedMonth.month === todayMonth

  return (
    <div className="space-y-6">
      {/* Header com Boas-vindas e Filtro por Mês */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Painel do Técnico</h2>
          <p className="text-xs text-slate-500">
            Acompanhamento de horas de interações, métricas de atendimento, visitas e cumprimento de
            metas
          </p>
        </div>

        {/* Filtro / Seletor de Período por Mês */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border rounded-lg p-1.5 shadow-xs">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevMonth}
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[150px] text-center px-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                {selectedMonth
                  ? `${MONTH_NAMES[selectedMonth.month]} / ${selectedMonth.year}`
                  : 'Sem filtro (Último mês)'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextMonth}
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-1">
            <Button
              variant={isCurrentMonthSelected ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={handleCurrentMonth}
            >
              Mês Atual
            </Button>
            {selectedMonth !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-slate-500 hover:text-slate-800"
                onClick={handleClearMonthFilter}
                title="Remover filtro de mês específico"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Indicadores Principais (KPIs)                                  */}
      {/* Exatamente conforme o pedido do usuário:                      */}
      {/* - MANTIDO: "Visitas Hoje"                                     */}
      {/* - MANTIDO: "Horas Hoje" (bloco de horas do dia)               */}
      {/* - ADICIONADO: "Horas Interações (Mês Selecionado)"            */}
      {/* - ADICIONADO: "Total Resolvidos (Últimos 3 Meses)"            */}
      {/* - ADICIONADO: "Visitas Realizadas (Últimos 3 Meses)"          */}
      {/* - REMOVIDO: "Check-out", "Despesas Pendentes", "Km Hoje",     */}
      {/*   "Reembolsos"                                                */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* 1. Visitas Hoje (MANTIDO) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 w-fit mb-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Visitas Hoje</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {todayVisits.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Agendadas para hoje</p>
          </CardContent>
        </Card>

        {/* 2. Horas Hoje (MANTIDO - horas do dia) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 w-fit mb-2">
              <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Horas Hoje</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatMinutes(todayInteractionsMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Interações no dia de hoje</p>
          </CardContent>
        </Card>

        {/* 3. Horas Interações (Filtro por mês) */}
        <Card className="border border-blue-200 bg-blue-50/20 dark:border-blue-900 dark:bg-blue-950/10">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 w-fit mb-2">
              <Timer className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            </div>
            <p className="text-[11px] font-medium text-blue-900 dark:text-blue-200">
              Horas Interações (Mês)
            </p>
            <p className="text-2xl font-bold tracking-tight text-blue-950 dark:text-blue-100">
              {formatMinutes(filteredInteractionsMinutes)}
            </p>
            <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-0.5 truncate">
              {activeMonthRange.label}
            </p>
          </CardContent>
        </Card>

        {/* 4. Total de Chamados Resolvidos (Últimos 3 meses) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 w-fit mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Resolvidos (3 Meses)</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {totalResolved3Months}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Últimos 3 meses consolidados</p>
          </CardContent>
        </Card>

        {/* 5. Quantidade de Visitas Realizadas (Últimos 3 meses) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 w-fit mb-2">
              <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Visitas Feitas (3 Meses)</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {totalVisitsCompleted3Months}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Concluídas nos últimos 3 meses</p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Médias de Atendimento e Resolução (calculadas no período)      */}
      {/* "mostre o tempo médio de atendimento dele e o tempo médio de  */}
      {/* resolução de chamados calculádos no período do filtro aplicado */}
      {/* e se não houver filtro mostre do ultimo mês"                   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Tempo Médio de Atendimento
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Média de esforço técnico dedicado por chamado através das interações
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {formatMinutes(avgAttendanceMinutes)}
              </span>
              <span className="text-xs text-slate-500">
                ({(avgAttendanceMinutes / 60).toFixed(1)}h média / chamado)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Baseado em {filteredInteractions.length} interação(ões) registradas no período
              filtrado.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Tempo Médio de Resolução
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Tempo médio decorrido desde a abertura até a resolução dos chamados
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {formatMinutes(avgResolutionMinutes)}
              </span>
              <span className="text-xs text-slate-500">
                ({(avgResolutionMinutes / 60).toFixed(1)}h para solucionar)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Calculado sobre {filteredResolvedTickets.length} chamado(s) solucionados no período.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Gráfico dos Últimos 3 Meses + Metas (Percentuais)              */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico com as horas dos últimos 3 meses de interações */}
        <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Horas de Interações dos Últimos 3 Meses
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Consolidado Mensal
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Evolução das horas apontadas em atendimentos nos últimos 3 meses
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last3MonthsData}
                  margin={{ top: 20, right: 20, left: -10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    unit="h"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => [
                      `${Number(v).toFixed(2)}h (${formatHours(Number(v))})`,
                      'Horas Trabalhadas',
                    ]}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      borderColor: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="Horas" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    <LabelList
                      dataKey="Horas"
                      position="top"
                      formatter={formatHoursNumberLabel}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#1e293b' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-3 mt-2 text-center">
              {last3MonthsData.map((m) => (
                <div key={m.key} className="space-y-0.5">
                  <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {m.hours.toFixed(1)}h
                  </p>
                  <p className="text-[9px] text-slate-400">{m.interactionsCount} interação(ões)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Metas mostrando SOMENTE os percentuais de atuação dele */}
        <Card className="border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Minhas Metas
              </CardTitle>
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                <Percent className="h-3 w-3" /> Apenas %
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Percentuais de atuação e cumprimento de metas individuais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {technicianGoals.map((g, idx) => (
              <div
                key={idx}
                className="space-y-1.5 p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {g.title}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {g.actualPct.toFixed(1)}%
                    {g.targetPct !== undefined && (
                      <span className="text-[10px] text-slate-500 font-normal ml-1">
                        (meta: {g.targetPct}%)
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={g.progressPct} className="h-2" />
                <div className="flex items-center justify-between text-[10px]">
                  <span className={g.colorClass}>{g.statusText}</span>
                  <span className="text-slate-400 font-medium">
                    {g.progressPct.toFixed(0)}% da meta
                  </span>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-slate-400 text-center italic pt-1">
              Indicadores apurados estritamente em percentual de atuação pessoal.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Agenda de Hoje (mantida)                                       */}
      {/* ============================================================== */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" /> Agenda de Visitas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todayVisits.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">
              Nenhuma visita agendada para hoje.
            </p>
          ) : (
            todayVisits.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between border rounded-lg p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{v.status}</Badge>
                    <span className="text-xs font-semibold">
                      {v.scheduled_time} {v.expected_end_time ? `- ${v.expected_end_time}` : ''}
                    </span>
                    {v.appointment_type && (
                      <Badge variant="secondary" className="text-[9px]">
                        {v.appointment_type}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {v.client_address || 'Endereço não informado'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.visit_reason || 'Sem descrição'} · {v.client_contact || ''}{' '}
                    {v.contact_phone || ''}
                  </div>
                </div>
                {v.expand?.ticket && (
                  <Link
                    to={`/tickets/${v.ticket}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    #{v.expand.ticket.number}
                  </Link>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
