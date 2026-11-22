import pb from '@/lib/pocketbase/client'
import type { KnowledgeArticle } from '@/services/knowledge'

/**
 * ticket-kb-recommended.ts — procedimentos recomendados da Base de Conhecimento
 * para a Ficha do Chamado (/tickets/:id).
 *
 * O bloco "PROCEDIMENTOS RECOMENDADOS DA BASE de CONHECIMENTO" aparece no topo
 * da ficha quando existem artigos relacionados ao chamado (pareamento textual
 * título/descrição × artigo), sobre a coleção knowledge_articles.
 */

export interface RecommendedKbArticle {
  id: string
  title: string
  description?: string
  content?: string
}

const STOP_WORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'por',
  'para',
  'com',
  'sem',
  'que',
  'e',
  'ou',
  'ao',
  'aos',
  'à',
  'às',
  'não',
  'nao',
  'the',
  'of',
  'erro',
  'falha',
  'problema',
  'chamado',
  'sistema',
  'está',
  'esta',
  'como',
  'quando',
  'onde',
  'muito',
  'mais',
  'ser',
  'tem',
  'ter',
  'pelo',
  'pela',
  'seus',
  'sua',
  'abre',
  'aparece',
  'enviar',
  'envia',
  'fazer',
  'conseguir',
  'todo',
  'toda',
  'estão',
  'estao',
])

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

/**
 * Busca artigos publicados da base e ranqueia contra o chamado.
 * Retorna no máximo `limit` artigos com pelo menos um termo em comum.
 */
export async function getRecommendedKbArticles(
  ticket: { title?: string; description?: string },
  limit = 4,
): Promise<RecommendedKbArticle[]> {
  const title = ticket.title || ''
  const description = ticket.description || ''
  if (!title && !description) return []

  const termSet = new Set<string>([...tokenize(title), ...tokenize(description)])
  if (termSet.size === 0) return []

  let articles: KnowledgeArticle[] = []
  try {
    articles = await pb.collection('knowledge_articles').getFullList<KnowledgeArticle>({
      filter: 'status = "published"',
      sort: '-updated',
    })
  } catch (err) {
    console.warn('[kb-recommended] falha ao carregar artigos da base:', err)
    return []
  }

  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const scored = articles.map((a) => {
    const hay = norm(`${a.title} ${a.summary || ''} ${a.content || ''}`)
    const aTitle = norm(a.title)
    let score = 0
    termSet.forEach((t) => {
      if (hay.includes(t)) score += 1
      if (aTitle.includes(t)) score += 0.5
    })
    return { article: a, score }
  })

  return scored
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      id: s.article.id,
      title: s.article.title || 'Artigo',
      description: s.article.summary || '',
      content: s.article.content || '',
    }))
}

/** Termos extraídos do chamado (útil para depuração/telemetria). */
export function extractKbTokens(ticket: { title?: string; description?: string }): string[] {
  return Array.from(
    new Set([...tokenize(ticket.title || ''), ...tokenize(ticket.description || '')]),
  )
}
