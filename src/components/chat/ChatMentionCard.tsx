/**
 * Cartão clicável da menção `@` renderizado na mensagem do chat interno.
 * Busca os dados atuais do item citado (chamado/mudança/problema) no momento
 * do render — o conteúdo não é duplicado na mensagem, apenas o id.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fetchMentionTarget, type MentionCandidate } from '@/lib/chat-mention-data'
import { mentionRoute, mentionTypeLabel, type MentionEntityType } from '@/lib/chat-mentions'
import { MessageSquare, GitBranch, Bug } from 'lucide-react'

const ENTITY_ICON: Record<MentionEntityType, typeof MessageSquare> = {
  ticket: MessageSquare,
  change: GitBranch,
  problem: Bug,
}

export function ChatMentionCard({
  entityType,
  entityId,
  mine,
}: {
  entityType: MentionEntityType
  entityId: string
  mine: boolean
}) {
  const navigate = useNavigate()
  const [target, setTarget] = useState<MentionCandidate | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMentionTarget(entityType, entityId).then((t) => {
      if (!alive) return
      if (t) setTarget(t)
      else setMissing(true)
    })
    return () => {
      alive = false
    }
  }, [entityType, entityId])

  const Icon = ENTITY_ICON[entityType]
  const label = mentionTypeLabel(entityType)

  return (
    <button
      type="button"
      onClick={() => {
        if (target) navigate(mentionRoute(entityType, target.id))
      }}
      className={cn(
        'mt-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
        'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20',
        mine ? 'text-foreground' : 'text-foreground',
      )}
      title={target ? `${label} ${target.number}` : label}
      disabled={!target}
    >
      <Icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
          {label}
        </span>
        <span className="block truncate text-xs font-semibold">
          {target
            ? `${target.number}${target.title ? ` — ${target.title}` : ''}`
            : missing
              ? 'Item não encontrado'
              : 'Carregando…'}
        </span>
      </span>
      {target?.status ? (
        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
          {target.status}
        </Badge>
      ) : null}
      {target?.priority ? (
        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
          {target.priority}
        </Badge>
      ) : null}
    </button>
  )
}
