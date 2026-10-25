import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
}

const STATUS_CONFIG: Record<string, { dot: string; className: string }> = {
  Novo: {
    dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse',
    className:
      'bg-cyan-500/10 text-cyan-700 border-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/40 shadow-xs shadow-cyan-500/10',
  },
  'Em Triagem': {
    dot: 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]',
    className:
      'bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40',
  },
  'Aguardando Atribuição': {
    dot: 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]',
    className:
      'bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40',
  },
  Atribuído: {
    dot: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]',
    className:
      'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',
  },
  'Em aberto': {
    dot: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]',
    className:
      'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',
  },
  'Em Atendimento': {
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    className:
      'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40 font-medium',
  },
  'Aguardando Cliente': {
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    className:
      'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  },
  'Aguardando Aprovação': {
    dot: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]',
    className:
      'bg-orange-500/10 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40',
  },
  Resolvido: {
    dot: 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]',
    className:
      'bg-green-500/10 text-green-700 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40',
  },
  Encerrado: {
    dot: 'bg-slate-400',
    className:
      'bg-slate-500/10 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40',
  },
  Cancelado: {
    dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]',
    className:
      'bg-red-500/10 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
  },
  Reaberto: {
    dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)] animate-pulse',
    className:
      'bg-rose-500/10 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40 font-medium',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const displayLabel = status === 'Atribuído' ? 'Em aberto' : status
  const config = STATUS_CONFIG[status] ||
    STATUS_CONFIG[displayLabel] || {
      dot: 'bg-slate-500',
      className:
        'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
    }

  return (
    <Badge variant="outline" className={`itsm-badge ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {displayLabel}
    </Badge>
  )
}
