import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, History, Bug, Clock, FileCheck, GitBranch } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getProblem,
  updateProblem,
  getProblemIncidents,
  addProblemIncident,
  removeProblemIncident,
  getHypotheses,
  createHypothesis,
  getWorkarounds,
  createWorkaround,
  getEvaluations,
  createEvaluation,
  getProblemAuditLogs,
  getProblemTimeline,
  getExtensions,
  createExtension,
  type ProblemRecord,
} from '@/services/problems'
import { getTickets, type TicketRecord } from '@/services/tickets'
import {
  PROBLEM_STATUSES,
  PROBLEM_FREQUENCIES,
  ISHIKAWA_CATEGORIES,
  REOPEN_REASONS,
  EFFECTIVENESS_RESULTS,
} from '@/lib/problem-constants'
import { ProblemStatusBadge, ProblemPriorityBadge } from '@/components/ProblemStatusBadge'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const [problem, setProblem] = useState<ProblemRecord | null>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [hypotheses, setHypotheses] = useState<any[]>([])
  const [workarounds, setWorkarounds] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [selectedTicket, setSelectedTicket] = useState('')
  const [newHyp, setNewHyp] = useState({ description: '', probability: 'Média', evidence: '' })
  const [newWorkaround, setNewWorkaround] = useState({
    description: '',
    procedure: '',
    responsible: '',
    service_desk_instructions: '',
  })
  const [newEval, setNewEval] = useState({
    was_effective: 'Sim',
    had_new_incidents: 'Não',
    new_incidents_count: 0,
    impact_reduced: 'Sim',
    service_stable: 'Sim',
    root_cause_exists: 'Não',
    needs_definitive_solution: 'Não',
    observations: '',
  })
  const [newExtension, setNewExtension] = useState({ new_period_days: 15, justification: '' })
  const [reopenReason, setReopenReason] = useState('')
  const [fiveWhys, setFiveWhys] = useState<string[]>(['', '', '', '', ''])
  const [ishikawa, setIshikawa] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const loadData = () => {
    if (!id) return
    getProblem(id)
      .then(setProblem)
      .catch(() => {})
    getProblemIncidents(id)
      .then(setIncidents)
      .catch(() => {})
    getHypotheses(id)
      .then(setHypotheses)
      .catch(() => {})
    getWorkarounds(id)
      .then(setWorkarounds)
      .catch(() => {})
    getEvaluations(id)
      .then(setEvaluations)
      .catch(() => {})
    getProblemAuditLogs(id)
      .then(setAuditLogs)
      .catch(() => {})
    getProblemTimeline(id)
      .then(setTimeline)
      .catch(() => {})
    getExtensions(id)
      .then(setExtensions)
      .catch(() => {})
    getTickets()
      .then(setTickets)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('problems', () => loadData())
  useRealtime('problem_incidents', () => loadData())
  useRealtime('problem_hypotheses', () => loadData())
  useRealtime('problem_workarounds', () => loadData())

  const handleStatusChange = async (s: string) => {
    if (id) {
      await updateProblem(id, { status: s })
      loadData()
      toast({ title: `Status alterado para: ${s}` })
    }
  }
  const handleAddIncident = async () => {
    if (id && selectedTicket) {
      await addProblemIncident(id, selectedTicket)
      setSelectedTicket('')
      loadData()
      toast({ title: 'Incidente relacionado!' })
    }
  }
  const handleRemoveIncident = async (pid: string) => {
    await removeProblemIncident(pid)
    loadData()
  }
  const handleAddHypothesis = async () => {
    if (id && newHyp.description) {
      await createHypothesis({ problem: id, ...newHyp })
      setNewHyp({ description: '', probability: 'Média', evidence: '' })
      loadData()
    }
  }
  const handleAddWorkaround = async () => {
    if (id && newWorkaround.description) {
      await createWorkaround({
        problem: id,
        ...newWorkaround,
        deployment_date: new Date().toISOString(),
      })
      await updateProblem(id, {
        status: 'Solução de Contorno Implantada',
        effectiveness_period_days: 15,
      })
      setNewWorkaround({
        description: '',
        procedure: '',
        responsible: '',
        service_desk_instructions: '',
      })
      loadData()
      toast({ title: 'Solução de contorno implantada. Análise de efetividade iniciada.' })
    }
  }
  const handleAddEvaluation = async () => {
    if (id && newEval.observations) {
      await createEvaluation({ problem: id, ...newEval, evaluated_by: user?.id })
      await updateProblem(id, {
        status: 'Avaliação Realizada',
        effectiveness_result:
          newEval.was_effective === 'Sim'
            ? 'Efetiva'
            : newEval.was_effective === 'Parcialmente'
              ? 'Parcialmente efetiva'
              : 'Não efetiva',
        incidents_after_count: newEval.new_incidents_count,
      })
      setNewEval({
        was_effective: 'Sim',
        had_new_incidents: 'Não',
        new_incidents_count: 0,
        impact_reduced: 'Sim',
        service_stable: 'Sim',
        root_cause_exists: 'Não',
        needs_definitive_solution: 'Não',
        observations: '',
      })
      loadData()
      toast({ title: 'Avaliação registrada!' })
    }
  }
  const handleAddExtension = async () => {
    if (id && newExtension.justification) {
      const newEnd = new Date(Date.now() + newExtension.new_period_days * 86400000)
      await createExtension({
        problem: id,
        ...newExtension,
        new_end_date: newEnd.toISOString(),
        responsible: user?.id,
      })
      await updateProblem(id, {
        effectiveness_end_date: newEnd.toISOString(),
        effectiveness_period_days: newExtension.new_period_days,
      })
      setNewExtension({ new_period_days: 15, justification: '' })
      loadData()
      toast({ title: 'Análise prorrogada!' })
    }
  }
  const handleReopen = async () => {
    if (id && reopenReason) {
      await updateProblem(id, {
        status: 'Reaberto',
        reopen_reason: reopenReason,
        reopened_count: (problem?.reopened_count || 0) + 1,
      })
      setReopenReason('')
      loadData()
      toast({ title: 'Problema reaberto' })
    }
  }
  const handleSaveRootCause = async () => {
    if (!id || !problem) return
    await updateProblem(id, { five_whys: fiveWhys, ishikawa, status: 'Causa Identificada' })
    loadData()
    toast({ title: 'Análise de causa raiz salva!' })
  }
  const handleAiEffectiveness = async () => {
    if (!id) return
    setAiLoading(true)
    import('@/services/problems').then(({ aiEffectivenessAnalysis }) =>
      aiEffectivenessAnalysis(id)
        .then(setAiResult)
        .catch(() => {})
        .finally(() => setAiLoading(false)),
    )
  }

  if (!problem) return <Skeleton className="h-96 w-full rounded-xl" />
  const effDaysLeft = problem.effectiveness_end_date
    ? Math.ceil((new Date(problem.effectiveness_end_date).getTime() - Date.now()) / 86400000)
    : null
  const effTotalDays = problem.effectiveness_period_days || 0
  const effElapsed = effTotalDays ? Math.max(0, effTotalDays - (effDaysLeft ?? 0)) : 0
  const reduction =
    problem.incidents_before_count && problem.incidents_before_count > 0
      ? Math.round(
          (1 - (problem.incidents_after_count || 0) / problem.incidents_before_count) * 100,
        )
      : 0

  return (
    <div className="space-y-6">
      <Link
        to="/problems"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="itsm-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bug className="h-5 w-5" /> {problem.number} - {problem.title}
          </h2>
          <div className="flex items-center gap-2">
            <ProblemPriorityBadge priority={problem.priority} />
            <ProblemStatusBadge status={problem.status} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Aberto por{' '}
          <span className="font-semibold text-foreground">{problem.expand?.requester?.name}</span>{' '}
          em {new Date(problem.created).toLocaleString('pt-BR')}
        </p>
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground border border-border">
          {problem.description}
        </div>
        {problem.symptom && (
          <p className="text-xs">
            <span className="font-semibold">Sintoma:</span> {problem.symptom}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Select value={problem.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROBLEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {problem.status === 'Encerrado' && (
            <Select value={reopenReason} onValueChange={setReopenReason}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="Motivo reabertura" />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {reopenReason && (
            <Button size="sm" variant="destructive" onClick={handleReopen}>
              Reabrir
            </Button>
          )}
        </div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes ({incidents.length})</TabsTrigger>
          <TabsTrigger value="investigation">Investigação</TabsTrigger>
          <TabsTrigger value="rootcause">Causa Raiz</TabsTrigger>
          <TabsTrigger value="workaround">Solução de Contorno</TabsTrigger>
          <TabsTrigger value="effectiveness">Efetividade</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="font-semibold mb-1">Informações</p>
              <p>Origem: {problem.origin || 'N/A'}</p>
              <p>Frequência: {problem.frequency || 'N/A'}</p>
              <p>Cliente: {problem.expand?.company?.trade_name || 'N/A'}</p>
              <p>Serviço: {problem.service || 'N/A'}</p>
              <p>Categoria: {problem.expand?.category?.name || 'N/A'}</p>
              <p>
                Impacto: {problem.impact} | Urgência: {problem.urgency}
              </p>
              <p>
                Primeira ocorrência:{' '}
                {problem.first_occurrence_date
                  ? new Date(problem.first_occurrence_date).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
              <p>
                Última ocorrência:{' '}
                {problem.last_occurrence_date
                  ? new Date(problem.last_occurrence_date).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <p className="font-semibold mb-1">Análise de Impacto</p>
              <p>
                Classificação:{' '}
                <Badge variant="outline" className="text-[10px]">
                  {problem.impact_classification || 'N/A'}
                </Badge>
              </p>
              <p>Serviços afetados: {problem.affected_services || 'N/A'}</p>
              <p>Usuários afetados: {problem.affected_users_count || 0}</p>
              <p>Tempo médio indisponibilidade: {problem.avg_downtime || 'N/A'}</p>
              <p>Impacto financeiro: {problem.financial_impact || 'N/A'}</p>
              <p>Impacto segurança: {problem.security_impact || 'N/A'}</p>
              <p>Impacto reputacional: {problem.reputational_impact || 'N/A'}</p>
              <p>Impacto regulatório: {problem.regulatory_impact || 'N/A'}</p>
            </div>
          </div>
          {problem.expected_behavior && (
            <div className="rounded-lg border p-3 text-xs">
              <p className="font-semibold mb-1">Comportamento Esperado</p>
              <p className="text-muted-foreground">{problem.expected_behavior}</p>
            </div>
          )}
          {problem.current_behavior && (
            <div className="rounded-lg border p-3 text-xs">
              <p className="font-semibold mb-1">Comportamento Atual</p>
              <p className="text-muted-foreground">{problem.current_behavior}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="incidents" className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Select value={selectedTicket} onValueChange={setSelectedTicket}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Selecionar incidente para relacionar" />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    #{t.number} - {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddIncident} disabled={!selectedTicket}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {incidents.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhum incidente relacionado.</p>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
                <div className="flex justify-between items-center">
                  <Link
                    to={`/tickets/${inc.ticket}`}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    #{inc.expand?.ticket?.number || 'N/A'}
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveIncident(inc.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
                <p className="text-muted-foreground">{inc.expand?.ticket?.title}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span>Cliente: {inc.expand?.ticket?.expand?.company?.trade_name || '-'}</span>
                  <span>Prioridade: {inc.expand?.ticket?.priority || '-'}</span>
                  <span>Status: {inc.expand?.ticket?.status || '-'}</span>
                  <span>Operador: {inc.expand?.ticket?.expand?.assigned_to?.name || '-'}</span>
                </div>
              </div>
            ))
          )}
        </TabsContent>
        <TabsContent value="investigation" className="pt-4 space-y-3">
          <div className="rounded-lg border p-3 space-y-2 text-xs">
            <p className="font-semibold">Dados da Investigação</p>
            <Textarea
              placeholder="Evidências coletadas..."
              defaultValue={problem.investigation_evidence || ''}
              onBlur={(e) => updateProblem(id!, { investigation_evidence: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Logs..."
              defaultValue={problem.investigation_logs || ''}
              onBlur={(e) => updateProblem(id!, { investigation_logs: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Testes realizados..."
              defaultValue={problem.investigation_tests || ''}
              onBlur={(e) => updateProblem(id!, { investigation_tests: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Análises executadas..."
              defaultValue={problem.investigation_analyses || ''}
              onBlur={(e) => updateProblem(id!, { investigation_analyses: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Ferramentas utilizadas..."
              defaultValue={problem.investigation_tools || ''}
              onBlur={(e) => updateProblem(id!, { investigation_tools: e.target.value })}
              rows={1}
            />
            <Textarea
              placeholder="Observações..."
              defaultValue={problem.investigation_observations || ''}
              onBlur={(e) => updateProblem(id!, { investigation_observations: e.target.value })}
              rows={2}
            />
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Hipóteses</p>
            {hypotheses.map((h) => (
              <div key={h.id} className="rounded border p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{h.description}</span>
                  <div className="flex gap-1">
                    {h.confirmed && (
                      <Badge className="bg-green-100 text-green-700 text-[9px]">Confirmada</Badge>
                    )}
                    {h.discarded && (
                      <Badge className="bg-red-100 text-red-700 text-[9px]">Descartada</Badge>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Probabilidade: {h.probability} | Evidência: {h.evidence || 'N/A'}
                </p>
                {h.result && <p className="text-muted-foreground">Resultado: {h.result}</p>}
              </div>
            ))}
            <div className="space-y-1 border-t pt-2">
              <Input
                placeholder="Descrição da hipótese"
                value={newHyp.description}
                onChange={(e) => setNewHyp({ ...newHyp, description: e.target.value })}
                className="h-8 text-xs"
              />
              <Select
                value={newHyp.probability}
                onValueChange={(v) => setNewHyp({ ...newHyp, probability: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Evidência"
                value={newHyp.evidence}
                onChange={(e) => setNewHyp({ ...newHyp, evidence: e.target.value })}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleAddHypothesis}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Hipótese
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="rootcause" className="pt-4 space-y-3">
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">5 Porquês</p>
            {fiveWhys.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Label className="text-xs w-20">Por quê {i + 1}?</Label>
                <Input
                  value={w}
                  onChange={(e) => {
                    const n = [...fiveWhys]
                    n[i] = e.target.value
                    setFiveWhys(n)
                  }}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Diagrama de Ishikawa</p>
            {ISHIKAWA_CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <Label className="text-xs w-28">{cat}</Label>
                <Input
                  value={ishikawa[cat] || ''}
                  onChange={(e) => setIshikawa({ ...ishikawa, [cat]: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Causa Raiz Identificada *</p>
            <Textarea
              placeholder="Descreva a causa raiz identificada..."
              value={problem.root_cause_identified || ''}
              onChange={(e) => updateProblem(id!, { root_cause_identified: e.target.value })}
              rows={3}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Evidência</Label>
                <Input
                  defaultValue={problem.root_cause_evidence || ''}
                  onBlur={(e) => updateProblem(id!, { root_cause_evidence: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Método utilizado</Label>
                <Input
                  defaultValue={problem.root_cause_method || ''}
                  onBlur={(e) => updateProblem(id!, { root_cause_method: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <Button size="sm" onClick={handleSaveRootCause}>
            <CheckCircle2Icon className="mr-1.5 h-4 w-4" /> Salvar Causa Raiz
          </Button>
        </TabsContent>
        <TabsContent value="workaround" className="pt-4 space-y-3">
          {workarounds.map((w) => (
            <div key={w.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
              <p className="font-semibold">{w.description}</p>
              {w.procedure && <p className="text-muted-foreground">Procedimento: {w.procedure}</p>}
              {w.service_desk_instructions && (
                <p className="text-muted-foreground">
                  Instruções para Service Desk: {w.service_desk_instructions}
                </p>
              )}
              <p className="text-slate-500">
                Implantada em:{' '}
                {w.deployment_date
                  ? new Date(w.deployment_date).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>
          ))}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Nova Solução de Contorno</p>
            <Textarea
              placeholder="Descrição *"
              value={newWorkaround.description}
              onChange={(e) => setNewWorkaround({ ...newWorkaround, description: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Procedimento"
              value={newWorkaround.procedure}
              onChange={(e) => setNewWorkaround({ ...newWorkaround, procedure: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Instruções para Service Desk"
              value={newWorkaround.service_desk_instructions}
              onChange={(e) =>
                setNewWorkaround({ ...newWorkaround, service_desk_instructions: e.target.value })
              }
              rows={2}
            />
            <Button size="sm" onClick={handleAddWorkaround}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Implantar Solução de Contorno
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="effectiveness" className="pt-4 space-y-3">
          {problem.effectiveness_start_date && (
            <div className="rounded-lg border p-3 text-xs space-y-1">
              <p className="font-semibold">Período de Análise de Efetividade</p>
              <p>
                Início: {new Date(problem.effectiveness_start_date).toLocaleDateString('pt-BR')}
              </p>
              <p>
                Fim: {new Date(problem.effectiveness_end_date || '').toLocaleDateString('pt-BR')}
              </p>
              {effDaysLeft !== null && (
                <p className="font-semibold">
                  {effElapsed} de {effTotalDays} dias concluídos — {Math.max(0, effDaysLeft)} dias
                  restantes
                </p>
              )}
              {effDaysLeft !== null && effDaysLeft <= 0 && (
                <Badge className="bg-red-100 text-red-700 text-[10px]">Avaliação vencida</Badge>
              )}
            </div>
          )}
          <div className="rounded-lg border p-3 text-xs space-y-1">
            <p className="font-semibold">Monitoramento Antes x Depois</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-slate-500">Antes</p>
                <p className="text-lg font-bold">{problem.incidents_before_count || 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Depois</p>
                <p className="text-lg font-bold">{problem.incidents_after_count || 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Redução</p>
                <p className="text-lg font-bold text-green-600">{reduction}%</p>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleAiEffectiveness} disabled={aiLoading}>
            <FileCheck className="mr-1.5 h-3.5 w-3.5" />{' '}
            {aiLoading ? 'Analisando...' : 'IA: Analisar Efetividade'}
          </Button>
          {aiResult && (
            <div className="rounded-lg border p-3 text-xs">
              <p className="font-semibold mb-1">Recomendação da IA</p>
              <pre className="whitespace-pre-wrap text-muted-foreground">
                {aiResult.ai_recommendation}
              </pre>
            </div>
          )}
          {extensions.length > 0 && (
            <div className="rounded-lg border p-3 text-xs space-y-1">
              <p className="font-semibold">Prorrogações</p>
              {extensions.map((ext) => (
                <p key={ext.id}>
                  {ext.new_period_days} dias — {ext.justification} — até{' '}
                  {new Date(ext.new_end_date).toLocaleDateString('pt-BR')}
                </p>
              ))}
            </div>
          )}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Nova Avaliação de Efetividade</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Foi efetiva?</Label>
                <Select
                  value={newEval.was_effective}
                  onValueChange={(v) => setNewEval({ ...newEval, was_effective: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Parcialmente">Parcialmente</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Novos incidentes?</Label>
                <Select
                  value={newEval.had_new_incidents}
                  onValueChange={(v) => setNewEval({ ...newEval, had_new_incidents: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Qtd. novos incidentes</Label>
                <Input
                  type="number"
                  value={newEval.new_incidents_count}
                  onChange={(e) =>
                    setNewEval({ ...newEval, new_incidents_count: parseInt(e.target.value) || 0 })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Impacto reduzido?</Label>
                <Select
                  value={newEval.impact_reduced}
                  onValueChange={(v) => setNewEval({ ...newEval, impact_reduced: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Parcialmente">Parcialmente</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Serviço estável?</Label>
                <Select
                  value={newEval.service_stable}
                  onValueChange={(v) => setNewEval({ ...newEval, service_stable: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Causa raiz existe?</Label>
                <Select
                  value={newEval.root_cause_exists}
                  onValueChange={(v) => setNewEval({ ...newEval, root_cause_exists: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Parcialmente">Parcialmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Necessita solução definitiva?</Label>
                <Select
                  value={newEval.needs_definitive_solution}
                  onValueChange={(v) => setNewEval({ ...newEval, needs_definitive_solution: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              placeholder="Observações *"
              value={newEval.observations}
              onChange={(e) => setNewEval({ ...newEval, observations: e.target.value })}
              rows={2}
            />
            <Button size="sm" onClick={handleAddEvaluation}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Registrar Avaliação
            </Button>
          </div>
          {evaluations.length > 0 &&
            evaluations.map((ev) => (
              <div key={ev.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
                <div className="flex justify-between">
                  <Badge className="text-[10px]">{ev.was_effective}</Badge>
                  <span className="text-slate-400">
                    {new Date(ev.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-muted-foreground">{ev.observations}</p>
              </div>
            ))}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Prorrogar Análise</p>
            <Select
              value={String(newExtension.new_period_days)}
              onValueChange={(v) =>
                setNewExtension({ ...newExtension, new_period_days: parseInt(v) })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Justificativa *"
              value={newExtension.justification}
              onChange={(e) => setNewExtension({ ...newExtension, justification: e.target.value })}
              rows={2}
            />
            <Button size="sm" variant="outline" onClick={handleAddExtension}>
              Prorrogar
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="pt-4 space-y-2">
          {timeline.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Sem registros de timeline.</p>
          ) : (
            timeline.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
                <div className="flex justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    {t.stage}
                  </span>
                  <span className="text-slate-400">
                    {new Date(t.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                {t.status && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.status}
                  </Badge>
                )}
                {t.expand?.responsible && (
                  <p className="text-muted-foreground">Por: {t.expand.responsible.name}</p>
                )}
                {t.comments && <p className="text-muted-foreground">{t.comments}</p>}
              </div>
            ))
          )}
        </TabsContent>
        <TabsContent value="audit" className="pt-4 space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhum registro de auditoria.</p>
          ) : (
            auditLogs.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
                <div className="flex justify-between">
                  <span className="font-semibold">{a.action}</span>
                  <span className="text-slate-400">
                    {new Date(a.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                {a.expand?.user && (
                  <p className="text-muted-foreground">Por: {a.expand.user.name}</p>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
