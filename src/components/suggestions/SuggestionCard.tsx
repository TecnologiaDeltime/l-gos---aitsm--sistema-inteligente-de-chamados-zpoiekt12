// Cartão de uma sugestão — modo leitura (feed) e modo gestão (admin).
import {
  Lightbulb,
  CalendarClock,
  MessageSquareReply,
  XCircle,
  CheckCircle2,
  Rocket,
  Clock,
  ThumbsUp,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  SUGGESTION_CATEGORY_LABELS,
  SUGGESTION_STATUS_LABELS,
  Suggestion,
  SuggestionStatus,
} from '@/services/suggestions'
import { formatDateTime } from '@/lib/date-format'

const STATUS_STYLES: Record<SuggestionStatus, string> = {
  pendente: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  aceita: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  negada: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  implantada: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
}

const STATUS_ICONS: Record<SuggestionStatus, typeof Clock> = {
  pendente: Clock,
  aceita: CheckCircle2,
  negada: XCircle,
  implantada: Rocket,
}

interface Props {
  suggestion: Suggestion
  currentUserId?: string
  manageMode?: boolean
  onManage?: (s: Suggestion) => void
  voteCount: number
  hasVoted: boolean
  voteBusy: boolean
  onToggleVote: (s: Suggestion) => void
}

export function SuggestionCardView({
  suggestion,
  currentUserId,
  manageMode,
  onManage,
  voteCount,
  hasVoted,
  voteBusy,
  onToggleVote,
}: Props) {
  const StatusIcon = STATUS_ICONS[suggestion.status] ?? Clock
  const isMine = currentUserId && suggestion.author === currentUserId
  const authorName = suggestion.expand?.author?.name || 'Operador'
  const windowInfo = suggestion.expand?.change_window
  const categoryLabel = suggestion.category
    ? (SUGGESTION_CATEGORY_LABELS[suggestion.category] ?? suggestion.category)
    : null

  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="truncate text-sm font-semibold">{suggestion.title}</h3>
              {categoryLabel && (
                <Badge variant="outline" className="text-[10px]">
                  {categoryLabel}
                </Badge>
              )}
              {isMine && (
                <Badge variant="secondary" className="text-[10px]">
                  Minha sugestão
                </Badge>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {suggestion.description}
            </p>
          </div>
          <Badge variant="outline" className={`shrink-0 gap-1 ${STATUS_STYLES[suggestion.status]}`}>
            <StatusIcon className="h-3 w-3" />
            {SUGGESTION_STATUS_LABELS[suggestion.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Por {authorName}</span>
          {suggestion.created && <span>{formatDateTime(suggestion.created)}</span>}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={
              hasVoted
                ? `Remover seu voto — ${voteCount} ${voteCount === 1 ? 'voto' : 'votos'}`
                : `Apoiar esta sugestão — ${voteCount} ${voteCount === 1 ? 'voto' : 'votos'}`
            }
            aria-pressed={hasVoted}
            title={hasVoted ? 'Remover seu voto' : 'Apoiar esta sugestão'}
            disabled={voteBusy}
            onClick={() => onToggleVote(suggestion)}
            className={`h-7 gap-1.5 px-2 text-xs ${
              hasVoted
                ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {voteBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className={`h-3.5 w-3.5 ${hasVoted ? 'fill-current' : ''}`} />
            )}
            <span className="font-medium tabular-nums">{voteCount}</span>
            <span className="hidden sm:inline">{hasVoted ? 'Apoiada por você' : 'Apoios'}</span>
          </Button>
        </div>

        {suggestion.status === 'negada' && suggestion.reject_reason && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5" /> Motivo da negativa
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {suggestion.reject_reason}
            </p>
          </div>
        )}

        {suggestion.status === 'aceita' && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CalendarClock className="h-3.5 w-3.5" /> Janela de implantação
            </div>
            {suggestion.implantation_date && (
              <p className="mt-1 text-xs text-muted-foreground">
                Previsão: {formatDateTime(suggestion.implantation_date)}
              </p>
            )}
            {windowInfo && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mudança programada:{' '}
                <span className="font-medium text-foreground">
                  {windowInfo.number ? `${windowInfo.number} — ` : ''}
                  {windowInfo.title || 'Janela agendada'}
                </span>
              </p>
            )}
            {!suggestion.implantation_date && !windowInfo && (
              <p className="mt-1 text-xs text-muted-foreground">
                Janela de implantação ainda não definida.
              </p>
            )}
          </div>
        )}

        {suggestion.admin_reply && (
          <div className="rounded-md border bg-muted/40 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <MessageSquareReply className="h-3.5 w-3.5 text-primary" /> Resposta da gestão
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {suggestion.admin_reply}
            </p>
          </div>
        )}

        {manageMode && onManage && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => onManage(suggestion)}>
              Gerir sugestão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
