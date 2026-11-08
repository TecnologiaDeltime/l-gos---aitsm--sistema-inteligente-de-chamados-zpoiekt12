import pb from '@/lib/pocketbase/client'

export interface OperatorChatMessageRecord {
  id: string
  sender: string
  recipient: string
  content: string
  read?: boolean
  read_at?: string
  /** Anexo único (imagem, áudio ou vídeo) — migração 0137, máx. 5 MB. */
  file?: string
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
  limit = CHAT_MESSAGES_PAGE_SIZE,
): Promise<OperatorChatMessageRecord[]> {
  if (!userId || !otherUserId) return []
  const filter = `(sender = "${userId}" && recipient = "${otherUserId}") || (sender = "${otherUserId}" && recipient = "${userId}")`
  // Janela das mensagens MAIS RECENTES da conversa (o restante entra via "Carregar
  // mensagens mais antigas", paginado por getConversationMessagesPage).
  const page = await pb
    .collection('operator_chat_messages')
    .getList<OperatorChatMessageRecord>(1, limit, {
      filter,
      sort: '-created',
      expand: 'sender,recipient',
    })
  return [...page.items].reverse()
}

/** Indica se existem mensagens mais antigas além das carregadas na janela inicial. */
export function hasOlderMessages(loadedCount: number, pageSize = CHAT_MESSAGES_PAGE_SIZE): boolean {
  return loadedCount >= pageSize
}

/** Tamanho máximo do anexo do chat (5 MB — mesmo limite do campo file na migração 0137). */
export const CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

/** Tipos MIME aceitos no anexo do chat (imagem, áudio e vídeo). */
export const CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'video/webm',
  'video/mp4',
  'video/quicktime',
]

/**
 * Envia uma nova mensagem 1:1.
 * `file` (opcional) é um anexo único de imagem, áudio ou vídeo (máx. 5 MB).
 */
export async function sendChatMessage(
  senderId: string,
  recipientId: string,
  content: string,
  file?: File | null,
): Promise<OperatorChatMessageRecord> {
  const trimmed = content.trim()
  if (!trimmed && !file) throw new Error('Mensagem vazia')

  if (!file) {
    return pb.collection('operator_chat_messages').create<OperatorChatMessageRecord>({
      sender: senderId,
      recipient: recipientId,
      content: trimmed,
      read: false,
    })
  }

  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error('Arquivo maior que o limite de 5 MB')
  }

  const formData = new FormData()
  formData.append('sender', senderId)
  formData.append('recipient', recipientId)
  // PocketBase exige content (required): quando a mensagem é só o anexo, usamos um texto curto.
  formData.append('content', trimmed || filePlaceholderText(file))
  formData.append('read', 'false')
  formData.append('file', file)

  return pb.collection('operator_chat_messages').create<OperatorChatMessageRecord>(formData)
}

/** Texto padrão da mensagem quando só há anexo (sem texto digitado). */
export function filePlaceholderText(file: File): string {
  if (file.type.startsWith('image/')) return '📷 Foto'
  if (file.type.startsWith('video/')) return '🎬 Vídeo'
  if (file.type.startsWith('audio/')) return '🎤 Áudio'
  return '📎 Anexo'
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
        file?: File | null
      }
    | string,
  recipientId?: string,
  content?: string,
  file?: File | null,
): Promise<OperatorChatMessageRecord> {
  if (typeof dataOrSender === 'object') {
    return sendChatMessage(
      dataOrSender.sender,
      dataOrSender.recipient,
      dataOrSender.content,
      dataOrSender.file,
    )
  }
  return sendChatMessage(dataOrSender, recipientId || '', content || '', file)
}

/** URL do arquivo anexado a uma mensagem do chat (protegido pelas regras da coleção 0136). */
export function getChatMessageFileUrl(
  msg: Pick<OperatorChatMessageRecord, 'id' | 'file'> & { collectionId?: string },
): string {
  if (!msg.file) return ''
  return pb.files.getURL(msg as any, msg.file)
}

