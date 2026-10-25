import { cn } from '@/lib/utils'
import { formatStaleDuration, getStaleLevel, type StaleLevel } from '@/lib/stale-time'

const LEVEL_CLASSES: Record<StaleLevel, string> = {
  green:
    'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
  yellow:
    'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  orange:
    'bg-orange-500/10 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40 shadow-xs shadow-orange-500/10',
  red: 'bg-red-500/15 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/50 shadow-xs shadow-red-500/20 font-bold',
}

const LEVEL_DOT: Record<StaleLevel, string> = {
  green: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  yellow: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
  orange: 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse',
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
