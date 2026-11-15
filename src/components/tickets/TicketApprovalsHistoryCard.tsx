import { useEffect, useState } from 'react'
import { ShieldCheck, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getTicketApprovals, ApprovalRecord } from '@/services/approvals'
import { formatDateTime } from '@/lib/date-format'

interface TicketApprovalsHistoryCardProps {
  ticketId: string
  /** Muda quando o chamado é atualizado (ex.: decisão de aprovação) para recarregar o histórico */
  refreshKey?: string
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Aprovado':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold'
    case 'Reprovado':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold'
    case 'Cancelado':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold'
    default:
      // Pendente — mesmo destaque âmbar forte usado no Portal
      return 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold'
  }
}

function decisionLabel(app: ApprovalRecord) {
  if (app.status === 'Pendente') return null
  const decidedAt = app.approved_at || app.rejected_at
  return decidedAt ? formatDateTime(decidedAt) : null
}

function reasonLabel(status: string) {
  if (status === 'Reprovado') return 'Motivo da reprovação:'
  if (status === 'Cancelado') return 'Registro de cancelamento:'
  return 'Parecer registrado:'
}

/**
 * Histórico de Aprovações na ficha interna do chamado.
 * Só é renderizado quando existir pelo menos um registro de aprovação.
 * Falhas de consulta são silenciosas (não travam a ficha).
 */
export default function TicketApprovalsHistoryCard({
  ticketId,
  refreshKey,
}: TicketApprovalsHistoryCardProps) {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])

  useEffect(() => {
    if (!ticketId) return
    let isCurrent = true
    getTicketApprovals(ticketId)
      .then((res) => {
        if (isCurrent) setApprovals(res || [])
      })
      .catch(() => {
        if (isCurrent) setApprovals([])
      })
    return () => {
      isCurrent = false
    }
  }, [ticketId, refreshKey])

  if (approvals.length === 0) return null

  return (
    <div className="itsm-card p-4 space-y-3">
      <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        Histórico de Aprovações ({approvals.length})
      </h3>
      <div className="space-y-2">
        {approvals.map((app) => {
          const approverName =
            app.expand?.approver?.name ||
            app.expand?.target_contact?.full_name ||
            app.target_email ||
            'Aguardando aprovador'
          const decidedAt = decisionLabel(app)
          const reason = app.rejection_reason || app.approver_comment

          return (
            <div key={app.id} className="rounded-md border border-border p-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
                  <UserCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{approverName}</span>
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusBadgeClass(app.status)}`}
                >
                  {app.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-[11px]">
                  {app.approval_role === 'internal'
                    ? 'Instância Interna (TI)'
                    : 'Instância do Cliente (Ponto Focal)'}
                </span>
                {decidedAt && <span className="text-[11px] shrink-0">Decisão: {decidedAt}</span>}
              </div>
              {reason && (
                <p className="text-[11px] text-muted-foreground border-t border-border pt-1.5">
                  <span className="font-semibold text-foreground">{reasonLabel(app.status)} </span>
                  {reason}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
