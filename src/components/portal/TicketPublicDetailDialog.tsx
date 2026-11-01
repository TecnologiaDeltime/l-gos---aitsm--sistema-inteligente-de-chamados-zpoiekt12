import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  User,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Star,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { TicketRecord, updateTicket } from '@/services/tickets'
import {
  getTicketPublicLogs,
  addTicketPublicComment,
  PublicLogRecord,
} from '@/services/client-portal'
import pb from '@/lib/pocketbase/client'
import { formatDateTime } from '@/lib/date-format'
import { useToast } from '@/hooks/use-toast'

interface TicketPublicDetailDialogProps {
  ticket: TicketRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId?: string
  onTicketUpdated?: () => void
}

export default function TicketPublicDetailDialog({
  ticket,
  open,
  onOpenChange,
  currentUserId,
  onTicketUpdated,
}: TicketPublicDetailDialogProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<PublicLogRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Pesquisa de satisfação
  const [satisfactionScore, setSatisfactionScore] = useState<number>(0)
  const [hoverScore, setHoverScore] = useState<number>(0)
  const [satisfactionComment, setSatisfactionComment] = useState<string>('')
  const [savingSatisfaction, setSavingSatisfaction] = useState(false)
  const [satisfactionSaved, setSatisfactionSaved] = useState(false)

  // Carrega e inicializa dados
  const loadLogs = async () => {
    if (!ticket) return
    try {
      setLoading(true)
      const data = await getTicketPublicLogs(ticket.id)
      setLogs(data)
    } catch {
      toast({
        title: 'Erro ao carregar timeline',
        description: 'Não foi possível carregar os logs públicos do chamado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Sincroniza dados da pesquisa de satisfação se já existirem no chamado
  useEffect(() => {
    if (open && ticket) {
      loadLogs()
      setCommentText('')

      const existingScore = (ticket as any).satisfaction_score || 0
      const existingComment = (ticket as any).satisfaction_comment || ''
      setSatisfactionScore(existingScore)
      setSatisfactionComment(existingComment)
      setSatisfactionSaved(existingScore > 0)
    }
  }, [open, ticket])

  // Enviar Resposta / Comentário público
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticket || !commentText.trim()) return

    // Obtém o ID do autor logado (currentUserId ou pb.authStore.record?.id)
    const authorId = currentUserId || pb.authStore.record?.id || (pb.authStore.model as any)?.id

    if (!authorId) {
      toast({
        title: 'Sessão não identificada',
        description: 'Por favor, faça login novamente para enviar respostas.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      await addTicketPublicComment(ticket.id, authorId, commentText.trim())
      toast({
        title: 'Resposta enviada!',
        description: 'Sua mensagem foi gravada e já está visível na thread do chamado.',
      })
      setCommentText('')
      await loadLogs()
      if (onTicketUpdated) onTicketUpdated()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar comentário',
        description: err?.message || 'Falha ao registrar mensagem.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Gravar Pesquisa de Satisfação
  const handleSaveSatisfaction = async () => {
    if (!ticket) return
    if (satisfactionScore < 1 || satisfactionScore > 5) {
      toast({
        title: 'Avaliação necessária',
        description: 'Por favor, selecione de 1 a 5 estrelas para avaliar o atendimento.',
        variant: 'destructive',
      })
      return
    }

    // Regra estrita: ao selecionar SOMENTE 1 estrela, comentário é OBRIGATÓRIO
    if (satisfactionScore === 1 && !satisfactionComment.trim()) {
      toast({
        title: 'Comentário obrigatório para 1 estrela',
        description:
          'Ao selecionar 1 estrela (muito ruim), por favor descreva o motivo no comentário para que possamos melhorar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingSatisfaction(true)
      const nowIso = new Date().toISOString()

      // 1. Grava no chamado (tickets)
      await updateTicket(ticket.id, {
        satisfaction_score: satisfactionScore,
        satisfaction_comment: satisfactionComment.trim() || undefined,
        satisfaction_responded_at: nowIso,
      } as any)

      // 2. Grava ou atualiza também na coleção satisfaction_surveys se possível
      try {
        const respondentId =
          currentUserId || pb.authStore.record?.id || (pb.authStore.model as any)?.id
        await pb.collection('satisfaction_surveys').create({
          ticket: ticket.id,
          company: ticket.company,
          respondent: respondentId || undefined,
          overall_score: satisfactionScore,
          quality_score: satisfactionScore,
          solution_score: satisfactionScore,
          comment: satisfactionComment.trim() || undefined,
          responded_at: nowIso,
        })
      } catch (surveyErr) {
        // Não bloqueia caso a coleção satisfaction_surveys já tenha token ou rule diferente
        console.warn('Registro em satisfaction_surveys informativo:', surveyErr)
      }

      setSatisfactionSaved(true)
      toast({
        title: 'Avaliação gravada com sucesso!',
        description: 'Agradecemos o seu feedback sobre este atendimento.',
      })

      if (onTicketUpdated) onTicketUpdated()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar avaliação',
        description: err?.message || 'Falha ao salvar a pesquisa de satisfação.',
        variant: 'destructive',
      })
    } finally {
      setSavingSatisfaction(false)
    }
  }

  if (!ticket) return null

  const starLabels: Record<number, string> = {
    1: '1 estrela — Muito Ruim',
    2: '2 estrelas — Ruim',
    3: '3 estrelas — Regular',
    4: '4 estrelas — Bom',
    5: '5 estrelas — Excelente',
  }

  const activeStar = hoverScore || satisfactionScore

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                #{ticket.number}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <Badge variant="outline" className="text-xs">
              SLA: {ticket.sla_status || 'Dentro do Prazo'}
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground mt-2 line-clamp-2">
            {ticket.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            <span>Aberto em: {formatDateTime(ticket.created)}</span>
            {ticket.expand?.category?.name && (
              <span>• Categoria: {ticket.expand.category.name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Descrição Inicial do Chamado */}
          <div className="p-4 rounded-lg bg-muted/40 border space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-amber-500" />
                {ticket.requester_name || 'Solicitante'} ({ticket.requester_email || 'E-mail'})
              </span>
              <span>Abertura</span>
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {ticket.description || 'Sem descrição fornecida.'}
            </p>
          </div>

          {/* =========================================================================
              PESQUISA DE SATISFAÇÃO (1 a 5 Estrelas)
              ========================================================================= */}
          <div className="p-4 rounded-xl border bg-card/80 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Pesquisa de Satisfação do Chamado
                </h4>
              </div>
              {satisfactionSaved && (
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Avaliação Gravada
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Como você avalia o atendimento prestado para este chamado? (1 = muito ruim, 5 =
              excelente)
            </p>

            {/* Estrelas interativas */}
            <div className="flex items-center gap-1.5 pt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverScore || satisfactionScore)
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSatisfactionScore(star)}
                    onMouseEnter={() => setHoverScore(star)}
                    onMouseLeave={() => setHoverScore(0)}
                    className="p-1 rounded-md transition-transform hover:scale-110 focus:outline-hidden"
                    title={starLabels[star]}
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        filled
                          ? 'text-amber-500 fill-amber-500 drop-shadow-xs'
                          : 'text-zinc-400 dark:text-zinc-600 hover:text-amber-400'
                      }`}
                    />
                  </button>
                )
              })}
              {activeStar > 0 && (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-2">
                  {starLabels[activeStar]}
                </span>
              )}
            </div>

            {/* Alerta de 1 estrela com comentário obrigatório */}
            {satisfactionScore === 1 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>
                  <strong>Atenção:</strong> Ao avaliar com 1 estrela (muito ruim), o comentário é{' '}
                  <strong>obrigatório</strong>. Explique o que aconteceu para acionarmos a gerência.
                </span>
              </div>
            )}

            {/* Campo de comentário da avaliação */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Comentário sobre o atendimento</span>
                {satisfactionScore === 1 ? (
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                    * Obrigatório para 1 estrela
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-normal">Opcional</span>
                )}
              </label>
              <Textarea
                rows={2}
                placeholder={
                  satisfactionScore === 1
                    ? 'Descreva obrigatoriamente os motivos que levaram à nota 1...'
                    : 'Deixe seu comentário ou sugestão de melhoria...'
                }
                value={satisfactionComment}
                onChange={(e) => setSatisfactionComment(e.target.value)}
                className={`text-xs resize-none ${
                  satisfactionScore === 1 && !satisfactionComment.trim()
                    ? 'border-rose-500 focus-visible:ring-rose-500'
                    : ''
                }`}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {satisfactionSaved && satisfactionScore > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  Nota registrada: <strong>{satisfactionScore} estrela(s)</strong>
                  {satisfactionComment ? ` • "${satisfactionComment}"` : ''}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Sua avaliação ajuda a monitorar os padrões de qualidade da sua organização.
                </span>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleSaveSatisfaction}
                disabled={
                  savingSatisfaction ||
                  satisfactionScore === 0 ||
                  (satisfactionScore === 1 && !satisfactionComment.trim())
                }
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 h-8"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {savingSatisfaction
                  ? 'Salvando...'
                  : satisfactionSaved
                    ? 'Atualizar Avaliação'
                    : 'Gravar Avaliação'}
              </Button>
            </div>
          </div>

          {/* Timeline de Logs Públicos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                Histórico & Logs Públicos ({logs.length})
              </h4>
              <Badge variant="secondary" className="text-[10px] text-muted-foreground font-normal">
                Notas internas do operador são ocultadas automaticamente
              </Badge>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Carregando interações públicas...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                Nenhum log público registrado até o momento.
              </div>
            ) : (
              <div className="relative pl-4 border-l-2 border-amber-500/20 space-y-4">
                {logs.map((log) => {
                  const authorRole = log.expand?.author?.role || ''
                  const isStaff =
                    authorRole === 'admin' ||
                    authorRole === 'gestor' ||
                    authorRole === 'operador' ||
                    authorRole === 'tecnico'
                  return (
                    <div
                      key={log.id}
                      className="relative bg-card border rounded-lg p-3.5 text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span
                            className={
                              isStaff
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }
                          >
                            {log.expand?.author?.name || 'Participante'}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {isStaff ? 'Atendimento Suporte' : 'Cliente'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(log.created)}
                        </span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                        {log.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Formulário de Novo Comentário Público */}
        <div className="p-4 border-t bg-card">
          <form onSubmit={handleAddComment} className="space-y-3">
            <Textarea
              placeholder="Adicione uma resposta ou informação complementar ao chamado..."
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="text-xs resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Mensagem visível para a equipe de atendimento
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !commentText.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Enviando...' : 'Enviar Resposta'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
