import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  User,
  Clock,
  ShieldCheck,
  Paperclip,
  CheckCircle2,
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
import { TicketRecord } from '@/services/tickets'
import {
  getTicketPublicLogs,
  addTicketPublicComment,
  PublicLogRecord,
} from '@/services/client-portal'
import { formatDateTime } from '@/lib/date-format'
import { useToast } from '@/hooks/use-toast'

interface TicketPublicDetailDialogProps {
  ticket: TicketRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId?: string
}

export default function TicketPublicDetailDialog({
  ticket,
  open,
  onOpenChange,
  currentUserId,
}: TicketPublicDetailDialogProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<PublicLogRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  useEffect(() => {
    if (open && ticket) {
      loadLogs()
      setCommentText('')
    }
  }, [open, ticket])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticket || !currentUserId || !commentText.trim()) return

    try {
      setSubmitting(true)
      await addTicketPublicComment(ticket.id, currentUserId, commentText.trim())
      toast({
        title: 'Comentário enviado!',
        description: 'Sua mensagem foi registrada com sucesso no chamado.',
      })
      setCommentText('')
      loadLogs()
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

  if (!ticket) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                {ticket.number}
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
