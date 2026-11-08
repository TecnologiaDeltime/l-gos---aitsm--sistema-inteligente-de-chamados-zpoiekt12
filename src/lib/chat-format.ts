import { OperatorChatMessage } from '@/services/operator-chat'

/**
 * Hora curta (hh:mm) de uma mensagem do chat, no padrão brasileiro.
 * Usada nas bolhas de conversa do chat interno de operadores.
 */
export function formatChatTime(msg: Pick<OperatorChatMessage, 'created'>): string {
  if (!msg.created) return ''
  try {
    return new Date(msg.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
