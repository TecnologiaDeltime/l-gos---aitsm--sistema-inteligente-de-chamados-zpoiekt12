import pb from '@/lib/pocketbase/client'
import { TicketRecord } from '@/services/tickets'
import { TicketViewRecord, getTicketViews } from '@/services/ticket-views'
import { TicketAttachmentRecord, getTicketAttachments } from '@/services/attachments'

export type ParticipantRole = 'Solicitante' | 'Responsável' | 'Operador' | 'Visualizou'

export interface TicketParticipant {
  key: string // Identificador único (id de usuário ou email)
  userId?: string
  name: string
  email?: string
  avatarUrl?: string
  roles: ParticipantRole[] // Todos os papéis que ele desempenha neste chamado
  primaryRole: ParticipantRole // Papel principal para destaque
  lastActivityAt: string // ISO string da data mais recente
  actionDescription: string // Ex: "Visualizou o chamado", "Comentou", "Atribuído", etc.
  online?: boolean // Indica se a última atividade foi recente (ex: nos últimos 5 minutos)
}

/**
 * Constrói a URL completa para visualização do avatar do usuário.
 */
function getAvatarUrl(user?: {
  id?: string
  avatar?: string
  collectionId?: string
}): string | undefined {
  if (!user || !user.avatar || !user.id) return undefined
  try {
    return pb.files.getURL(
      { id: user.id, collectionName: 'users', avatar: user.avatar } as any,
      user.avatar,
    )
  } catch {
    return undefined
  }
}

/**
 * Verifica se uma data ISO é considerada recente (ex: últimos 5 minutos).
 */
function isRecent(dateIso?: string): boolean {
  if (!dateIso) return false
  const time = new Date(dateIso).getTime()
  if (isNaN(time)) return false
  const diffMinutes = (Date.now() - time) / (1000 * 60)
  return diffMinutes >= 0 && diffMinutes <= 5
}

/**
 * Agrega e deduplica todas as pessoas que "entraram no chamado":
 * (a) Criador/Solicitante (requester_name / requester_email)
 * (b) Atribuído / Responsável (assigned_to)
 * (c) Quem comentou/interagiu (ticket_interactions)
 * (d) Quem anexou arquivos (ticket_attachments)
 * (e) Quem visualizou o chamado (ticket_views)
 *
 * Cada pessoa aparece apenas UMA vez, com seus papéis consolidados e ordenados
 * pelo acesso/interação mais recente.
 */
