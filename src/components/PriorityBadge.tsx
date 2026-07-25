import { Badge } from '@/components/ui/badge'

interface PriorityBadgeProps {
  priority: string
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    P1: {
      label: 'P1 - Crítico',
      className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300',
    },
    P2: {
      label: 'P2 - Alto',
      className:
        'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
    },
    P3: {
      label: 'P3 - Médio',
      className:
        'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300',
    },
    P4: {
      label: 'P4 - Baixo',
      className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    },
    P5: {
      label: 'P5 - Mínimo',
      className:
        'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300',
    },
  }

  const p = config[priority] || {
    label: priority || 'P3',
    className: 'bg-slate-100 text-slate-800',
  }

  return (
    <Badge variant="outline" className={`font-semibold ${p.className}`}>
      {p.label}
    </Badge>
  )
}
