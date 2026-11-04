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
import { getTechnicianGoals, type TechnicianGoalRecord } from '@/services/technician-goals'
import { getSlaGoals, type SlaGoalRecord } from '@/services/sla-goals'
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
  if (isNaN(n) || n === 0) return '00:00:00'
  return formatHours(n)
}

export default function TechnicianDashboardPage() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [interactions, setInteractions] = useState<TicketInteractionRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [goals, setGoals] = useState<SlaGoalRecord[]>([])
  const [techGoals, setTechGoals] = useState<TechnicianGoalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtro de mês: por padrão sempre traga o mês atual no filtro.
  // Estrutura do mês selecionado: { year, month } (month 0-11)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth(),
  })

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [allVisits, allInteractions, allTickets, allGoals, allTechGoals] = await Promise.all([
        getVisits(`technician = "${user.id}"`),
        getOperatorInteractions(user.id),
        getTickets(`assigned_to = "${user.id}"`),
        getSlaGoals(),
        getTechnicianGoals(`technician = "${user.id}"`),
      ])
      setVisits(allVisits)
      setInteractions(allInteractions)
      setTickets(allTickets)
      setGoals(allGoals)
      setTechGoals(allTechGoals)
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
  useRealtime('technician_goals', () => loadData())

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
  // 2. Filtro do Mês e Período Ativo
  // "Todos os cartões devem mostrar dados conforme o filtro de mês, por padrão sempre traga o mês atual no filtro."
  // ==============================================================
  const activeMonthRange = useMemo(() => {
    const start = new Date(selectedMonth.year, selectedMonth.month, 1, 0, 0, 0, 0)
    const end = new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999)
    return { start, end, label: `${MONTH_NAMES[selectedMonth.month]} de ${selectedMonth.year}` }
  }, [selectedMonth])

  // Interações no período do filtro
  const filteredInteractions = useMemo(() => {
    return interactions.filter((i) => {
      if (!i.created) return false
      const d = new Date(i.created)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })
  }, [interactions, activeMonthRange])

  // Total de minutos de interações no período filtrado
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

  // Chamados resolvidos no período do filtro
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

  // Visitas concluídas/feitas no período do filtro
  const filteredCompletedVisits = useMemo(() => {
    return visits.filter((v) => {
      if (v.status !== 'Concluída') return false
      const vDateStr = v.checkout_at || v.scheduled_date || v.created
      if (!vDateStr) return false
      const d = new Date(vDateStr)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })
  }, [visits, activeMonthRange])

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
  // 4. SLA - Visões comparativas no período filtrado
  // a) Chamados resolvidos DENTRO do SLA vs. FORA do SLA (SLA Solução)
  // b) Chamados iniciados DENTRO do SLA vs. FORA do SLA (SLA Resposta)
  // ==============================================================
  const slaComparisons = useMemo(() => {
    // 1. Resolução (considera chamados resolvidos no período)
    let solWithin = 0
    let solOutside = 0

    filteredResolvedTickets.forEach((t) => {
      const resDateStr = t.sla_solution_at || t.resolution_date || t.closure_date
      if (t.sla_solution_deadline) {
        if (resDateStr) {
          const resMs = new Date(resDateStr).getTime()
          const dlMs = new Date(t.sla_solution_deadline).getTime()
          if (resMs <= dlMs) {
            solWithin += 1
          } else {
            solOutside += 1
          }
        } else {
          // Sem data de resolução explícita, recorre ao sla_status
          if (t.sla_status === 'Violado') {
            solOutside += 1
          } else {
            solWithin += 1
          }
        }
      } else {
        // Sem deadline de solução cadastrado: verificar se marcou Violado
        if (t.sla_status === 'Violado') {
          solOutside += 1
        } else {
          solWithin += 1
        }
      }
    })

    const solTotal = solWithin + solOutside
    const solPct = solTotal > 0 ? (solWithin / solTotal) * 100 : 100

    // 2. Iniciados / Primeira Resposta (considera chamados iniciados no período filtrado)
    // Chamados do técnico com data de início (sla_response_start ou sla_response_at) no período
    const startedTicketsInPeriod = tickets.filter((t) => {
      const startStr = t.sla_response_start || t.sla_response_at
      if (!startStr) return false
      const d = new Date(startStr)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })

    let respWithin = 0
    let respOutside = 0

    startedTicketsInPeriod.forEach((t) => {
      const startStr = t.sla_response_start || t.sla_response_at
      if (!startStr) return
      if (t.sla_response_deadline) {
        const startMs = new Date(startStr).getTime()
        const dlMs = new Date(t.sla_response_deadline).getTime()
        if (startMs <= dlMs) {
          respWithin += 1
        } else {
          respOutside += 1
        }
      } else {
        // Se não houver deadline de resposta cadastrado
        if (t.sla_status === 'Violado') {
          respOutside += 1
        } else {
          respWithin += 1
        }
      }
    })

    const respTotal = respWithin + respOutside
    const respPct = respTotal > 0 ? (respWithin / respTotal) * 100 : 100

    return {
      solution: {
        within: solWithin,
        outside: solOutside,
        total: solTotal,
        adherencePct: solPct,
      },
      response: {
        within: respWithin,
        outside: respOutside,
        total: respTotal,
        adherencePct: respPct,
      },
    }
  }, [filteredResolvedTickets, tickets, activeMonthRange])

  // ==============================================================
  // 5. Últimos 3 meses (interações em relação ao mês selecionado)
  // ==============================================================
  const last3MonthsData = useMemo(() => {
    // Gera 3 meses terminando no mês atualmente selecionado
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
      const d = new Date(selectedMonth.year, selectedMonth.month - i, 1)
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
  }, [interactions, selectedMonth])

  // ==============================================================
  // 5. Metas do Técnico mostrando SOMENTE os percentuais de atuação dele
  // Metas cadastradas em technician_goals (mês do filtro ou vigência geral) com fallback
  // ==============================================================
  const technicianGoals = useMemo(() => {
    if (!user) return []

    // Identifica mês selecionado no filtro (formato YYYY-MM)
    const selectedMonthKey = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`

    // 1. Prioridade: meta específica para o mês selecionado
    const monthSpecificGoal = techGoals.find(
      (g) => g.period_type === 'mensal' && g.period_month === selectedMonthKey,
    )
    // 2. Segunda opção: meta de vigência geral (contínua)
    const generalGoal = techGoals.find((g) => g.period_type === 'geral')

    const activeCustomGoal = monthSpecificGoal || generalGoal

    // Fallback legado (sla_goals) se não houver technician_goals
    const userLegacyGoals = goals.filter((g) => g.technician === user.id)
    const legacyGoalResponse = userLegacyGoals.find((g) => g.sla_type === 'Resposta')
    const legacyGoalSolution = userLegacyGoals.find((g) => g.sla_type === 'Solução')

    const targetResp =
      activeCustomGoal?.response_sla_target ?? legacyGoalResponse?.target_percentage ?? 90
    const targetSol =
      activeCustomGoal?.solution_sla_target ?? legacyGoalSolution?.target_percentage ?? 85
    const targetEff = activeCustomGoal?.resolution_effectiveness_target ?? 80

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

    // 1. Meta de SLA de Resposta
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

    // 2. Meta de SLA de Solução
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

    // 3. Taxa de Efetividade / Resolução de Chamados
    const effProgress = targetEff > 0 ? Math.min(100, (resolutionPct / targetEff) * 100) : 100
    list.push({
      title: 'Efetividade de Resolução',
      actualPct: resolutionPct,
      targetPct: targetEff,
      progressPct: effProgress,
      statusText:
        resolutionPct >= targetEff
          ? 'Meta atingida'
          : `${(targetEff - resolutionPct).toFixed(1)}% abaixo da meta`,
      colorClass: resolutionPct >= targetEff ? 'text-emerald-600' : 'text-indigo-600',
    })

    return list
  }, [user, techGoals, goals, filteredTickets, tickets, selectedMonth])

  // Controles de navegação de mês
  const handlePrevMonth = () => {
    setSelectedMonth((base) => {
      if (base.month === 0) {
        return { year: base.year - 1, month: 11 }
      }
      return { year: base.year, month: base.month - 1 }
    })
  }

  const handleNextMonth = () => {
    setSelectedMonth((base) => {
      if (base.month === 11) {
        return { year: base.year + 1, month: 0 }
      }
      return { year: base.year, month: base.month + 1 }
    })
  }

  const handleCurrentMonth = () => {
    setSelectedMonth({ year: todayYear, month: todayMonth })
  }

  const isCurrentMonthSelected =
    selectedMonth.year === todayYear && selectedMonth.month === todayMonth

  return (
    <div className="space-y-6">
      {/* Header com Boas-vindas e Filtro por Mês */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Painel do Operador</h2>
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
                {`${MONTH_NAMES[selectedMonth.month]} / ${selectedMonth.year}`}
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
              className="h-7 text-xs px-2.5 font-medium"
              onClick={handleCurrentMonth}
            >
              Mês Atual
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Indicadores Principais (KPIs)                                  */}
      {/* Conforme pedido do usuário:                                   */}
      {/* - Visitas Hoje (mantido, dia corrente)                         */}
      {/* - Horas Hoje (mantido, dia corrente)                          */}
      {/* - Horas Acumuladas (adicionado, período do filtro)             */}
      {/* - Total de horas (substitui 'Horas Interações (Mês)')          */}
      {/* - Total Resolvidos (substitui 'Resolvidos (3 Meses)')          */}
      {/* - Visitas Realizadas (conforme período do filtro)              */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* 1. Visitas Hoje (mantido) */}
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

        {/* 2. Horas Hoje (mantido - horas do dia corrente) */}
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

        {/* 3. Horas Acumuladas (novo - acumuladas no período do filtro) */}
        <Card className="border border-amber-200 bg-amber-50/20 dark:border-amber-900 dark:bg-amber-950/10">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 w-fit mb-2">
              <Clock className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
              Horas Acumuladas
            </p>
            <p className="text-2xl font-bold tracking-tight text-amber-950 dark:text-amber-100">
              {formatMinutes(filteredInteractionsMinutes)}
            </p>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 truncate">
              {activeMonthRange.label}
            </p>
          </CardContent>
        </Card>

        {/* 4. Total de horas (substitui 'Horas Interações (Mês)') */}
        <Card className="border border-blue-200 bg-blue-50/20 dark:border-blue-900 dark:bg-blue-950/10">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 w-fit mb-2">
              <Timer className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            </div>
            <p className="text-[11px] font-medium text-blue-900 dark:text-blue-200">
              Total de horas
            </p>
            <p className="text-2xl font-bold tracking-tight text-blue-950 dark:text-blue-100">
              {formatMinutes(filteredInteractionsMinutes)}
            </p>
            <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-0.5 truncate">
              {activeMonthRange.label}
            </p>
          </CardContent>
        </Card>

        {/* 5. Total Resolvidos (substitui 'Resolvidos (3 Meses)' - segue o período do filtro) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 w-fit mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Total Resolvidos</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {filteredResolvedTickets.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{activeMonthRange.label}</p>
          </CardContent>
        </Card>

        {/* 6. Visitas Realizadas (no período do filtro) */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 w-fit mb-2">
              <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Visitas Realizadas</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {filteredCompletedVisits.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{activeMonthRange.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* SLA: Visões Comparativas (Dentro vs. Fora do SLA)              */}
      {/* - Total de chamados Resolvidos dentro do SLA X fora do SLA     */}
      {/* - Total de chamados iniciados dentro do SLA X fora do SLA      */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chamados Resolvidos: Dentro vs. Fora do SLA */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Chamados Resolvidos: SLA Solução
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Cumprimento do SLA de Solução nos chamados solucionados no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Dentro do SLA
                </p>
                <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                  {slaComparisons.solution.within}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                  Solucionados no prazo
                </p>
              </div>

              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20">
                <p className="text-[11px] font-medium text-rose-800 dark:text-rose-300">
                  Fora do SLA
                </p>
                <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
                  {slaComparisons.solution.outside}
                </p>
                <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  Prazo excedido
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Aderência ao SLA de Solução
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {slaComparisons.solution.adherencePct.toFixed(1)}%
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({slaComparisons.solution.within}/{slaComparisons.solution.total} resolvidos)
                  </span>
                </span>
              </div>
              <Progress value={slaComparisons.solution.adherencePct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Chamados Iniciados: Dentro vs. Fora do SLA */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-600" />
                Chamados Iniciados: SLA Resposta
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Cumprimento do SLA de Resposta nos atendimentos iniciados no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Dentro do SLA
                </p>
                <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                  {slaComparisons.response.within}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                  Iniciados no prazo
                </p>
              </div>

              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20">
                <p className="text-[11px] font-medium text-rose-800 dark:text-rose-300">
                  Fora do SLA
                </p>
                <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
                  {slaComparisons.response.outside}
                </p>
                <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  Início após o prazo
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Aderência ao SLA de Resposta
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {slaComparisons.response.adherencePct.toFixed(1)}%
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({slaComparisons.response.within}/{slaComparisons.response.total} iniciados)
                  </span>
                </span>
              </div>
              <Progress value={slaComparisons.response.adherencePct} className="h-2" />
            </div>
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
                    formatter={(v: any) => [formatHours(Number(v)), 'Horas Trabalhadas']}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      borderColor: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="Horas" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={60}>
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
                    {formatHours(m.hours)}
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
