import { Badge } from '@/components/ui/badge'

interface PriorityBadgeProps {
  priority: string
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    Crítica: {
      label: 'Crítica',
      className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300',
    },
    Alta: {
      label: 'Alta',
      className:
        'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
    },
    Média: {
      label: 'Média',
      className:
        'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300',
    },
    Baixa: {
      label: 'Baixa',
      className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    },
  }

  const p = config[priority] || {
    label: priority || 'Média',
    className: 'bg-slate-100 text-slate-800',
  }

  return (
    <Badge variant="outline" className={`font-semibold ${p.className}`}>
      {p.label}
    </Badge>
  )
}
