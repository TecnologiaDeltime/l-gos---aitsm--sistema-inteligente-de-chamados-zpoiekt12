import { Badge } from '@/components/ui/badge'

interface PriorityBadgeProps {
  priority: string
}

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; className: string }> = {
  Crítica: {
    label: 'Crítica',
    dot: 'bg-red-600',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  },
  Alta: {
    label: 'Alta',
    dot: 'bg-orange-500',
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  },
  Média: {
    label: 'Média',
    dot: 'bg-amber-400',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  Baixa: {
    label: 'Baixa',
    dot: 'bg-blue-500',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  },
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority || 'Média',
    dot: 'bg-slate-400',
    className:
      'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  }

  return (
    <Badge variant="outline" className={`itsm-badge ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  )
}
