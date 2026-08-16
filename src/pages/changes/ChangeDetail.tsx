import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  History,
  CheckCircle2,
  FileCheck,
  User,
  Building2,
  Clock,
  GitBranch,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getChange, getChangeAuditLogs, updateChange, type ChangeRecord } from '@/services/changes'
import { CHANGE_STATUSES } from '@/lib/change-constants'
import {
  ChangeStatusBadge,
  RiskLevelBadge,
  ChangePriorityBadge,
} from '@/components/ChangeStatusBadge'
import { formatHours } from '@/lib/duration'
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

  const loadData = () => {
    if (!id) return
    getChange(id)
      .then(setChange)
      .catch(() => {})
    getChangeAuditLogs(id)
      .then(setAuditLogs)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('changes', () => loadData())
  useRealtime('change_audit_logs', () => loadData())

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    await updateChange(id, { status: newStatus })
    toast({ title: `Status alterado para: ${newStatus}` })
    loadData()
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
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Aberto por{' '}
          <span className="font-semibold text-foreground">{change.expand?.requester?.name}</span> em{' '}
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
    </div>
  )
}
