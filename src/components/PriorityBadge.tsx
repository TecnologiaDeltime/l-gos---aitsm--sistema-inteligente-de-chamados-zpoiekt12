import { Badge } from '@/components/ui/badge'

interface PriorityBadgeProps {
  priority: string
}

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; className: string }> = {
  Crítica: {
    label: 'Crítica',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse',
    className:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40 shadow-xs shadow-red-500/10 font-bold',
  },
  Alta: {
    label: 'Alta',
    dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]',
    className:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 shadow-xs shadow-amber-500/10 font-semibold',
  },
  Média: {
    label: 'Média',
    dot: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]',
    className:
      'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40 font-medium',
  },
  Baixa: {
    label: 'Baixa',
    dot: 'bg-slate-400',
    className:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
  },
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority || 'Média',
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
  }

  return (
    <Badge variant="outline" className={`itsm-badge ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  )
}
