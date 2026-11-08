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
  /** ISO da última atividade registrada (session_last_activity), usado para recalcular presença */
  lastActivityAt?: string
}

/** Limiar de presença online do chat (15 min sem atividade = Ausente). */
export const CHAT_ONLINE_THRESHOLD_MS = 15 * 60 * 1000

/**
 * Registro (em memória, por aba) da conversa que o operador está visualizando
 * aberta na tela do chat neste momento. Usado pelo ícone da barra superior
 * (ChatTopBarIcon) para NÃO tocar o alerta sonoro quando a mensagem chega na
 * conversa que o próprio operador já está vendo.
 */
let activeConversationPartnerId: string | null = null

export function setActiveConversationPartner(partnerId: string | null): void {
  activeConversationPartnerId = partnerId
}

export function getActiveConversationPartner(): string | null {
  return activeConversationPartnerId
}

/** Recalcula o estado online a partir da última atividade conhecida. */
export function isChatOperatorOnline(
  op: Pick<ChatOperatorUser, 'online' | 'lastActivityAt'>,
  now: number = Date.now(),
): boolean {
  if (!op.lastActivityAt) return op.online === true
  return now - new Date(op.lastActivityAt).getTime() < CHAT_ONLINE_THRESHOLD_MS
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
  // NOTA: o campo "status" NÃO existe na coleção users (o campo correto é "active" bool).
  // Filtrar por status = "Ativo" gerava HTTP 400 e a lista do chat voltava vazia
  // (ninguém aparecia como online). Filtramos por active = true.
  const users = await pb.collection('users').getFullList<any>({
    filter: `active = true && role != "cliente" && role != "cliente_gestor"`,
    sort: 'name',
    fields: 'id,name,email,avatar,role,active,session_last_activity,updated',
  })

  const now = Date.now()
  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutos

  return users.map((u) => {
    const lastActivity = u.session_last_activity || u.updated
    const lastTime = lastActivity ? new Date(lastActivity).getTime() : 0
    const online = lastTime > 0 && now - lastTime < ONLINE_THRESHOLD_MS

    return {
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      online,
      lastActivityAt: lastActivity || undefined,
    }
  })
}
