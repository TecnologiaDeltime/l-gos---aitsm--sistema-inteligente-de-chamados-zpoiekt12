import { useEffect, useState } from 'react'
import { BookOpen, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getRecommendedKbArticles,
  type RecommendedKbArticle,
} from '@/services/ticket-kb-recommended'

interface KbRecommendedBlockProps {
  title?: string
  description?: string
}

/**
 * Bloco "PROCEDIMENTOS RECOMENDADOS DA BASE DE CONHECIMENTO" — topo da Ficha
 * do Chamado. Usa o serviço de pareamento textual já commitado (v0.0.523),
 * que ranqueia artigos publicados contra título/descrição do chamado.
 */
export function KbRecommendedBlock({ title, description }: KbRecommendedBlockProps) {
  const [articles, setArticles] = useState<RecommendedKbArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getRecommendedKbArticles({ title, description }, 4)
      .then((list) => {
        if (alive) setArticles(list)
      })
      .catch(() => {
        if (alive) setArticles([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [title, description])

  return (
    <Card className="border-sky-500/25 bg-sky-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          Procedimentos Recomendados da Base de Conhecimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando procedimentos relacionados...
          </p>
        ) : articles.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum procedimento da base relacionado a este chamado.
          </p>
        ) : (
          <div className="space-y-2">
            {articles.map((a) => (
              <details
                key={a.id}
                className="group rounded-lg border border-sky-500/20 bg-background/70 p-2.5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
                  <span className="line-clamp-1">{a.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-open:hidden" />
                </summary>
                {(a.description || a.content) && (
                  <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    {a.description && <p className="mb-1">{a.description}</p>}
                    {a.content && (
                      <p className="max-h-56 overflow-y-auto whitespace-pre-wrap">{a.content}</p>
                    )}
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
