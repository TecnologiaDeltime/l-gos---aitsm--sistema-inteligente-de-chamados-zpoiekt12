import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getApprovals } from '@/services/approvals'
import type { ApprovalRecord } from '@/services/approvals'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/use-auth'

export default function TicketApprovalsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadApprovals = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const data = await getApprovals()
        setApprovals(data)
      } catch (err) {
        console.error(err)
        if (!silent) {
          toast({
            title: 'Erro ao carregar aprovações',
            description: 'Não foi possível buscar as aprovações pendentes.',
            variant: 'destructive',
          })
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  const isClientUser = user?.role === 'cliente_solicitante' || user?.role === 'cliente_gestor'

  const pending = approvals.filter((a) => a.status === 'Pendente')
  const decided = approvals.filter((a) => a.status !== 'Pendente')

  const statusBadge = (status: ApprovalRecord['status']) => {
    if (status === 'Aprovado')
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Aprovado</Badge>
      )
    if (status === 'Reprovado')
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Reprovado</Badge>
    if (status === 'Cancelado') return <Badge variant="outline">Cancelado</Badge>
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pendente</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            Aprovações
          </h1>
          <p className="text-sm text-muted-foreground">
            Pendências de aprovação geradas pelo fluxo de aprovação dos chamados.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadApprovals(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pendentes ({loading ? '…' : pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pending.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma aprovação pendente no momento.
            </p>
          ) : (
            pending.map((a) => {
              const ticketNumber = a.expand?.ticket?.number || '—'
              const ticketTitle = a.expand?.ticket?.title || a.expand?.ticket?.description || '—'
              return (
                <div key={a.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{ticketNumber}</span>
                    {a.expand?.ticket?.id && (
                      <Link
                        to={`/tickets/${a.expand.ticket.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {ticketTitle}
                      </Link>
                    )}
                    {statusBadge(a.status)}
                    {a.approval_role && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.approval_role === 'client'
                          ? 'Cliente'
                          : a.approval_role === 'internal'
                            ? 'Interna'
                            : 'Geral'}
                      </Badge>
                    )}
                    {a.mode && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.mode}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Tipo: <span className="font-medium">{a.type}</span>
                      {a.estimated_hours !== undefined && a.estimated_hours !== null && (
                        <span> · Horas estimadas: {a.estimated_hours}</span>
                      )}
                      {a.estimated_cost !== undefined && a.estimated_cost !== null && (
                        <span> · Custo estimado: R$ {a.estimated_cost}</span>
                      )}
                    </div>
                    <div>Justificativa: {a.justification || '—'}</div>
                    <div>
                      Solicitante: {a.expand?.requester?.name || a.requester}
                      {a.expand?.approver?.name ? ` · Aprovador: ${a.expand.approver.name}` : ''}
                      {a.target_email ? ` · Contato: ${a.target_email}` : ''}
                    </div>
                    <div>Criada em: {new Date(a.created).toLocaleString('pt-BR')}</div>
                    {a.deadline && <div>Prazo: {new Date(a.deadline).toLocaleString('pt-BR')}</div>}
                  </div>
                  {!isClientUser && (
                    <p className="text-[11px] text-muted-foreground/80">
                      A decisão fica por conta do aprovador (portal do cliente, e-mail ou link
                      público /approval/:token).
                    </p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico ({decided.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {decided.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma aprovação decidida ainda.
            </p>
          ) : (
            decided.map((a) => {
              const ticketNumber = a.expand?.ticket?.number || '—'
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <span className="font-mono text-xs font-semibold">{ticketNumber}</span>
                  <span className="font-medium">{a.expand?.ticket?.title || a.type}</span>
                  {statusBadge(a.status)}
                  <span className="text-xs text-muted-foreground">
                    {a.approved_at
                      ? `Aprovada em ${new Date(a.approved_at).toLocaleString('pt-BR')}`
                      : a.rejected_at
                        ? `Reprovada em ${new Date(a.rejected_at).toLocaleString('pt-BR')}`
                        : new Date(a.updated).toLocaleString('pt-BR')}
                  </span>
                  {a.approver_comment && (
                    <span className="w-full text-xs text-muted-foreground">
                      Comentário: {a.approver_comment}
                    </span>
                  )}
                  {a.rejection_reason && (
                    <span className="w-full text-xs text-red-500">
                      Motivo da reprovação: {a.rejection_reason}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
