import { useState } from 'react'
import { Clock, Paperclip, Loader2, History, MessageSquare, Download, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HHMMInput } from '@/components/ui/HHMMInput'
import { ContextTip } from '@/components/ContextTip'
import { getAttachmentFileUrl } from '@/services/attachments'
import type { TicketAttachmentRecord } from '@/services/attachments'
import type { TicketInteractionRecord } from '@/services/tickets'
import { formatSeconds, parseHHMMToMinutes } from '@/lib/duration'

export interface HistoryRecord {
  id: string
  action: string
  field?: string
  old_value?: string
  new_value?: string
  created: string
  expand?: { user?: { id: string; name?: string; email?: string } }
}

interface TicketSheetTabsProps {
  interactions: TicketInteractionRecord[]
  history: HistoryRecord[]
  attachments: TicketAttachmentRecord[]
  isClosed: boolean
  sendingInteraction: boolean
  newInteraction: string
  newInteractionMinutes: string
  onNewInteractionChange: (value: string) => void
  onNewInteractionMinutesChange: (value: string) => void
  onSendInteraction: () => void
  onAttach: (files: FileList | null) => void
}

/**
 * Abas Interações / Histórico / Anexos da Ficha do Chamado — reutilizável
 * pela ficha em página (/tickets/:id) e pelo painel da Tela Dividida.
 */
export function TicketSheetTabs({
  interactions,
  history,
  attachments,
  isClosed,
  sendingInteraction,
  newInteraction,
  newInteractionMinutes,
  onNewInteractionChange,
  onNewInteractionMinutesChange,
  onSendInteraction,
  onAttach,
}: TicketSheetTabsProps) {
  const [sendingAttachment, setSendingAttachment] = useState(false)

  return (
    <Tabs defaultValue="interactions">
      <TabsList>
        <TabsTrigger value="interactions">
          <MessageSquare className="mr-1 h-4 w-4" /> Interações ({interactions.length})
        </TabsTrigger>
        <TabsTrigger value="history">
          <History className="mr-1 h-4 w-4" /> Histórico
        </TabsTrigger>
        <TabsTrigger value="attachments">
          <Paperclip className="mr-1 h-4 w-4" /> Anexos ({attachments.length})
        </TabsTrigger>
      </TabsList>

      {/* Aba Interações — com campo de tempo por interação */}
      <TabsContent value="interactions" className="space-y-3">
        {interactions.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
        )}
        {interactions.map((it) => (
          <div key={it.id} className="rounded-lg border p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {it.expand?.author?.name || 'Sistema'}
              </span>
              <span className="flex items-center gap-2">
                {typeof it.duration_minutes === 'number' && it.duration_minutes > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {formatSeconds(it.duration_minutes * 60)} de trabalho
                  </Badge>
                )}
                <span>
                  {it.type} · {new Date(it.created).toLocaleString('pt-BR')}
                </span>
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{it.content}</p>
          </div>
        ))}
        {!isClosed && (
          <div className="space-y-2 pt-2">
            <Textarea
              value={newInteraction}
              onChange={(e) => onNewInteractionChange(e.target.value)}
              rows={3}
              placeholder="Registrar uma interação (comentário interno ou para o cliente)..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                  Tempo&nbsp;(00:00)
                </span>
                <ContextTip
                  label="Como lançar o tempo da interação"
                  text="O tempo lançado aqui soma nas HORAS DE LOG do chamado. Digite só números — os dois-pontos aparecem sozinhos: 90 vira 01:30, 1030 vira 10:30. Deixe vazio para registrar a interação sem tempo."
                  align="start"
                />
                <HHMMInput
                  value={newInteractionMinutes}
                  onChange={onNewInteractionMinutesChange}
                  aria-label="Tempo da interação (horas e minutos)"
                  className="w-24"
                />
              </div>
              <Button
                size="sm"
                onClick={onSendInteraction}
                disabled={sendingInteraction || !newInteraction.trim()}
              >
                {sendingInteraction ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Enviar Interação
              </Button>
            </div>
          </div>
        )}
      </TabsContent>

      {/* Aba Histórico */}
      <TabsContent value="history" className="space-y-2">
        {history.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        )}
        {history.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {new Date(h.created).toLocaleString('pt-BR')}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {h.action}
            </Badge>
            {h.field && <span className="font-mono">{h.field}</span>}
            {h.new_value && (
              <span className="text-muted-foreground">
                {h.old_value ? `${h.old_value} → ` : ''}
                {h.new_value}
              </span>
            )}
            <span className="text-muted-foreground">
              por {h.expand?.user?.name || h.expand?.user?.email || 'sistema'}
            </span>
          </div>
        ))}
      </TabsContent>

      {/* Aba Anexos */}
      <TabsContent value="attachments" className="space-y-2">
        {attachments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
        {attachments.map((a) => (
          <a
            key={a.id}
            href={getAttachmentFileUrl(a)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded border px-2 py-1.5 text-xs hover:bg-muted/50"
          >
            <span className="truncate">{a.file_name || a.file}</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        ))}
        {!isClosed && (
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline">
            {sendingAttachment && <Loader2 className="h-3 w-3 animate-spin" />}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                setSendingAttachment(true)
                Promise.resolve(onAttach(e.target.files)).finally(() => setSendingAttachment(false))
              }}
            />
            Anexar arquivo…
          </label>
        )}
      </TabsContent>
    </Tabs>
  )
}
