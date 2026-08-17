import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  History,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileCheck,
  User,
  Building2,
  Clock,
  GitBranch,
  Loader2,
  Crown,
  Users,
  ShieldAlert,
  Send,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getChange,
  getChangeAuditLogs,
  getChangeApprovals,
  updateChange,
  decideChangeApproval,
  submitChangeForApproval,
  type ChangeRecord,
} from '@/services/changes'
import { getCommitteeByCompanyAndType } from '@/services/change-committee'
import { CHANGE_STATUSES } from '@/lib/change-constants'
import {
  ChangeStatusBadge,
  RiskLevelBadge,
  ChangePriorityBadge,
} from '@/components/ChangeStatusBadge'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function ChangeDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const [change, setChange] = useState<ChangeRecord | null>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [committee, setCommittee] = useState<any | null>(null)
  const [voteComment, setVoteComment] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // tick a cada minuto para atualizar o contador regressivo
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const deadlineInfo = useMemo(() => {
    const dl = change?.voting_deadline_at
    if (!dl) return null
    const ts = new Date(dl).getTime()
    if (isNaN(ts)) return null
    const diff = ts - now
    const expired = diff <= 0
    const totalMinutes = Math.abs(Math.floor(diff / 60000))
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const mins = totalMinutes % 60
    let remaining = ''
    if (days > 0) remaining = `${days}d ${hours}h ${mins}min`
    else if (hours > 0) remaining = `${hours}h ${mins}min`
    else remaining = `${mins}min`
    let status: 'ok' | 'warn' | 'expired' = 'ok'
    if (expired) status = 'expired'
    else if (diff <= 6 * 3600 * 1000) status = 'warn'
    return {
      ts,
      expired,
      remaining,
      status,
      label: expired ? 'Expirado' : status === 'warn' ? 'Próximo do fim' : 'Dentro do prazo',
    }
  }, [change?.voting_deadline_at, now])

  const loadData = () => {
    if (!id) return
    getChange(id)
      .then((c) => {
        setChange(c)
        // carregar comitê correspondente
        const ctName = c.expand?.change_type?.name
        const ctType = ctName === 'Mudança de Emergência' ? 'Emergencial' : 'Padrão'
        if (c.company) {
          getCommitteeByCompanyAndType(c.company, ctType as 'Emergencial' | 'Padrão')
            .then(setCommittee)
            .catch(() => setCommittee(null))
        } else {
          setCommittee(null)
        }
      })
      .catch(() => {})
    getChangeAuditLogs(id)
      .then(setAuditLogs)
      .catch(() => {})
    getChangeApprovals(id)
      .then(setApprovals)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('changes', () => loadData())
  useRealtime('change_audit_logs', () => loadData())
  useRealtime('change_approvals', () => loadData())

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    await updateChange(id, { status: newStatus })
    toast({ title: `Status alterado para: ${newStatus}` })
    loadData()
  }

  const myApproval = useMemo(
    () => approvals.find((a) => a.approver === user?.id),
    [approvals, user],
  )
  const myPendingApproval = myApproval && myApproval.status === 'Pendente' ? myApproval : null
  const isCommitteeMember = !!myApproval
  const isPresident = committee && user && committee.chairperson === user.id

  const voteCounts = useMemo(() => {
    let approved = 0
    let refused = 0
    let revision = 0
    let pending = 0
    approvals.forEach((a) => {
      if (a.status === 'Aprovado') approved++
      else if (a.status === 'Recusado') refused++
      else if (a.status === 'Solicitar Revisão') revision++
      else pending++
    })
    return { approved, refused, revision, pending, total: approvals.length }
  }, [approvals])

  const handleVote = async (decision: 'Aprovado' | 'Recusado' | 'Solicitar Revisão') => {
    if (!id) return
    setProcessing(decision)
    try {
      await decideChangeApproval(id, decision, voteComment)
      toast({
        title: `Voto registrado: ${decision}`,
      })
      setVoteComment('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar voto',
        description: err?.message || err?.response?.message || 'Não foi possível registrar o voto.',
        variant: 'destructive',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleSubmitForApproval = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await submitChangeForApproval(id)
      toast({ title: 'Requisição enviada para aprovação do comitê' })
      setShowSubmit(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar para aprovação',
        description:
          err?.message ||
          err?.response?.message ||
          'Não foi possível enviar a requisição para aprovação.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!change) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-6">
      <Link
        to="/changes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="itsm-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">
            {change.number} - {change.title}
          </h2>
          <div className="flex items-center gap-2">
            <ChangePriorityBadge priority={change.priority} />
            <ChangeStatusBadge status={change.status} />
            {change.status === 'Rascunho' && (
              <Button size="sm" className="h-8" onClick={() => setShowSubmit(true)}>
                <Send className="mr-1.5 h-4 w-4" />
                Enviar para Aprovação
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Aberto por{' '}
          <span className="font-semibold text-foreground">
            {change.expand?.requester?.name}
          </span> em{' '}
          {new Date(change.created).toLocaleString('pt-BR')}
        </p>
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground border border-border">
          {change.description}
        </div>
        {change.risk_assessment && (
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold mb-1">Avaliação de Risco</p>
            <p className="text-xs text-muted-foreground">{change.risk_assessment}</p>
          </div>
        )}
        {change.risk_not_executing && (
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold mb-1">Riscos em não executar a mudança</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {change.risk_not_executing}
            </p>
          </div>
        )}
        {change.risk_executing && (
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold mb-1">Riscos em executar a mudança</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {change.risk_executing}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Select value={change.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="audit">
            <TabsList>
              <TabsTrigger value="audit">Auditoria ({auditLogs.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos</TabsTrigger>
            </TabsList>
            <TabsContent value="audit" className="pt-4 space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-center text-sm text-slate-500 p-4">
                  Nenhum registro de auditoria.
                </p>
              ) : (
                auditLogs.map((h) => (
                  <div key={h.id} className="rounded-lg border p-3 text-xs space-y-1 bg-card">
                    <div className="flex justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        {h.action}
                      </span>
                      <span className="text-slate-400">
                        {new Date(h.created).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {h.expand?.user && (
                      <p className="text-muted-foreground">Por: {h.expand.user.name}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="plans" className="pt-4 space-y-3">
              {change.execution_plan && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-1">Plano de Execução</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {change.execution_plan}
                  </p>
                </div>
              )}
              {change.rollback_plan && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-1">Plano de Rollback</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {change.rollback_plan}
                  </p>
                </div>
              )}
              {change.validation_results && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-1">Resultados da Validação</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {change.validation_results}
                  </p>
                </div>
              )}
              {change.evidence && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-1">Evidências</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {change.evidence}
                  </p>
                </div>
              )}
              {change.closure_notes && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-1">Notas de Encerramento</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {change.closure_notes}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-4">
          {deadlineInfo && change.approval_status === 'Pendente' && (
            <div
              className={
                'itsm-card p-4 space-y-2 border-l-4 ' +
                (deadlineInfo.status === 'expired'
                  ? 'border-l-red-500'
                  : deadlineInfo.status === 'warn'
                    ? 'border-l-amber-500'
                    : 'border-l-green-500')
              }
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Prazo de Votação
                </h3>
                <Badge
                  className={
                    deadlineInfo.status === 'expired'
                      ? 'bg-red-100 text-red-700 hover:bg-red-100'
                      : deadlineInfo.status === 'warn'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                        : 'bg-green-100 text-green-700 hover:bg-green-100'
                  }
                >
                  {deadlineInfo.label}
                </Badge>
              </div>
              <div className="text-xs space-y-1">
                <div className="text-muted-foreground">
                  Data/hora limite:{' '}
                  <span className="font-medium text-foreground">
                    {new Date(deadlineInfo.ts).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div
                  className={
                    'font-medium ' +
                    (deadlineInfo.status === 'expired'
                      ? 'text-red-600'
                      : deadlineInfo.status === 'warn'
                        ? 'text-amber-600'
                        : 'text-green-600')
                  }
                >
                  {deadlineInfo.expired
                    ? `Expirado há ${deadlineInfo.remaining}`
                    : `Restam ${deadlineInfo.remaining}`}
                </div>
              </div>
            </div>
          )}

          {change.escalation_reason && (
            <div className="itsm-card p-4 space-y-1 border-l-4 border-l-orange-500">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Escalonamento
              </h3>
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {change.escalation_reason}
              </p>
            </div>
          )}

          {change.status === 'Aguardando Aprovação' && (
            <div className="itsm-card p-4 space-y-3">
              <h3 className="font-semibold text-sm border-b pb-2 flex items-center gap-2">
                <Users className="h-4 w-4" /> Votos do Comitê
              </h3>
              {committee && (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        committee.committee_type === 'Emergencial'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                      }
                    >
                      {committee.committee_type}
                    </Badge>
                    <span className="text-muted-foreground">Regra: {committee.voting_rule}</span>
                  </div>
                  {committee.chairperson && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Crown className="h-3 w-3 text-amber-500" />
                      Presidente: {committee.expand?.chairperson?.name || '—'}
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aprovados</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    {voteCounts.approved}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recusados</span>
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                    {voteCounts.refused}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revisão</span>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {voteCounts.revision}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pendentes</span>
                  <Badge variant="outline">{voteCounts.pending}</Badge>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  {voteCounts.total > 0
                    ? `${voteCounts.total - voteCounts.pending} de ${voteCounts.total} votaram`
                    : 'Nenhum membro do comitê atribuído.'}
                </p>
              </div>

              {/* Lista de membros e seus votos */}
              {approvals.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  {approvals.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        {committee?.chairperson === a.approver && (
                          <Crown className="h-3 w-3 text-amber-500" />
                        )}
                        {a.expand?.approver?.name || '—'}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          'text-[10px] ' +
                          (a.status === 'Aprovado'
                            ? 'bg-green-50 text-green-700'
                            : a.status === 'Recusado'
                              ? 'bg-red-50 text-red-700'
                              : a.status === 'Solicitar Revisão'
                                ? 'bg-amber-50 text-amber-700'
                                : '')
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {isPresident && committee?.committee_type === 'Emergencial' && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
                  Você é o presidente deste comitê emergencial — seu voto é decisivo e
                  aprova/reprova a mudança imediatamente.
                </div>
              )}

              {myPendingApproval ? (
                <div className="space-y-2 pt-1 border-t">
                  <Textarea
                    placeholder="Comentário (opcional)..."
                    value={voteComment}
                    onChange={(e) => setVoteComment(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 h-8"
                      onClick={() => handleVote('Aprovado')}
                      disabled={processing !== null}
                    >
                      {processing === 'Aprovado' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}{' '}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={() => handleVote('Recusado')}
                      disabled={processing !== null}
                    >
                      {processing === 'Recusado' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}{' '}
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => handleVote('Solicitar Revisão')}
                      disabled={processing !== null}
                    >
                      {processing === 'Solicitar Revisão' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}{' '}
                      Revisão
                    </Button>
                  </div>
                </div>
              ) : isCommitteeMember ? (
                <p className="text-[11px] text-slate-500 pt-1 border-t">
                  Seu voto já foi registrado.
                </p>
              ) : (
                change.status === 'Aguardando Aprovação' && (
                  <p className="text-[11px] text-slate-500 pt-1 border-t">
                    Você não é membro do comitê desta mudança.
                  </p>
                )
              )}
            </div>
          )}

          <div className="itsm-card p-4 space-y-3">
            <h3 className="font-semibold text-sm border-b pb-2">Informações</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GitBranch className="h-4 w-4" /> Tipo: {change.expand?.change_type?.name || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" /> Solicitante: {change.expand?.requester?.name || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" /> Cliente:{' '}
                {change.expand?.company?.trade_name || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Início Planejado:{' '}
                {change.planned_start
                  ? new Date(change.planned_start).toLocaleString('pt-BR')
                  : 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Fim Planejado:{' '}
                {change.planned_end ? new Date(change.planned_end).toLocaleString('pt-BR') : 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileCheck className="h-4 w-4" /> Aprovação:{' '}
                <Badge variant="outline" className="text-[10px]">
                  {change.approval_status || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                Risco: <RiskLevelBadge level={change.risk_level} />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                Impacto: {change.impact}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                Urgência: {change.urgency}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={showSubmit}
        onOpenChange={(open) => {
          if (!submitting) setShowSubmit(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar para Aprovação</DialogTitle>
            <DialogDescription>
              Deseja enviar esta Requisição de Mudança para aprovação do comitê?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={submitting} onClick={() => setShowSubmit(false)}>
              Cancelar
            </Button>
            <Button disabled={submitting} onClick={handleSubmitForApproval}>
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
