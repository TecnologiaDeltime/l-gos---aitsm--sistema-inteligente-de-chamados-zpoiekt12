/**
 * Utilitários de busca por texto com suporte a:
 * 1. Insensibilidade a acentos (normalização Unicode NFD) e maiúsculas/minúsculas.
 * 2. Múltiplas palavras em qualquer ordem (AND lógico entre palavras).
 * 3. Segmentação de texto para destaque visual (highlight) preservando o texto original.
 */

/**
 * Remove acentos/diacríticos e converte para minúsculas.
 * Ex.: "Informação" -> "informacao", "não" -> "nao".
 */
export function normalizeSearchText(text?: string | null): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Extrai os tokens de busca (palavras individuais normalizadas).
 * Remove espaços extras e palavras vazias.
 */
export function extractSearchTokens(query?: string | null): string[] {
  if (!query) return []
  const normalized = normalizeSearchText(query)
  if (!normalized) return []
  return normalized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}

/**
 * Verifica se todas as palavras do termo de busca estão presentes no texto alvo,
 * independentemente da ordem e com insensibilidade a acentos e maiúsculas.
 * Se o termo estiver vazio, retorna true (sem filtro).
 */
export function matchesAllTokens(target?: string | null, query?: string | null): boolean {
  const tokens = extractSearchTokens(query)
  if (tokens.length === 0) return true
  const normTarget = normalizeSearchText(target)
  if (!normTarget) return false
  return tokens.every((token) => normTarget.includes(token))
}

/**
 * Segmento de texto para renderização de highlight.
 */
export interface HighlightSegment {
  text: string
  isMatch: boolean
}

/**
 * Divide o texto original em segmentos de match e não-match para exibição visual
 * com destaque (highlight), respeitando acentos e caixa do texto original.
 *
 * Se houver tokens múltiplos, destaca cada ocorrência individual das palavras buscadas.
 */
export function splitTextWithHighlight(text: string, query?: string | null): HighlightSegment[] {
  if (!text) return []
  const tokens = extractSearchTokens(query)
  if (tokens.length === 0) {
    return [{ text, isMatch: false }]
  }

  // Mapeia cada caractere do texto original para sua versão normalizada
  // Atenção: NFD decompõe caracteres acentuados em mais de 1 code point,
  // por isso mapeamos índices com cuidado.
  // Abordagem robusta:
  // Construímos uma string normalizada e um array de mapeamento normIndex -> origIndex.
  const normIndices: number[] = []
  let normText = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const decomposed = ch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    for (let k = 0; k < decomposed.length; k++) {
      normIndices.push(i)
      normText += decomposed[k]
    }
  }

  // Encontra todos os intervalos [origStart, origEnd] que casam com qualquer token
  const intervals: Array<{ start: number; end: number }> = []

  for (const token of tokens) {
    if (!token) continue
    let searchStart = 0
    while (searchStart < normText.length) {
      const foundIdx = normText.indexOf(token, searchStart)
      if (foundIdx === -1) break
      const normStart = foundIdx
      const normEnd = foundIdx + token.length - 1

      const origStart = normIndices[normStart]
      // origEnd precisa cobrir até o fim do caractere original (inclusive)
      const origEnd = (normIndices[normEnd] ?? origStart) + 1

      intervals.push({ start: origStart, end: Math.min(origEnd, text.length) })
      searchStart = foundIdx + 1
    }
  }

  if (intervals.length === 0) {
    return [{ text, isMatch: false }]
  }

  // Ordena os intervalos e mescla sobreposições
  intervals.sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  let current = intervals[0]

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i]
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end)
    } else {
      merged.push(current)
      current = next
    }
  }
  merged.push(current)

  // Monta os segmentos preservando o texto original exato
  const segments: HighlightSegment[] = []
  let cursor = 0

  for (const iv of merged) {
    if (iv.start > cursor) {
      segments.push({
        text: text.slice(cursor, iv.start),
        isMatch: false,
      })
    }
    if (iv.end > iv.start) {
      segments.push({
        text: text.slice(iv.start, iv.end),
        isMatch: true,
      })
    }
    cursor = Math.max(cursor, iv.end)
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      isMatch: false,
    })
  }

  return segments
}
