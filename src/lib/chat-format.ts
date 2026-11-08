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

/**
 * Rótulo curto de data/hora para a lista de conversas do histórico do chat:
 * "agora" / "hh:mm" para hoje, "Ontem", dia da semana (últimos 6 dias) e
 * "dd/mm/aaaa" para datas mais antigas.
 */
export function formatConversationListTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const t = d.getTime()

    if (t >= startOfToday) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
    if (t >= startOfYesterday) return 'Ontem'

    const days = Math.floor((startOfToday - t) / (24 * 60 * 60 * 1000))
    if (days <= 6) {
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' })
      return label.charAt(0).toUpperCase() + label.slice(1)
    }

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}
