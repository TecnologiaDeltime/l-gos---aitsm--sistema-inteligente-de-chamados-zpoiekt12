/**
 * Seletor de menção `@` do chat interno: busca chamados, mudanças e problemas
 * conforme o texto digitado após o @ e permite inserir a menção na mensagem.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare, GitBranch, Bug, Search } from 'lucide-react'
import {
  searchMentionCandidates,
  mentionCandidateTitle,
  type MentionCandidate,
} from '@/lib/chat-mention-data'
import { mentionTypeLabel } from '@/lib/chat-mentions'
import { cn } from '@/lib/utils'

const ENTITY_ICON = {
  ticket: MessageSquare,
  change: GitBranch,
  problem: Bug,
} as const

export function MentionSelector({
  query,
  onSelect,
  onClose,
}: {
  /** Texto digitado depois do @ (pode ser vazio). */
  query: string
  onSelect: (candidate: MentionCandidate, label: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<MentionCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      searchMentionCandidates(query)
        .then((res) => {
          if (!alive) return
          setItems(res)
          setActive(0)
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  const choose = (c: MentionCandidate) => {
    onSelect(c, `${mentionTypeLabel(c.entityType)} ${c.number}`)
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-lg border bg-popover shadow-lg"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        {loading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Buscando chamados, mudanças e problemas…
          </span>
        ) : items.length === 0 ? (
          <span>
            Nenhum chamado, mudança ou problema encontrado{query ? ` para “${query}”` : ''}.
          </span>
        ) : (
          <span>
            Mencione um chamado, mudança ou problema
            {query ? ` — filtro: “${query}”` : ' mais recentes'}
          </span>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((c, i) => {
          const Icon = ENTITY_ICON[c.entityType]
          return (
            <button
              key={`${c.entityType}-${c.id}`}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                i === active && 'bg-accent',
              )}
              onClick={() => choose(c)}
              onMouseEnter={() => setActive(i)}
            >
              <Icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{mentionCandidateTitle(c)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {mentionTypeLabel(c.entityType)}
                  {c.status ? ` · ${c.status}` : ''}
                  {c.priority ? ` · ${c.priority}` : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
