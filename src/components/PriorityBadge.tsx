import { Badge } from '@/components/ui/badge'

interface PriorityBadgeProps {
  priority: string
}

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; className: string }> = {
  Crítica: {
    label: 'Crítica',
    dot: 'bg-red-500',
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  },
  Alta: {
    label: 'Alta',
    dot: 'bg-indigo-500',
    className:
      'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  Média: {
    label: 'Média',
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
  },
  Baixa: {
    label: 'Baixa',
    dot: 'bg-slate-400',
    className:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
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
