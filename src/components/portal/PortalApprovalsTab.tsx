import React, { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApprovalRecord } from '@/services/approvals'
import { decideClientApproval } from '@/services/client-portal'
import { formatDateTime } from '@/lib/date-format'
import { useToast } from '@/hooks/use-toast'

interface PortalApprovalsTabProps {
  approvals: ApprovalRecord[]
  loading: boolean
  onRefresh: () => void
  isFocalPoint: boolean
  onOpenTicket: (ticket: any) => void
}

export default function PortalApprovalsTab({
  approvals,
  loading,
  onRefresh,
  isFocalPoint,
  onOpenTicket,
}: PortalApprovalsTabProps) {
  const { toast } = useToast()
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRecord | null>(null)
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected'>('approved')
  const [decisionComment, setDecisionComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'Pendente' | 'Todos'>('Pendente')

  const pendingApprovals = approvals.filter((a) => a.status === 'Pendente')
  const displayApprovals = filterStatus === 'Pendente' ? pendingApprovals : approvals

  const handleOpenDecision = (approval: ApprovalRecord, decision: 'approved' | 'rejected') => {
    setSelectedApproval(approval)
    setDecisionType(decision)
    setDecisionComment('')
    setDecisionModalOpen(true)
  }

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    // Motivo obrigatório tanto na aprovação quanto na reprovação.
    if (!decisionComment.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description:
          decisionType === 'approved'
            ? 'Informe o motivo/parecer para autorizar a aprovação do chamado.'
            : 'Informe o motivo da reprovação do chamado.',
        variant: 'destructive',
      })
      return
    }
    if (!selectedApproval || !selectedApproval.token) {
      toast({
        title: 'Token de aprovação inválido',
        description: 'Não foi possível localizar o identificador desta aprovação.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      await decideClientApproval(
        selectedApproval.token,
        decisionType,
        decisionComment.trim() || undefined,
      )

      toast({
        title:
          decisionType === 'approved'
            ? 'Aprovação autorizada com sucesso!'
            : 'Solicitação reprovada com sucesso!',
        description:
          decisionType === 'approved'
            ? 'O chamado foi liberado para atendimento pela equipe de suporte.'
            : 'O chamado foi encerrado com a reprovação registrada no histórico.',
      })

      setDecisionModalOpen(false)
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Falha ao processar decisão',
        description:
          err?.response?.message ||
          err?.message ||
          'Não foi possível registrar a decisão no momento.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header com contadores e aviso */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-base text-foreground">
              Aprovações & Pareceres de Pontos Focais
            </h3>
            {pendingApprovals.length > 0 && (
              <Badge className="bg-amber-500 text-slate-900 font-bold text-xs">
                {pendingApprovals.length} pendente{pendingApprovals.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFocalPoint
              ? 'Como ponto focal da sua empresa, você pode autorizar ou reprovar chamados que exigem validação prévia.'
              : 'Visualização informativa das solicitações de aprovação da sua empresa.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant={filterStatus === 'Pendente' ? 'default' : 'outline'}
            className={
              filterStatus === 'Pendente'
                ? 'bg-[#D97706] hover:bg-amber-600 text-white font-bold text-xs h-8.5 shadow-xs'
                : 'text-xs h-8.5'
            }
            onClick={() => setFilterStatus('Pendente')}
          >
            Apenas Pendentes ({pendingApprovals.length})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === 'Todos' ? 'default' : 'outline'}
            className={
              filterStatus === 'Todos'
                ? 'bg-[#D97706] hover:bg-amber-600 text-white font-bold text-xs h-8.5 shadow-xs'
                : 'text-xs h-8.5'
            }
            onClick={() => setFilterStatus('Todos')}
          >
            Todas ({approvals.length})
          </Button>
        </div>
      </div>

      {!isFocalPoint && pendingApprovals.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>
            Seu perfil atual é <strong>Solicitante</strong>. As ações de aprovação/reprovação são
            reservadas aos <strong>Pontos Focais</strong> cadastrados. Se você é gestor da conta,
            solicite à equipe de suporte a elevação do seu usuário.
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground bg-card border rounded-2xl flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
          <p className="font-medium">Carregando aprovações...</p>
        </div>
      ) : displayApprovals.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground bg-card border rounded-2xl space-y-2.5 px-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="font-bold text-base text-foreground">
            {filterStatus === 'Pendente'
              ? 'Nenhuma aprovação pendente no momento!'
              : 'Nenhum histórico de aprovações localizado.'}
          </p>
          <p className="text-muted-foreground max-w-md mx-auto">
            Todos os chamados da sua empresa estão em andamento normal ou já foram decididos.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayApprovals.map((app) => {
            const ticket = app.expand?.ticket
            const isPending = app.status === 'Pendente'
            const isApproved = app.status === 'Aprovado'

            return (
              <Card
                key={app.id}
                className={`transition-all duration-200 ${
                  isPending
                    ? 'border-amber-500/50 bg-card hover:border-amber-500 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-card/80 border-border/80 opacity-90'
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#D97706] dark:text-[#FCD34D] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25">
                          {ticket ? ticket.number : 'Chamado'}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isPending
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold'
                              : isApproved
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                                : app.status === 'Cancelado'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold'
                          }
                        >
                          {app.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${
                            app.approval_role === 'internal'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40'
                              : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40'
                          }`}
                        >
                          {app.approval_role === 'internal'
                            ? 'Instância Interna (TI)'
                            : 'Instância do Cliente (Ponto Focal)'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {app.type || 'Aprovação'}
                        </Badge>
                        {ticket?.status && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 font-medium"
                          >
                            Status: {ticket.status}
                          </Badge>
                        )}
                        {app.mode && (
                          <span className="text-[11px] text-muted-foreground">
                            • Modo: {app.mode}
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {ticket ? ticket.title : 'Solicitação de Aprovação'}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>Solicitado em: {formatDateTime(app.created)}</span>
                        {app.expand?.requester?.name && (
                          <span>• Por: {app.expand.requester.name}</span>
                        )}
                        {app.deadline && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            • Prazo: {formatDateTime(app.deadline)}
                          </span>
                        )}
                      </CardDescription>
                    </div>

                    {ticket && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 gap-1 self-start sm:self-auto"
                        onClick={() => onOpenTicket(ticket)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver Chamado
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  {/* Justificativa da aprovação */}
                  <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
                    <span className="font-semibold text-muted-foreground block">
                      Motivo / Justificativa da Solicitação:
                    </span>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {app.justification || 'Nenhuma justificativa detalhada fornecida.'}
                    </p>
                    {(app.estimated_hours || app.estimated_cost) && (
                      <div className="pt-2 border-t mt-2 flex items-center gap-4 text-muted-foreground font-medium">
                        {app.estimated_hours ? (
                          <span>
                            Estimativa de Horas: <strong>{app.estimated_hours}h</strong>
                          </span>
                        ) : null}
                        {app.estimated_cost ? (
                          <span>
                            Custo Estimado:{' '}
                            <strong>
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(app.estimated_cost)}
                            </strong>
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Parecer do aprovador se já decidido */}
                  {(app.approver_comment || app.rejection_reason) && !isPending && (
                    <div className="p-2.5 rounded-md bg-muted/60 text-xs text-muted-foreground space-y-0.5">
                      <span className="font-semibold text-foreground">
                        {app.status === 'Reprovado'
                          ? 'Motivo da recusa registrado:'
                          : app.status === 'Cancelado'
                            ? 'Registro de cancelamento:'
                            : 'Parecer registrado:'}
                      </span>
                      <p className="text-foreground font-medium">
                        {app.rejection_reason || app.approver_comment}
                      </p>
                      <span className="text-[11px] block pt-1">
                        Decidido em:{' '}
                        {app.approved_at
                          ? formatDateTime(app.approved_at)
                          : app.rejected_at
                            ? formatDateTime(app.rejected_at)
                            : '-'}
                      </span>
                    </div>
                  )}

                  {/* Ações para Ponto Focal */}
                  {isPending && isFocalPoint && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs gap-1.5"
                        onClick={() => handleOpenDecision(app, 'rejected')}
                      >
                        <XCircle className="h-4 w-4" />
                        Reprovar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-2xs"
                        onClick={() => handleOpenDecision(app, 'approved')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar Chamado
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Confirmação de Decisão */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionType === 'approved' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Autorizar Aprovação do Chamado
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600" />
                  Reprovar Solicitação do Chamado
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval?.expand?.ticket
                ? `Chamado #${selectedApproval.expand.ticket.number}: ${selectedApproval.expand.ticket.title}`
                : 'Confirme sua decisão oficial para este chamado.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDecision} className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground">Impacto da Decisão:</span>
              <p>
                {decisionType === 'approved'
                  ? 'Ao aprovar, sua instância será marcada como Aprovada. Se houver fluxo duplo com equipe interna, o chamado aguardará a aprovação de ambas as partes antes de ser liberado como "Novo".'
                  : 'Ao reprovar, o chamado será encerrado definitivamente e o motivo da recusa será gravado no histórico.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Parecer / Observações do Ponto Focal <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={3}
                required
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder={
                  decisionType === 'approved'
                    ? 'Obrigatório: registre o motivo/parecer da aprovação...'
                    : 'Obrigatório: Justifique o motivo da reprovação...'
                }
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDecisionModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className={
                  decisionType === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }
              >
                {submitting
                  ? 'Processando...'
                  : decisionType === 'approved'
                    ? 'Confirmar Aprovação'
                    : 'Confirmar Reprovação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
