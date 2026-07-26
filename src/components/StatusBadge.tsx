import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
}

const STATUS_CONFIG: Record<string, { dot: string; className: string }> = {
  Novo: {
    dot: 'bg-blue-400',
    className:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  },
  'Em Triagem': {
    dot: 'bg-purple-400',
    className:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
  },
  'Aguardando Atribuição': {
    dot: 'bg-indigo-400',
    className:
      'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30',
  },
  Atribuído: {
    dot: 'bg-sky-400',
    className:
      'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  },
  'Em Atendimento': {
    dot: 'bg-emerald-400',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  'Aguardando Cliente': {
    dot: 'bg-amber-400',
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  'Aguardando Aprovação': {
    dot: 'bg-orange-400',
    className:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
  },
  Resolvido: {
    dot: 'bg-green-500',
    className:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30',
  },
  Encerrado: {
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  },
  Cancelado: {
    dot: 'bg-red-500',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  },
  Reaberto: {
    dot: 'bg-rose-400',
    className:
      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  }

  return (
    <Badge variant="outline" className={`itsm-badge ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </Badge>
  )
}
