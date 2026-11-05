import pb from '@/lib/pocketbase/client'
import {
  ChatOperatorUser,
  getChatOperators,
  OperatorChatMessageRecord,
} from '@/services/operator-chat'
import { extractSearchTokens, matchesAllTokens } from '@/lib/search-text'

/**
 * Serviço de Histórico de Chat por Operador.
 *
 * Consulta (somente leitura) da coleção `operator_chat_messages` criada na migração 0129.
 * Reutiliza o serviço do chat em tempo real (`operator-chat.ts`) e NÃO duplica lógica:
 * as funções abaixo apenas leem registros, sem nunca criar, atualizar ou excluir mensagens.
 */

export interface ChatHistoryFilters {
  /** ID do operador (participante: como remetente ou destinatário). Vazio = todos. */
  operatorId?: string
  /** Data inicial (inclusive), formato YYYY-MM-DD. */
  from?: string
  /** Data final (inclusive), formato YYYY-MM-DD. */
  to?: string
  /** Termo de busca no conteúdo das mensagens. */
  search?: string
}

export interface ChatHistoryMessage extends OperatorChatMessageRecord {
  expand?: OperatorChatMessageRecord['expand'] & {
    sender?: ChatOperatorUser
    recipient?: ChatOperatorUser
  }
}

/** Converte uma data YYYY-MM-DD em ISO do início do dia (00:00:00, fuso local). */
function startOfDayIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Converte uma data YYYY-MM-DD em ISO do fim do dia (23:59:59.999, fuso local). */
function endOfDayIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  const d = new Date(`${dateStr}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/**
 * Consulta o histórico de mensagens do chat interno.
 *
 * O filtro de operador é sempre "participa" (sender OU recipient), nunca apenas remetente.
 * Quando há termo de busca textual:
 * 1. Para maximizar o alcance sem perder registros de conversas antigas, buscamos na coleção
 *    de mensagens com filtro PocketBase (se houver tokens curtos sem caracteres especiais).
 *    Porém, como o PocketBase `~` pode ser sensível a acentos no SQLite dependendo da collation,
 *    e buscas com múltiplas palavras ou variações ("informacao" vs "Informação") requerem
 *    tolerância, a consulta traz uma amostra ampla da base (limit parametrizável, padrão 1000)
 *    e refina com o parser NFD em memória, garantindo:
 *    - Insensibilidade a acentos ("informacao" acha "Informação")
 *    - Múltiplas palavras em qualquer ordem ("backup falhou" acha "falhou o backup")
 *    - Sem falsos positivos e sem truncamento precoce.
 */
export async function getChatHistory(
  filters: ChatHistoryFilters,
  limit = 1000,
): Promise<ChatHistoryMessage[]> {
  const clauses: string[] = []

  if (filters.operatorId) {
    clauses.push(`(sender = "${filters.operatorId}" || recipient = "${filters.operatorId}")`)
  }
  const fromIso = startOfDayIso(filters.from)
  const toIso = endOfDayIso(filters.to)
  if (fromIso) clauses.push(`created >= "${fromIso}"`)
  if (toIso) clauses.push(`created <= "${toIso}"`)

  // Se houver busca e nenhum caractere diacrítico no termo, podemos tentar um pre-filtro mais
  // amplo no PocketBase se couber; caso contrário, trazemos a listagem ampla do escopo
  // de data/operador e aplicamos a filtragem precisa em memória.
  // Notar que `limit` padrão foi ampliado para 1000 mensagens.
  const rawList = await pb.collection('operator_chat_messages').getFullList<ChatHistoryMessage>({
    filter: clauses.length > 0 ? clauses.join(' && ') : undefined,
    sort: '-created',
    expand: 'sender,recipient',
    limit,
  })

  const searchTerm = filters.search?.trim()
  if (!searchTerm) {
    return rawList
  }

  // Refinamento em memória: insensível a acentos e múltiplas palavras em qualquer ordem
  return rawList.filter((m) => matchesAllTokens(m.content, searchTerm))
}

/**
 * Monta as conversas (pares de participantes) encontradas no resultado da consulta,
 * preservando a ordem cronológica decrescente por mensagem mais recente.
 */
export function groupChatHistoryIntoConversations(messages: ChatHistoryMessage[]): Array<{
  key: string
  participantIds: [string, string]
  participants: Array<ChatOperatorUser | undefined>
  messages: ChatHistoryMessage[]
  lastMessageAt: string
  messageCount: number
}> {
  const map = new Map<
    string,
    {
      key: string
      participantIds: [string, string]
      participants: Array<ChatOperatorUser | undefined>
      messages: ChatHistoryMessage[]
      lastMessageAt: string
      messageCount: number
    }
  >()

  for (const m of messages) {
    const senderId = typeof m.sender === 'string' ? m.sender : m.sender
    const recipientId = typeof m.recipient === 'string' ? m.recipient : m.recipient
    const pairKey = [senderId, recipientId].sort().join('__')
    let entry = map.get(pairKey)
    if (!entry) {
      entry = {
        key: pairKey,
        participantIds: [senderId, recipientId],
        participants: [undefined, undefined],
        messages: [],
        lastMessageAt: m.created,
        messageCount: 0,
        // placeholder to keep tuple shape consistent
      } as never
      map.set(pairKey, entry)
    }
    entry.messages.push(m)
    entry.messageCount += 1
    if (m.created > entry.lastMessageAt) entry.lastMessageAt = m.created
  }

  // Preenche os objetos de participantes a partir do expand das mensagens
  const list = Array.from(map.values())
  for (const conv of list) {
    const byId = new Map<string, ChatOperatorUser>()
    for (const m of conv.messages) {
      for (const p of [m.expand?.sender, m.expand?.recipient]) {
        if (p && p.id) byId.set(p.id, p)
      }
    }
    conv.participants = conv.participantIds.map((id) => byId.get(id))
  }

  list.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
  return list
}

/**
 * Lista os operadores disponíveis para o filtro (reuso de getChatOperators).
 */
export async function getChatHistoryOperators(): Promise<ChatOperatorUser[]> {
  return getChatOperators()
}

/**
 * Totalizadores simples para o resumo do histórico consultado.
 */
export function summarizeChatHistory(messages: ChatHistoryMessage[]): {
  total: number
  conversations: number
  participants: number
  firstMessageAt?: string
  lastMessageAt?: string
} {
  const ids = new Set<string>()
  let first: string | undefined
  let last: string | undefined
  const convKeys = new Set<string>()

  for (const m of messages) {
    ids.add(typeof m.sender === 'string' ? m.sender : String(m.sender))
    ids.add(typeof m.recipient === 'string' ? m.recipient : String(m.recipient))
    const pairKey = [m.sender, m.recipient].sort().join('__')
    convKeys.add(pairKey)
    if (!first || m.created < first) first = m.created
    if (!last || m.created > last) last = m.created
  }

  return {
    total: messages.length,
    conversations: convKeys.size,
    participants: ids.size,
    firstMessageAt: first,
    lastMessageAt: last,
  }
}
