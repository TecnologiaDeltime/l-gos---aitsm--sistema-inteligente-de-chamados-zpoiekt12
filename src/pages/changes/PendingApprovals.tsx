import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Building2,
  User,
  GitBranch,
  ShieldAlert,
  AlertTriangle,
  PlayCircle,
  Undo2,
  FileText,
  Calendar,
  Lightbulb,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getMyPendingApprovals, decideChangeApproval } from '@/services/changes'
import {
  ChangeStatusBadge,
  RiskLevelBadge,
  ChangePriorityBadge,
} from '@/components/ChangeStatusBadge'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

interface DeadlineInfo {
  ts: number
  expired: boolean
  remaining: string
  status: 'ok' | 'warn' | 'expired'
  label: string
}

function useDeadlineInfo(votingDeadlineAt?: string): DeadlineInfo | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])
  return useMemo(() => {
    if (!votingDeadlineAt) return null
    const ts = new Date(votingDeadlineAt).getTime()
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
  }, [votingDeadlineAt, now])
}

export default function PendingApprovals() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const loadData = () => {
    if (!user) return
    getMyPendingApprovals(user.id)
      .then(setApprovals)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('change_approvals', () => loadData())

  const handleDecide = async (changeId: string, decision: string) => {
    setProcessing(changeId + decision)
    try {
      await decideChangeApproval(changeId, decision, comments[changeId] || '')
      const label =
        decision === 'Aprovado'
          ? 'aprovada'
          : decision === 'Recusado'
            ? 'recusada'
            : 'marcada para revisão'
      toast({ title: `Mudança ${label}!` })
      loadData()
    } catch {
      toast({ title: 'Erro ao processar', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return <div className="text-center py-8 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Clock className="h-5 w-5" /> Mudanças Pendentes de Aprovação
      </h2>
      {approvals.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Nenhuma aprovação pendente.</p>
      ) : (
        approvals.map((a) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            comments={comments}
            setComments={setComments}
            processing={processing}
            onDecide={handleDecide}
          />
        ))
      )}
    </div>
  )
}

interface ApprovalCardProps {
  approval: any
  comments: Record<string, string>
  setComments: React.Dispatch<React.SetStateAction<Record<string, string>>>
  processing: string | null
  onDecide: (changeId: string, decision: string) => void
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" /> {label}:{' '}
      <span className="text-foreground">{children}</span>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
  accent = 'border-l-blue-500',
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div className={`rounded-lg border border-l-4 p-3 ${accent}`}>
      <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="text-xs text-muted-foreground whitespace-pre-line">{children}</div>
    </div>
  )
}

