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
  TrendingUp,
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

export default function OperatorDashboard() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [interactions, setInteractions] = useState<TicketInteractionRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [goals, setGoals] = useState<SlaGoalRecord[]>([])
  const [techGoals, setTechGoals] = useState<TechnicianGoalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtro de mês: por padrão sempre traz o mês atual
  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDay = now.getDate()
  const todayDateStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: todayYear,
    month: todayMonth,
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

  // ==============================================================
  // 1. Visitas e Horas do Dia de Hoje
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

  // Separação de horas de hoje:
  // - Horas trabalhadas hoje (origin === 'Cronômetro' ou play/pause)
  // - Horas de acompanhamento hoje (origin !== 'Cronômetro', manuais/logs que debitam franquia)
  const todayWorkedMinutes = useMemo(() => {
    return todayInteractions
      .filter((i) => i.origin === 'Cronômetro')
      .reduce((s, i) => s + (i.duration_minutes || 0), 0)
  }, [todayInteractions])

  const todayAccompanimentMinutes = useMemo(() => {
    return todayInteractions
      .filter((i) => i.origin !== 'Cronômetro')
      .reduce((s, i) => s + (i.duration_minutes || 0), 0)
  }, [todayInteractions])

  const todayTotalMinutes = todayWorkedMinutes + todayAccompanimentMinutes

  // ==============================================================
  // 2. Filtro do Mês e Período Ativo
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

  // Regra Oficial de Horas (v0.0.276):
  // 1. Horas de Acompanhamento (origin !== 'Cronômetro'): debitam a franquia do cliente
  // 2. Horas Trabalhadas (origin === 'Cronômetro'): play/pause do operador, acumulam no operador e NÃO debitam
  const {
    filteredWorkedMinutes,
    filteredAccompanimentMinutes,
    filteredTotalMinutes,
    workedLogsCount,
    accompanimentLogsCount,
  } = useMemo(() => {
    let worked = 0
    let accompaniment = 0
    let workedCount = 0
    let accCount = 0

    filteredInteractions.forEach((i) => {
      const dur = i.duration_minutes || 0
      if (i.origin === 'Cronômetro') {
        worked += dur
        workedCount += 1
      } else {
        accompaniment += dur
        accCount += 1
      }
    })

    return {
      filteredWorkedMinutes: worked,
      filteredAccompanimentMinutes: accompaniment,
      filteredTotalMinutes: worked + accompaniment,
      workedLogsCount: workedCount,
      accompanimentLogsCount: accCount,
    }
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
  // 3. Tempo Médio de Atendimento e Tempo Médio de Resolução
  // ==============================================================
  const { avgAttendanceMinutes, avgResolutionMinutes } = useMemo(() => {
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
  // a) SLA Solução (Dentro vs. Fora do SLA)
  // b) SLA Resposta (Em conformidade vs. Fora de conformidade / Dentro vs. Fora)
  // ==============================================================
  const slaComparisons = useMemo(() => {
    // 1. Resolução
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
          if (t.sla_status === 'Violado') {
            solOutside += 1
          } else {
            solWithin += 1
          }
        }
      } else {
        if (t.sla_status === 'Violado') {
          solOutside += 1
        } else {
          solWithin += 1
        }
      }
    })

    const solTotal = solWithin + solOutside
    const solPct = solTotal > 0 ? (solWithin / solTotal) * 100 : 100

    // 2. Primeira Resposta / Play/Pause
    // O play no chamado registra sla_response_compliance ('Em conformidade' | 'Fora de conformidade')
    const startedTicketsInPeriod = tickets.filter((t) => {
      const startStr = t.sla_response_start || t.sla_response_at
      if (!startStr) return false
      const d = new Date(startStr)
      return d >= activeMonthRange.start && d <= activeMonthRange.end
    })

    let respWithin = 0
    let respOutside = 0

    startedTicketsInPeriod.forEach((t) => {
      if (t.sla_response_compliance === 'Em conformidade') {
        respWithin += 1
        return
      }
      if (t.sla_response_compliance === 'Fora de conformidade') {
        respOutside += 1
        return
      }

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
  // 5. Últimos 3 Meses com separação de Trabalho e Acompanhamento
  // Dados memoizados, animação desativada para estabilidade total
  // ==============================================================
  const last3MonthsData = useMemo(() => {
    const months: Array<{
      year: number
      month: number
      label: string
      key: string
      start: Date
      end: Date
      horasTrabalhadas: number
      horasAcompanhamento: number
      horasTotais: number
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
        horasTrabalhadas: 0,
        horasAcompanhamento: 0,
        horasTotais: 0,
        interactionsCount: 0,
      })
    }

    interactions.forEach((it) => {
      if (!it.created) return
      const itDate = new Date(it.created)
      const targetMonth = months.find((m) => itDate >= m.start && itDate <= m.end)
      if (targetMonth) {
        const hours = (it.duration_minutes || 0) / 60
        if (it.origin === 'Cronômetro') {
          targetMonth.horasTrabalhadas += hours
        } else {
          targetMonth.horasAcompanhamento += hours
        }
        targetMonth.horasTotais += hours
        targetMonth.interactionsCount += 1
      }
    })

    return months.map((m) => ({
      ...m,
      Trabalhadas: Number(m.horasTrabalhadas.toFixed(2)),
      Acompanhamento: Number(m.horasAcompanhamento.toFixed(2)),
      Total: Number(m.horasTotais.toFixed(2)),
    }))
  }, [interactions, selectedMonth])

  // ==============================================================
  // 6. Metas do Técnico
  // ==============================================================
  const technicianGoals = useMemo(() => {
    if (!user) return []

    const selectedMonthKey = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`

    const monthSpecificGoal = techGoals.find(
      (g) => g.period_type === 'mensal' && g.period_month === selectedMonthKey,
    )
    const generalGoal = techGoals.find((g) => g.period_type === 'geral')
    const activeCustomGoal = monthSpecificGoal || generalGoal

    const userLegacyGoals = goals.filter((g) => g.technician === user.id)
    const legacyGoalResponse = userLegacyGoals.find((g) => g.sla_type === 'Resposta')
    const legacyGoalSolution = userLegacyGoals.find((g) => g.sla_type === 'Solução')

    const targetResp =
      activeCustomGoal?.response_sla_target ?? legacyGoalResponse?.target_percentage ?? 90
    const targetSol =
      activeCustomGoal?.solution_sla_target ?? legacyGoalSolution?.target_percentage ?? 85
    const targetEff = activeCustomGoal?.resolution_effectiveness_target ?? 80

    const relevantTickets = filteredTickets.length > 0 ? filteredTickets : tickets

    const responseTotal = relevantTickets.filter(
      (t) => t.sla_response_deadline || t.sla_response_at || t.sla_status,
    ).length
    const responseMet = relevantTickets.filter((t) => {
      if (t.sla_response_compliance === 'Em conformidade') return true
      if (t.sla_response_compliance === 'Fora de conformidade') return false
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
      progressPct: number
      statusText: string
      colorClass: string
    }> = []

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
      colorClass:
        actualResponsePct >= targetResp
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-amber-700 dark:text-amber-300',
    })

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
      colorClass:
        actualSolutionPct >= targetSol
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-amber-700 dark:text-amber-300',
    })

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
      colorClass:
        resolutionPct >= targetEff
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-amber-700 dark:text-amber-300',
    })

    return list
  }, [user, techGoals, goals, filteredTickets, tickets, selectedMonth])

  // Chamados Atribuídos Ativos (não resolvidos/fechados)
  const myActiveTickets = useMemo(() => {
    return tickets.filter((t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status))
  }, [tickets])

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
          <h2 className="text-xl font-bold tracking-tight text-foreground">Painel do Operador</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhamento individual de chamados, horas trabalhadas vs. acompanhamento e metas de
            SLA
          </p>
        </div>

        {/* Filtro / Seletor de Período por Mês */}
        <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-1.5 shadow-xs">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground hover:bg-muted"
              onClick={handlePrevMonth}
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[150px] text-center px-2">
              <span className="text-xs font-semibold text-foreground flex items-center justify-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                {`${MONTH_NAMES[selectedMonth.month]} / ${selectedMonth.year}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground hover:bg-muted"
              onClick={handleNextMonth}
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1">
            <Button
              variant={isCurrentMonthSelected ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5 font-medium border-border"
              onClick={handleCurrentMonth}
            >
              Mês Atual
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Indicadores Principais (KPIs com separação de horas vigente)   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* 1. Visitas Hoje */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-2">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Visitas Hoje</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {todayVisits.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Agendadas para hoje</p>
          </CardContent>
        </Card>

        {/* 2. Horas de Hoje (Trabalho + Acomp) */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Horas Hoje</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMinutes(todayTotalMinutes)}
            </p>
            <p
              className="text-[10px] text-muted-foreground mt-0.5 truncate"
              title={`Play: ${formatMinutes(todayWorkedMinutes)} | Acomp: ${formatMinutes(todayAccompanimentMinutes)}`}
            >
              Play: {formatMinutes(todayWorkedMinutes)} · Logs:{' '}
              {formatMinutes(todayAccompanimentMinutes)}
            </p>
          </CardContent>
        </Card>

        {/* 3. Horas Trabalhadas (Mês / Play-Pause) */}
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/20 w-fit mb-2">
              <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
              Horas Trabalhadas
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMinutes(filteredWorkedMinutes)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {workedLogsCount} ciclo(s) play/pause
            </p>
          </CardContent>
        </Card>

        {/* 4. Horas de Acompanhamento (Debita Franquia) */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-2">
              <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Horas Acompanhamento</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMinutes(filteredAccompanimentMinutes)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {accompanimentLogsCount} log(s) (franquia)
            </p>
          </CardContent>
        </Card>

        {/* 5. Total Resolvidos */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-2">
              <CheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Total Resolvidos</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {filteredResolvedTickets.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {activeMonthRange.label}
            </p>
          </CardContent>
        </Card>

        {/* 6. Meus Chamados Ativos */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-2">
              <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Fila Ativa</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myActiveTickets.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Abertos / Em Andamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* SLA: Visões Comparativas (Dentro vs. Fora do SLA)              */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chamados Resolvidos: SLA Solução */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Chamados Resolvidos: SLA Solução
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-border text-foreground">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Cumprimento do SLA de Solução nos chamados solucionados no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="text-[11px] font-medium text-muted-foreground">Dentro do SLA</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {slaComparisons.solution.within}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Solucionados no prazo</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-[11px] font-medium text-muted-foreground">Fora do SLA</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {slaComparisons.solution.outside}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Prazo excedido</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Aderência ao SLA de Solução</span>
                <span className="font-bold text-foreground">
                  {slaComparisons.solution.adherencePct.toFixed(1)}%
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    ({slaComparisons.solution.within}/{slaComparisons.solution.total} resolvidos)
                  </span>
                </span>
              </div>
              <Progress value={slaComparisons.solution.adherencePct} className="h-2 bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Chamados Iniciados: SLA Resposta / Play/Pause */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Chamados Iniciados: SLA Resposta
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-border text-foreground">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Conformidade do primeiro play/pause nos atendimentos iniciados no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="text-[11px] font-medium text-muted-foreground">Em conformidade</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {slaComparisons.response.within}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Primeiro play no prazo</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Fora de conformidade
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {slaComparisons.response.outside}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Play após o prazo</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Aderência ao SLA de Resposta</span>
                <span className="font-bold text-foreground">
                  {slaComparisons.response.adherencePct.toFixed(1)}%
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    ({slaComparisons.response.within}/{slaComparisons.response.total} iniciados)
                  </span>
                </span>
              </div>
              <Progress value={slaComparisons.response.adherencePct} className="h-2 bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Médias de Atendimento e Resolução                              */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Tempo Médio de Atendimento
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-border text-foreground">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Média de esforço técnico dedicado por chamado no período
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {formatMinutes(avgAttendanceMinutes)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({formatMinutes(avgAttendanceMinutes)} média / chamado)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Baseado em {filteredInteractions.length} interação(ões) registradas no período
              filtrado.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Tempo Médio de Resolução
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-border text-foreground">
                {activeMonthRange.label}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Tempo decorrido desde a abertura até a resolução dos chamados
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {formatMinutes(avgResolutionMinutes)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({formatMinutes(avgResolutionMinutes)} para solucionar)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Calculado sobre {filteredResolvedTickets.length} chamado(s) solucionados no período.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Gráfico Últimos 3 Meses + Metas Individuais                    */}
      {/* Animação desativada (isAnimationActive={false}), sem piscar      */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico com as horas dos últimos 3 meses */}
        <Card className="lg:col-span-2 border border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Horas dos Últimos 3 Meses (Trabalho vs. Acompanhamento)
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Consolidado Mensal
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Separação de horas de play/pause (trabalhadas) e lançamentos de acompanhamento
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last3MonthsData}
                  margin={{ top: 20, right: 20, left: -10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    unit="h"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      formatHours(Number(v)),
                      name === 'Trabalhadas'
                        ? 'Horas Trabalhadas (Play/Pause)'
                        : 'Acompanhamento (Franquia)',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--card-foreground))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      borderColor: 'hsl(var(--border))',
                    }}
                  />
                  <Bar
                    dataKey="Trabalhadas"
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="Trabalhadas"
                      position="top"
                      formatter={formatHoursNumberLabel}
                      style={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                    />
                  </Bar>
                  <Bar
                    dataKey="Acompanhamento"
                    fill="#f59e0b"
                    opacity={0.7}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="Acompanhamento"
                      position="top"
                      formatter={formatHoursNumberLabel}
                      style={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 mt-2 text-center">
              {last3MonthsData.map((m) => (
                <div key={m.key} className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground font-medium">{m.label}</p>
                  <p className="text-sm font-bold text-foreground">{formatHours(m.horasTotais)}</p>
                  <p className="text-[9px] text-muted-foreground">
                    Play: {formatHours(m.horasTrabalhadas)} · Acomp:{' '}
                    {formatHours(m.horasAcompanhamento)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Metas Individuais (percentuais) */}
        <Card className="border border-border bg-card flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Minhas Metas
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] flex items-center gap-1 border-border text-foreground"
              >
                <Percent className="h-3 w-3" /> Apenas %
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Percentuais de atuação e cumprimento de metas individuais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {technicianGoals.map((g, idx) => (
              <div
                key={idx}
                className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{g.title}</span>
                  <span className="font-bold text-foreground">
                    {g.actualPct.toFixed(1)}%
                    {g.targetPct !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (meta: {g.targetPct}%)
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={g.progressPct} className="h-2 bg-muted" />
                <div className="flex items-center justify-between text-[10px]">
                  <span className={g.colorClass}>{g.statusText}</span>
                  <span className="text-muted-foreground font-medium">
                    {g.progressPct.toFixed(0)}% da meta
                  </span>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-muted-foreground text-center italic pt-1">
              Indicadores apurados estritamente em percentual de atuação pessoal.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* Meus Chamados Ativos e Agenda de Visitas de Hoje               */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chamados sob minha responsabilidade */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Meus Chamados Ativos ({myActiveTickets.length})
              </CardTitle>
              <Link
                to="/tickets"
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {myActiveTickets.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                Nenhum chamado ativo atribuído a você no momento.
              </p>
            ) : (
              myActiveTickets.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-border">
                        {t.status}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.priority}
                      </Badge>
                    </div>
                    <Link
                      to={`/tickets/${t.id}`}
                      className="text-xs font-semibold text-foreground hover:text-amber-600 dark:hover:text-amber-400 block truncate"
                    >
                      #{t.number} — {t.title}
                    </Link>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {t.expand?.company?.trade_name ||
                        t.expand?.company?.name ||
                        'Cliente interno'}
                    </p>
                  </div>
                  <Link
                    to={`/tickets/${t.id}`}
                    className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Atender
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Agenda de Visitas de Hoje */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Agenda de Visitas de Hoje ({todayVisits.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayVisits.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                Nenhuma visita agendada para hoje.
              </p>
            ) : (
              todayVisits.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-border">
                        {v.status}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {v.scheduled_time} {v.expected_end_time ? `- ${v.expected_end_time}` : ''}
                      </span>
                      {v.appointment_type && (
                        <Badge variant="secondary" className="text-[9px]">
                          {v.appointment_type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {v.client_address || 'Endereço não informado'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.visit_reason || 'Sem descrição'} · {v.client_contact || ''}{' '}
                      {v.contact_phone || ''}
                    </div>
                  </div>
                  {v.expand?.ticket && (
                    <Link
                      to={`/tickets/${v.ticket}`}
                      className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
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
    </div>
  )
}
