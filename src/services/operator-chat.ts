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
 * Marca mensagens enviadas por outro usuário como lidas pelo usuário atual.
 */
export async function markConversationAsRead(recipientId: string, senderId: string): Promise<void> {
  if (!recipientId || !senderId) return
  const filter = `recipient = "${recipientId}" && sender = "${senderId}" && read = false`
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

/**
 * Busca a lista de operadores / usuários internos do sistema.
 */
export async function getChatOperators(): Promise<ChatOperatorUser[]> {
  const users = await pb.collection('users').getFullList<any>({
    filter: `role != "cliente" && role != "cliente_gestor" && status = "Ativo"`,
    sort: 'name',
    fields: 'id,name,email,avatar,role,status',
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    status: u.status,
  }))
}
