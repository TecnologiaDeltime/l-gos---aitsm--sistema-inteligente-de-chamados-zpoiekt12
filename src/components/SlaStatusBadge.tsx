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
    text: 'text-green-700',
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-900',
    Icon: CheckCircle2,
  },
  Atenção: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    Icon: Clock,
  },
  Risco: {
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900',
    Icon: AlertTriangle,
  },
  Crítico: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    Icon: AlertTriangle,
  },
  Violado: {
    dot: 'bg-red-700',
    text: 'text-red-800',
    bg: 'bg-red-100 dark:bg-red-950/60',
    border: 'border-red-300 dark:border-red-800',
    Icon: XCircle,
  },
  Pausado: {
    dot: 'bg-slate-400',
    text: 'text-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    Icon: PauseCircle,
  },
  'Não definido': {
    dot: 'bg-slate-300',
    text: 'text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800/30',
    border: 'border-slate-200 dark:border-slate-700',
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
