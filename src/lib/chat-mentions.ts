/**
 * Utilitários para as menções `@` no chat interno de operadores:
 * marcação no texto, serialização e links de navegação.
 *
 * Formato no conteúdo da mensagem: `@[rótulo](entityType:entityId)`
 * (sintaxe de link Markdown reutilizada; o rótulo é apenas cosmético —
 * os dados do item citado são sempre buscados frescos no render do cartão).
 */

export type MentionEntityType = 'ticket' | 'change' | 'problem'

export interface ParsedMention {
  /** ID do registro citado (PocketBase). */
  entityId: string
  entityType: MentionEntityType
}

/** Monta a marcação de menção embutida no texto da mensagem. */
export function buildMentionMarkup(
  entityType: MentionEntityType,
  entityId: string,
  label: string,
): string {
  return `@[${label}](chat-mention:${entityType}:${entityId})`
}

/** Regex das menções: @[rótulo](chat-mention:tipo:id) */
const MENTION_RE = /@\[([^\]]*)\]\(chat-mention:(ticket|change|problem):([a-z0-9]+)\)/g

/**
 * Divide o texto em trechos comuns e menções, preservando tudo que não é menção.
 */
export function splitMentionSegments(
  text: string,
): Array<{ type: 'text' | 'mention'; value: string; mention?: ParsedMention; label?: string }> {
  if (!text) return []
  const segments: Array<{
    type: 'text' | 'mention'
    value: string
    mention?: ParsedMention
    label?: string
  }> = []
  let last = 0
  for (const match of text.matchAll(MENTION_RE)) {
    const idx = match.index ?? 0
    if (idx > last) segments.push({ type: 'text', value: text.slice(last, idx) })
    segments.push({
      type: 'mention',
      value: match[0],
      label: match[1],
      mention: { entityType: match[2] as MentionEntityType, entityId: match[3] },
    })
    last = idx + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

/** Extrai todas as menções únicas presentes num conteúdo de mensagem. */
export function extractMentions(text?: string | null): ParsedMention[] {
  if (!text) return []
  const seen = new Set<string>()
  const out: ParsedMention[] = []
  for (const match of String(text).matchAll(MENTION_RE)) {
    const key = `${match[2]}:${match[3]}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ entityType: match[2] as MentionEntityType, entityId: match[3] })
  }
  return out
}

/** URL da rota de detalhe do item citado (rotas já existentes no App.tsx). */
export function mentionRoute(entityType: MentionEntityType, entityId: string): string {
  if (entityType === 'change') return `/changes/${entityId}`
  if (entityType === 'problem') return `/problems/${entityId}`
  return `/tickets/${entityId}`
}

/** Rótulo amigável do tipo citado, para o cartão e o seletor. */
export function mentionTypeLabel(entityType: MentionEntityType): string {
  if (entityType === 'change') return 'Mudança'
  if (entityType === 'problem') return 'Problema'
  return 'Chamado'
}
