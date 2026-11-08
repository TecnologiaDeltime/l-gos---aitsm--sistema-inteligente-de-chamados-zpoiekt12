import { useMemo } from 'react'
import { formatConversationListTime } from '@/lib/chat-format'
import { isChatOperatorOnline, ChatConversationSummary } from '@/services/operator-chat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { History, MessageSquare } from 'lucide-react'

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL

interface ConversationHistoryListProps {
  conversations: ChatConversationSummary[]
  loading: boolean
  hasLoadedOnce: boolean
  activePartnerId: string | null
  onSelect: (partnerId: string) => void
  /** Operadores conhecidos (para atualizar nome/avatar em tempo real quando disponíveis). */
  operators: Array<{
    id: string
    name: string
    email: string
    avatar?: string
    lastActivityAt?: string
  }>
  /** Tick do relógio de presença para recalcular online/offline (opcional). */
  presenceTick?: number
}

/**
 * Lista de conversas anteriores do operador logado (histórico do chat):
 * agrupadas por parceiro com prévia da última mensagem, data/hora e contador de não lidas.
 */
export function ConversationHistoryList({
  conversations,
  loading,
  hasLoadedOnce,
  activePartnerId,
  onSelect,
  operators,
  presenceTick,
}: ConversationHistoryListProps) {
  const byId = new Map(operators.map((o) => [o.id, o]))

  // Presença do parceiro recalculada a cada tick do relógio de presença da página,
  // para que conversas com operadores que ficaram online/offline atualizem em tempo real.
  const presenceById = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const op of operators) {
      map.set(op.id, isChatOperatorOnline(op as any, presenceTick ?? Date.now()))
    }
    return map
  }, [operators, presenceTick])

  return (
    <div className="space-y-1">
      {loading && !hasLoadedOnce ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          Carregando conversas...
        </div>
      ) : !loading && hasLoadedOnce && conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <History className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs font-medium text-foreground">Nenhuma conversa anterior</p>
          <p className="text-[11px] text-muted-foreground">
            Ao trocar mensagens no chat, elas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {conversations.map((conv) => {
            const live = byId.get(conv.partnerId)
            const name = live?.name || conv.partnerName
            const email = live?.email || conv.partnerEmail
            const isPartnerOnline = presenceById.get(conv.partnerId) ?? false
            const avatar = live?.avatar || conv.partnerAvatar
            const isActive = activePartnerId === conv.partnerId
            return (
              <button
                key={conv.partnerId}
                onClick={() => onSelect(conv.partnerId)}
                className={`w-full p-3 flex items-center justify-between gap-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-amber-500/10 border-l-4 border-amber-500 dark:bg-amber-950/40'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 border border-border">
                      {avatar && (
                        <AvatarImage
                          src={`${POCKETBASE_URL}/api/files/users/${conv.partnerId}/${avatar}`}
                        />
                      )}
                      <AvatarFallback className="bg-amber-500/20 text-amber-500 text-xs font-bold">
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatConversationListTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] truncate ${
                        isPartnerOnline
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPartnerOnline ? 'Online agora' : 'Offline'}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-muted-foreground truncate flex-1">
                        {conv.lastFromMe ? 'Você: ' : ''}
                        {conv.lastMessagePreview}
                      </p>
                      {conv.unread > 0 && (
                        <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-[10px] h-5 min-w-5 px-1.5 flex items-center justify-center shrink-0">
                          {conv.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