function ApprovalCard({
  approval,
  comments,
  setComments,
  processing,
  onDecide,
}: ApprovalCardProps) {
  const change = approval.expand?.change || {}
  const deadlineInfo = useDeadlineInfo(change.voting_deadline_at)

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Cabeçalho: número, título e badges */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/changes/${approval.change}`}
                className="font-bold text-blue-600 hover:underline"
              >
                {change.number || 'N/A'}
              </Link>
              <Badge variant="outline" className="text-[10px]">
                Pendente
              </Badge>
              {change.priority && <ChangePriorityBadge priority={change.priority} />}
              {change.status && <ChangeStatusBadge status={change.status} />}
              {change.risk_level && <RiskLevelBadge level={change.risk_level} />}
            </div>
            <p className="text-sm font-medium">{change.title || 'N/A'}</p>
            <p className="text-[10px] text-slate-500">
              Solicitada em {new Date(approval.created).toLocaleDateString('pt-BR')}
            </p>
          </div>
          {deadlineInfo && (
            <div
              className={
                'rounded-lg border-l-4 p-3 space-y-1 min-w-[200px] ' +
                (deadlineInfo.status === 'expired'
                  ? 'border-l-red-500'
                  : deadlineInfo.status === 'warn'
                    ? 'border-l-amber-500'
                    : 'border-l-green-500')
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Prazo de Votação
                </span>
                <Badge
                  className={
                    'text-[10px] ' +
                    (deadlineInfo.status === 'expired'
                      ? 'bg-red-100 text-red-700 hover:bg-red-100'
                      : deadlineInfo.status === 'warn'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                        : 'bg-green-100 text-green-700 hover:bg-green-100')
                  }
                >
                  {deadlineInfo.label}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Limite:{' '}
                <span className="font-medium text-foreground">
                  {new Date(deadlineInfo.ts).toLocaleString('pt-BR')}
                </span>
              </div>
              <div
                className={
                  'text-[11px] font-medium ' +
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
          )}
        </div>

        {/* Informações principais (empresa, tipo, solicitante, datas) */}
        <div className="grid gap-2 sm:grid-cols-2 rounded-lg bg-muted/40 p-3 border border-border">
          <InfoRow icon={GitBranch} label="Tipo de Mudança">
            {change.expand?.change_type?.name || '-'}
          </InfoRow>
          <InfoRow icon={Building2} label="Empresa">
            {change.expand?.company?.trade_name || change.expand?.company?.name || '-'}
          </InfoRow>
          <InfoRow icon={User} label="Solicitante">
            {change.expand?.requester?.name || '-'}
          </InfoRow>
          {change.template && (
            <InfoRow icon={FileText} label="Modelo">
              {change.expand?.template?.name || '-'}
            </InfoRow>
          )}
          {(change.planned_start || change.planned_end) && (
            <div className="sm:col-span-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <Lightbulb className="h-3.5 w-3.5" /> Sugestão de Início e Fim do Solicitante
                </span>
                <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-200">
                  Sugestão do Solicitante
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Sugestão de Início:</span>
                  <span className="font-semibold">
                    {change.planned_start
                      ? new Date(change.planned_start).toLocaleString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Sugestão de Fim:</span>
                  <span className="font-semibold">
                    {change.planned_end
                      ? new Date(change.planned_end).toLocaleString('pt-BR')
                      : '—'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                As datas acima são uma sugestão do solicitante e devem ser avaliadas pelo comitê —
                podem ser um fator de aprovação ou reprovação da mudança.
              </p>
            </div>
          )}
        </div>

        {/* Badges de Prioridade, Impacto, Urgência, Risco */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Avaliação ITIL:</span>
          <Badge variant="outline" className="text-[10px]">
            Impacto: {change.impact || '-'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Urgência: {change.urgency || '-'}
          </Badge>
          {change.risk_level && <RiskLevelBadge level={change.risk_level} />}
          {change.priority && <ChangePriorityBadge priority={change.priority} />}
        </div>

        {/* Motivo (descrição) — sempre visível */}
        <Section icon={FileText} title="Motivo" accent="border-l-blue-500">
          {change.description || '—'}
        </Section>

        {/* Seções expansíveis para o restante da RDM */}
        <Accordion type="multiple" className="w-full">
          {/* Avaliação de Risco */}
          <AccordionItem value="risk" className="border rounded-lg mb-2 px-3">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Avaliação de Risco
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2">
              {change.risk_assessment ? (
                <Section
                  icon={AlertTriangle}
                  title="Avaliação de Risco"
                  accent="border-l-amber-500"
                >
                  {change.risk_assessment}
                </Section>
              ) : (
                <p className="text-[11px] text-slate-500">Nenhuma avaliação de risco registrada.</p>
              )}
              {change.risk_not_executing && (
                <Section
                  icon={AlertTriangle}
                  title="Riscos em não executar a mudança"
                  accent="border-l-orange-500"
                >
                  {change.risk_not_executing}
                </Section>
              )}
              {change.risk_executing && (
                <Section
                  icon={AlertTriangle}
                  title="Riscos em executar a mudança"
                  accent="border-l-red-500"
                >
                  {change.risk_executing}
                </Section>
              )}
              {!change.risk_assessment && !change.risk_not_executing && !change.risk_executing && (
                <p className="text-[11px] text-slate-500">Sem informações de risco registradas.</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Planos */}
          <AccordionItem value="plans" className="border rounded-lg px-3">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              <span className="flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" /> Planos de Execução e Rollback
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2">
              {change.execution_plan ? (
                <Section icon={PlayCircle} title="Plano de Execução" accent="border-l-blue-500">
                  {change.execution_plan}
                </Section>
              ) : (
                <p className="text-[11px] text-slate-500">Nenhum plano de execução registrado.</p>
              )}
              {change.rollback_plan ? (
                <Section icon={Undo2} title="Plano de Rollback" accent="border-l-purple-500">
                  {change.rollback_plan}
                </Section>
              ) : (
                !change.execution_plan && (
                  <p className="text-[11px] text-slate-500">Nenhum plano de rollback registrado.</p>
                )
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Comentário + botões de decisão */}
        <Textarea
          placeholder="Comentário (opcional)..."
          value={comments[approval.change] || ''}
          onChange={(e) => setComments({ ...comments, [approval.change]: e.target.value })}
          rows={2}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onDecide(approval.change, 'Aprovado')}
            disabled={processing === approval.change + 'Aprovado'}
          >
            {processing === approval.change + 'Aprovado' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}{' '}
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDecide(approval.change, 'Recusado')}
            disabled={processing === approval.change + 'Recusado'}
          >
            {processing === approval.change + 'Recusado' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-3.5 w-3.5" />
            )}{' '}
            Recusar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecide(approval.change, 'Solicitar Revisão')}
            disabled={processing === approval.change + 'Solicitar Revisão'}
          >
            {processing === approval.change + 'Solicitar Revisão' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}{' '}
            Revisão
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