export async function getConsolidatedTicketParticipants(
  ticket: TicketRecord,
  interactions: any[] = [],
  attachments?: TicketAttachmentRecord[],
  views?: TicketViewRecord[],
): Promise<TicketParticipant[]> {
  const map = new Map<string, TicketParticipant>()

  // 1. Carrega anexos e views caso não tenham sido passados
  const loadedAttachments = attachments ?? (await getTicketAttachments(ticket.id).catch(() => []))
  const loadedViews = views ?? (await getTicketViews(ticket.id).catch(() => []))

  // Helper para atualizar ou inserir participante
  const addOrUpdate = (params: {
    key: string
    userId?: string
    name: string
    email?: string
    avatarUrl?: string
    role: ParticipantRole
    activityDate: string
    actionDescription: string
  }) => {
    if (!params.key && !params.email && !params.userId) return
    const key = (params.userId || params.email || params.name || 'unknown').toLowerCase().trim()

    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        userId: params.userId,
        name: params.name || 'Usuário',
        email: params.email,
        avatarUrl: params.avatarUrl,
        roles: [params.role],
        primaryRole: params.role,
        lastActivityAt: params.activityDate || new Date().toISOString(),
        actionDescription: params.actionDescription,
        online: isRecent(params.activityDate),
      })
    } else {
      // Atualiza dados faltantes
      if (!existing.name && params.name) existing.name = params.name
      if (!existing.email && params.email) existing.email = params.email
      if (!existing.avatarUrl && params.avatarUrl) existing.avatarUrl = params.avatarUrl
      if (!existing.userId && params.userId) existing.userId = params.userId

      // Adiciona papel se ainda não constar
      if (!existing.roles.includes(params.role)) {
        existing.roles.push(params.role)
      }

      // Prioridade do primaryRole: Responsável > Solicitante > Operador > Visualizou
      const rolePriority: Record<ParticipantRole, number> = {
        Responsável: 4,
        Solicitante: 3,
        Operador: 2,
        Visualizou: 1,
      }
      if (rolePriority[params.role] > rolePriority[existing.primaryRole]) {
        existing.primaryRole = params.role
      }

      // Se a nova atividade for mais recente, atualiza a data e descrição
      const existingTime = new Date(existing.lastActivityAt).getTime()
      const newTime = new Date(params.activityDate).getTime()
      if (!isNaN(newTime) && (isNaN(existingTime) || newTime > existingTime)) {
        existing.lastActivityAt = params.activityDate
        existing.actionDescription = params.actionDescription
      }
      if (isRecent(existing.lastActivityAt)) {
        existing.online = true
      }
    }
  }

  // (a) Solicitante (Criador do chamado)
  if (ticket.requester_name || ticket.requester_email) {
    addOrUpdate({
      key: ticket.requester_email || ticket.requester_name,
      name: ticket.requester_name || 'Solicitante',
      email: ticket.requester_email,
      role: 'Solicitante',
      activityDate: ticket.created,
      actionDescription: 'Criou o chamado',
    })
  }

  // (b) Responsável / Atribuído
  const assigned = ticket.expand?.assigned_to
  if (assigned) {
    const assignedUser = typeof assigned === 'object' ? assigned : null
    const assignedName = assignedUser?.name || 'Responsável'
    const assignedEmail = assignedUser?.email
    const assignedId = assignedUser?.id || (typeof assigned === 'string' ? assigned : undefined)
    addOrUpdate({
      key: assignedId || assignedEmail || assignedName,
      userId: assignedId,
      name: assignedName,
      email: assignedEmail,
      avatarUrl: getAvatarUrl(assignedUser),
      role: 'Responsável',
      activityDate: ticket.sla_response_start || ticket.updated || ticket.created,
      actionDescription: 'Responsável pelo chamado',
    })
  }

  // (c) Interações (comentários, tramites, notas internas)
  for (const inter of interactions) {
    const author = inter.expand?.author || {}
    const authorName = author.name || 'Operador'
    const authorEmail = author.email
    const authorId = inter.author || author.id
    const isClient = author.role === 'cliente_solicitante' || author.role === 'cliente_gestor'
    const role: ParticipantRole = isClient ? 'Solicitante' : 'Operador'

    addOrUpdate({
      key: authorId || authorEmail || authorName,
      userId: authorId,
      name: authorName,
      email: authorEmail,
      avatarUrl: getAvatarUrl(author),
      role,
      activityDate: inter.created,
      actionDescription:
        inter.type === 'Interno' ? 'Adicionou nota interna' : 'Respondeu / comentou',
    })
  }

  // (d) Anexos de arquivos
  for (const att of loadedAttachments) {
    const uploader = att.expand?.uploaded_by || {}
    const uploaderName = uploader.name || (att.file_name ? 'Enviou anexo' : 'Operador')
    const uploaderEmail = uploader.email
    const uploaderId = att.uploaded_by || uploader.id
    if (uploaderId || uploaderEmail || uploaderName) {
      addOrUpdate({
        key: uploaderId || uploaderEmail || uploaderName,
        userId: uploaderId,
        name: uploaderName,
        email: uploaderEmail,
        avatarUrl: getAvatarUrl(uploader),
        role: 'Operador',
        activityDate: att.created,
        actionDescription: `Anexou arquivo (${att.file_name || 'arquivo'})`,
      })
    }
  }

  // (e) Visualizações (ticket_views)
  for (const v of loadedViews) {
    const viewer = v.expand?.user || {}
    const viewerName = viewer.name || 'Usuário'
    const viewerEmail = viewer.email
    const viewerId = v.user || viewer.id
    const viewDate = v.viewed_at || v.updated || v.created
    const role: ParticipantRole =
      viewer.role === 'cliente_solicitante' || viewer.role === 'cliente_gestor'
        ? 'Solicitante'
        : 'Visualizou'

    addOrUpdate({
      key: viewerId || viewerEmail || viewerName,
      userId: viewerId,
      name: viewerName,
      email: viewerEmail,
      avatarUrl: getAvatarUrl(viewer),
      role,
      activityDate: viewDate,
      actionDescription: 'Visualizou o chamado',
    })
  }

  // Ordena por data mais recente de atividade (decrescente)
  const list = Array.from(map.values())
  list.sort((a, b) => {
    const tA = new Date(a.lastActivityAt).getTime() || 0
    const tB = new Date(b.lastActivityAt).getTime() || 0
    return tB - tA
  })

  return list
}
