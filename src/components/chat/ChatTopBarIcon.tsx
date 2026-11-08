import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'

import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { getActiveConversationPartner } from '@/services/operator-chat'
import { playChatMessagePop } from '@/lib/ticket-alerts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ChatUnreadMessage {
  id: string
  sender: string
  recipient: string
  read: boolean
}

/**
 * Ícone de chat na barra superior (ao lado do alternador de modo claro/escuro).
 *
 * - Mostra badge com a QUANTIDADE total de mensagens não lidas do operador
 *   (mesma fonte do chat: coleção operator_chat_messages, filtro recipient = eu && read = false).
 * - Clicar leva direto ao chat (/chat); a conversa aberta marca as mensagens como
 *   lidas lá dentro e o badge zera (o evento realtime de update atualiza o contador).
 * - Ao chegar mensagem nova para este usuário (que não seja na conversa que ele
 *   está visualizando aberta na tela do chat), toca o alerta sonoro discreto.
 *
 * Permissão: reutiliza o item existente chat.chat_operadores do catálogo —
 * nada novo no catálogo de permissões (regra permanente respeitada).
 */
export function ChatTopBarIcon() {
  const { user } = useAuth()
  const permissions = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [lastLoadedAt, setLastLoadedAt] = useState(0)

  const canChat = permissions.canAccessItem('chat', 'chat_operadores')

  // Recarrega a contagem de não lidas.
  const refreshUnread = useMemo(
    () => () => {
      if (!user) return
      pb.collection('operator_chat_messages')
        .getFullList<ChatUnreadMessage>({
          filter: `recipient = "${user.id}" && read = false`,
          fields: 'id,sender,recipient,read',
        })
        .then((list) => setUnreadTotal(list.length))
        .catch(() => {})
    },
    [user],
  )

  // Carga inicial + refresh periódico (rede de segurança caso o realtime caia).
  useEffect(() => {
    if (!user || !canChat) return
    refreshUnread()
    const interval = setInterval(refreshUnread, 30000)
    return () => clearInterval(interval)
  }, [user, canChat, refreshUnread, lastLoadedAt])

  // Realtime: qualquer criação/alteração em mensagens de chat atualiza o badge.
  useRealtime('operator_chat_messages', (e) => {
    if (!user || !canChat) return
    const record = e.record as any
    const involvesMe = record.sender === user.id || record.recipient === user.id
    if (!involvesMe) return

    if (e.action === 'create' && record.recipient === user.id) {
      // Mensagem nova para este operador: toca o som só se NÃO for da conversa
      // que o próprio operador está vendo aberta na tela do chat.
      const isActiveConversation =
        location.pathname.startsWith('/chat') && getActiveConversationPartner() === record.sender
      if (!isActiveConversation) {
        playChatMessagePop()
      }
      setUnreadTotal((prev) => prev + 1)
    } else if (e.action === 'update') {
      // Mensagem marcada como lida — recalcula a partir do servidor (fonte da verdade).
      refreshUnread()
    }
  })

  if (!canChat) return null

  const handleClick = () => {
    navigate('/chat')
    setLastLoadedAt(Date.now())
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="relative transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-secondary"
          aria-label={
            unreadTotal > 0
              ? `Chat interno — ${unreadTotal} mensagem${unreadTotal > 1 ? 's' : ''} não lida${unreadTotal > 1 ? 's' : ''}`
              : 'Chat interno entre operadores'
          }
        >
          <MessageSquare className="h-5 w-5" />
          {unreadTotal > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 shadow">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {unreadTotal > 0
            ? `Chat interno — ${unreadTotal} não lida${unreadTotal > 1 ? 's' : ''}`
            : 'Chat interno entre operadores'}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export default ChatTopBarIcon