/** Classifica o anexo da mensagem pelo MIME/tipo do nome do arquivo. */
export function getChatAttachmentKind(
  msg: Pick<OperatorChatMessageRecord, 'file'>,
): 'image' | 'audio' | 'video' | null {
  if (!msg.file) return null
  const name = msg.file.toLowerCase()
  if (/\.(png|jpe?g|gif|webp)$/.test(name)) return 'image'
  if (/\.(webm|ogg|oga|mp3|m4a|wav)$/.test(name)) return 'audio'
  if (/\.(webm|mp4|mov)$/.test(name)) return 'video'
  // PocketBase renomeia preservando a extensão; sem extensão reconhecida, não renderiza player.
  return null
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

/** Janela padrão de mensagens carregadas por vez ao abrir uma conversa do histórico. */
export const CHAT_MESSAGES_PAGE_SIZE = 50

export interface ChatConversationSummary {
  /** ID do outro operador (parceiro da conversa com o usuário logado). */
  partnerId: string
  /** Nome do parceiro (via expand da mensagem mais recente ou fallback pelo id). */
  partnerName: string
  partnerEmail?: string
  partnerAvatar?: string
  /** Prévia truncada da última mensagem trocada com este parceiro. */
  lastMessagePreview: string
  /** Data/hora (ISO) da última mensagem trocada com este parceiro. */
  lastMessageAt: string
  /** true = a última mensagem foi enviada pelo usuário logado. */
  lastFromMe: boolean
  /** Quantidade de mensagens não lidas recebidas deste parceiro. */
  unread: number
  /** Quantidade total de mensagens trocadas com este parceiro (se conhecida). */
  messageCount?: number
}

/** Trunca o conteúdo de uma mensagem para uso como prévia na lista de conversas. */
function truncatePreview(content: string, max = 70): string {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine
}

/**
 * Monta o histórico de conversas do usuário logado: agrupa as mensagens em que ele é
 * sender OU recipient por operador com quem conversou, calculando última mensagem,
 * prévia, data/hora e contador de não lidas. Ordenado da conversa mais recente para a
 * mais antiga. O nome do parceiro é resolvido com os operadores já carregados no chat
 * (quando informado), pois a listRule da coleção garante que só chegam mensagens
 * próprias (0136) — nada é lido fora do escopo do usuário logado.
 */
export async function getChatConversations(
  currentUserId: string,
  opts: {
    limit?: number
    operators?: ChatOperatorUser[]
    unreadCounts?: Record<string, number>
  } = {},
): Promise<ChatConversationSummary[]> {
  if (!currentUserId) return []
  const limit = opts.limit ?? 500

  const list = await pb
    .collection('operator_chat_messages')
    .getFullList<OperatorChatMessageRecord>({
      filter: `sender = "${currentUserId}" || recipient = "${currentUserId}"`,
      sort: '-created',
      expand: 'sender,recipient',
      limit,
    })

  const byId = new Map<string, ChatOperatorUser>()
  for (const op of opts.operators || []) byId.set(op.id, op)
  const unread = opts.unreadCounts || {}

  const map = new Map<string, ChatConversationSummary>()
  for (const m of list) {
    const partnerId = m.sender === currentUserId ? m.recipient : m.sender
    const existing = map.get(partnerId)
    if (existing) {
      existing.messageCount = (existing.messageCount || 0) + 1
      continue // a lista já vem em -created: a primeira ocorrência é a última mensagem
    }
    // resolve parceiro: expand da própria mensagem, depois lista de operadores do chat
    const expanded =
      m.expand?.sender?.id === partnerId
        ? m.expand.sender
        : m.expand?.recipient?.id === partnerId
          ? m.expand.recipient
          : undefined
    const op = byId.get(partnerId)
    map.set(partnerId, {
      partnerId,
      partnerName: expanded?.name || op?.name || partnerId,
      partnerEmail: expanded?.email || op?.email,
      partnerAvatar: expanded?.avatar || op?.avatar,
      lastMessagePreview: truncatePreview(m.content),
      lastMessageAt: m.created,
      lastFromMe: m.sender === currentUserId,
      unread: unread[partnerId] || 0,
      messageCount: 1,
    })
  }

  // A lista já vem ordenada por -created; preservamos essa ordem no Map (inserção).
  return Array.from(map.values())
}

/**
 * Página de mensagens antigas de uma conversa (para o "Carregar mais" do histórico).
 * Retorna as mensagens ANTERIORES a `before` (ISO), em ordem cronológica ascendente.
 */
export async function getConversationMessagesPage(
  userId: string,
  otherUserId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<OperatorChatMessageRecord[]> {
  if (!userId || !otherUserId) return []
  const limit = opts.limit ?? CHAT_MESSAGES_PAGE_SIZE
  const beforeClause = opts.before ? ` && created < "${opts.before}"` : ''
  const filter = `((sender = "${userId}" && recipient = "${otherUserId}") || (sender = "${otherUserId}" && recipient = "${userId}"))${beforeClause}`
  const page = await pb
    .collection('operator_chat_messages')
    .getList<OperatorChatMessageRecord>(1, limit, {
      filter,
      sort: '-created',
      expand: 'sender,recipient',
    })
  return [...page.items].reverse()
}

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
