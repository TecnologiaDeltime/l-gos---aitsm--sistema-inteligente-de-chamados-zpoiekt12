import { useState } from 'react'
import { Sparkles, Loader2, Copy, Check, Send, RotateCw, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { aiTicketReplyService } from '@/services/ai-ticket-reply'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface TicketAiReplyPanelProps {
  ticketId: string
  ticketNumber?: string
  requesterName?: string
  canEdit: boolean
  onApplyDraft: (draftText: string) => void
}

export function TicketAiReplyPanel({
  ticketId,
  ticketNumber,
  requesterName,
  canEdit,
  onApplyDraft,
}: TicketAiReplyPanelProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async (promptOverride?: string) => {
    if (!ticketId) return
    setLoading(true)
    try {
      const res = await aiTicketReplyService.generateDraft({
        ticketId,
        prompt: promptOverride || customPrompt || undefined,
      })
      setDraft(res.draft)
      setIsOpen(true)
      toast({
        title: 'Rascunho gerado pela IA!',
        description: 'Revise o conteúdo abaixo antes de enviar como interação.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao gerar rascunho de IA',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Texto copiado para a área de transferência!' })
    } catch {
      /* intentionally ignored */
    }
  }

  const handleSendToComment = () => {
    if (!draft) return
    onApplyDraft(draft)
    toast({
      title: 'Rascunho inserido na caixa de resposta!',
      description: 'Você pode editar o texto e lançar o tempo antes de enviar.',
    })
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-primary font-mono">
                Agente de Resposta IA (ITSM)
              </span>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-primary border-amber-500/30 text-[10px] font-mono"
              >
                Skip Cloud Agent
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gera rascunho contextualizado com base no chamado, ativos e base de conhecimento.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleGenerate()}
              disabled={loading || !canEdit}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Gerar Resposta com IA
                </>
              )}
            </Button>
          )}

          {isOpen && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="h-8 text-xs border-border"
            >
              Fechar Painel
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-amber-500/20">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Rascunho Sugerido para {requesterName ? `"${requesterName}"` : 'o solicitante'}{' '}
                (revisável):
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleGenerate()}
                  disabled={loading}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  title="Regenerar resposta"
                >
                  <RotateCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Regenerar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  title="Copiar texto"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-emerald-500" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="text-xs font-sans leading-relaxed bg-card border-border focus-visible:ring-primary"
              placeholder="O rascunho da IA aparecerá aqui para você editar e revisar..."
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Instrução adicional opcional (ex: oriente reiniciar o modem)..."
                className="w-full h-8 text-xs px-2.5 rounded-md border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleGenerate(customPrompt)}
                disabled={loading || !customPrompt.trim()}
                className="h-8 text-xs shrink-0 border-border"
              >
                Ajustar com instrução
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSendToComment}
              disabled={!draft.trim() || !canEdit}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shrink-0"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Inserir na Resposta do Operador
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
