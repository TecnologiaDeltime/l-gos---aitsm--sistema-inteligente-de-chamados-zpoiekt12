import pb from '@/lib/pocketbase/client'

export interface OperatorChatMessageRecord {
  id: string
  sender: string
  recipient: string
  content: string
  read?: boolean
  read_at?: string
  created: string
  updated: string
  expand?: {
    sender?: {
      id: string
      name: string
      email: string
      avatar?: string
      role?: string
    }
    recipient?: {
      id: string
      name: string
      email: string
      avatar?: string
      role?: string
    }
  }
}

export type OperatorChatMessage = OperatorChatMessageRecord

export interface ChatOperatorUser {
  id: string
  name: string
  email: string
  avatar?: string
  role?: string
  status?: string
  online?: boolean
}

/**
 * Busca histórico de mensagens entre dois operadores.
 */
export async function getConversationMessages(
  userId: string,
  otherUserId: string,
  limit = 100,
): Promise<OperatorChatMessageRecord[]> {
  if (!userId || !otherUserId) return []
  const filter = `(sender = "${userId}" && recipient = "${otherUserId}") || (sender = "${otherUserId}" && recipient = "${userId}")`
  return pb.collection('operator_chat_messages').getFullList<OperatorChatMessageRecord>({
    filter,
    sort: 'created',
    expand: 'sender,recipient',
    limit,
  })
}

/**
 * Envia uma nova mensagem 1:1.
 */
export async function sendChatMessage(
  senderId: string,
  recipientId: string,
  content: string,
): Promise<OperatorChatMessageRecord> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Mensagem vazia')

  return pb.collection('operator_chat_messages').create<OperatorChatMessageRecord>({
    sender: senderId,
    recipient: recipientId,
    content: trimmed,
    read: false,
  })
}

/**
 * Envia uma nova mensagem 1:1 (aceita objeto ou parâmetros posicionais).
 */
export async function sendOperatorMessage(
  dataOrSender:
    | {
        sender: string
        recipient: string
        content: string
      }
    | string,
  recipientId?: string,
  content?: string,
): Promise<OperatorChatMessageRecord> {
  if (typeof dataOrSender === 'object') {
    return sendChatMessage(dataOrSender.sender, dataOrSender.recipient, dataOrSender.content)
  }
  return sendChatMessage(dataOrSender, recipientId || '', content || '')
}

/**
 * Marca mensagens trocadas entre dois usuários como lidas.
 * Aceita markConversationAsRead(operatorId, currentUserId) ou (recipientId, senderId).
 */
export async function markConversationAsRead(arg1: string, arg2: string): Promise<void> {
  if (!arg1 || !arg2) return
  const filter = `((recipient = "${arg1}" && sender = "${arg2}") || (recipient = "${arg2}" && sender = "${arg1}")) && read = false`
  const unreadList = await pb
    .collection('operator_chat_messages')
    .getFullList<OperatorChatMessageRecord>({
      filter,
    })

  const now = new Date().toISOString()
  await Promise.all(
    unreadList.map((msg) =>
      pb
        .collection('operator_chat_messages')
        .update(msg.id, {
          read: true,
          read_at: now,
        })
        .catch((e) => console.warn('Erro ao marcar msg como lida:', e)),
    ),
  )
}

/**
 * Conta mensagens não lidas recebidas pelo usuário logado, agrupadas por remetente.
 */
export async function getUnreadCountsBySender(
  currentUserId: string,
): Promise<Record<string, number>> {
  if (!currentUserId) return {}
  const list = await pb
    .collection('operator_chat_messages')
    .getFullList<OperatorChatMessageRecord>({
      filter: `recipient = "${currentUserId}" && read = false`,
      fields: 'id,sender',
    })

  const counts: Record<string, number> = {}
  for (const m of list) {
    counts[m.sender] = (counts[m.sender] || 0) + 1
  }
  return counts
}

export const getUnreadCountBySender = getUnreadCountsBySender

/**
 * Busca a lista de operadores / usuários internos do sistema.
 */
export async function getChatOperators(): Promise<ChatOperatorUser[]> {
  const users = await pb.collection('users').getFullList<any>({
    filter: `role != "cliente" && role != "cliente_gestor" && status = "Ativo"`,
    sort: 'name',
    fields: 'id,name,email,avatar,role,status,session_last_activity,updated',
  })

  const now = Date.now()
  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutos

  return users.map((u) => {
    const lastActivity = u.session_last_activity || u.updated
    const lastTime = lastActivity ? new Date(lastActivity).getTime() : 0
    const online = now - lastTime < ONLINE_THRESHOLD_MS

    return {
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      status: u.status,
      online,
    }
  })
}
