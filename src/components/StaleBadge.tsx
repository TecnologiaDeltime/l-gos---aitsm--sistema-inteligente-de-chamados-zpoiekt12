import { cn } from '@/lib/utils'
import { formatStaleDuration, getStaleLevel, type StaleLevel } from '@/lib/stale-time'

const LEVEL_CLASSES: Record<StaleLevel, string> = {
  green:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30',
  yellow:
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30',
  orange:
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
  red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
}

const LEVEL_DOT: Record<StaleLevel, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

interface StaleBadgeProps {
  /** Segundos decorridos desde a última atividade, ou `null` quando não aplicável (fechado). */
  elapsedSeconds: number | null
  className?: string
}

/**
 * Indicador visual de "Tempo sem Atualização".
 * Mostra "—" quando não aplicável (chamados resolvidos/encerrados/cancelados).
 * Caso contrário, exibe o tempo formatado com cor semântica.
 */
export function StaleBadge({ elapsedSeconds, className }: StaleBadgeProps) {
  if (elapsedSeconds == null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-slate-400 border-slate-200 bg-slate-50 dark:bg-slate-500/10 dark:border-slate-500/30',
          className,
        )}
        title="Não aplicável — chamado fechado"
      >
        —
      </span>
    )
  }

  const level = getStaleLevel(elapsedSeconds)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        LEVEL_CLASSES[level],
        className,
      )}
      title={`Sem atualização há ${formatStaleDuration(elapsedSeconds)}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', LEVEL_DOT[level])} />
      {formatStaleDuration(elapsedSeconds)}
    </span>
  )
}
