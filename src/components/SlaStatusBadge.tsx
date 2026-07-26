import { Clock, PauseCircle, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatRemainingTime, formatDeadline } from '@/lib/sla-status'

interface SlaStatusBadgeProps {
  type: 'response' | 'solution'
  status: string
  deadline?: string
  completedAt?: string
}

const STATUS_CONFIG: Record<
  string,
  { dot: string; text: string; bg: string; border: string; Icon: typeof Clock }
> = {
  'Dentro do Prazo': {
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-500/15',
    border: 'border-green-200 dark:border-green-500/30',
    Icon: CheckCircle2,
  },
  Atenção: {
    dot: 'bg-slate-500',
    text: 'text-slate-700 dark:text-amber-400',
    bg: 'bg-slate-100 dark:bg-amber-500/15',
    border: 'border-slate-300 dark:border-amber-500/30',
    Icon: Clock,
  },
  Risco: {
    dot: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-500/15',
    border: 'border-orange-200 dark:border-orange-500/30',
    Icon: AlertTriangle,
  },
  Crítico: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-500/15',
    border: 'border-red-200 dark:border-red-500/30',
    Icon: AlertTriangle,
  },
  Violado: {
    dot: 'bg-red-600',
    text: 'text-red-700 dark:text-red-500',
    bg: 'bg-red-100 dark:bg-red-600/20',
    border: 'border-red-200 dark:border-red-600/40',
    Icon: XCircle,
  },
  Pausado: {
    dot: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-500/10',
    border: 'border-slate-200 dark:border-slate-500/30',
    Icon: PauseCircle,
  },
  'Não definido': {
    dot: 'bg-slate-600',
    text: 'text-slate-500 dark:text-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-500/5',
    border: 'border-slate-200 dark:border-slate-600/30',
    Icon: MinusCircle,
  },
}

export function SlaStatusBadge({ type, status, deadline, completedAt }: SlaStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Não definido']
  const { Icon } = config
  const label = type === 'response' ? 'SLA Resposta' : 'SLA Solução'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${config.bg} ${config.border}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <Icon className={`h-3 w-3 ${config.text}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold">{label}</p>
          <p>Status: {status}</p>
          {deadline && <p>Prazo: {formatDeadline(deadline)}</p>}
          {completedAt && <p>Concluído: {formatDeadline(completedAt)}</p>}
          {!completedAt && status !== 'Pausado' && status !== 'Não definido' && (
            <p>{formatRemainingTime(deadline)}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
