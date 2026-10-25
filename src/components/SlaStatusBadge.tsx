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
    dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-300 dark:border-emerald-500/40',
    Icon: CheckCircle2,
  },
  Atenção: {
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-300 dark:border-amber-500/40',
    Icon: Clock,
  },
  Risco: {
    dot: 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]',
    text: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    border: 'border-orange-300 dark:border-orange-500/40 shadow-xs shadow-orange-500/10',
    Icon: AlertTriangle,
  },
  Crítico: {
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse',
    text: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-500/15 dark:bg-red-500/20',
    border: 'border-red-300 dark:border-red-500/50 shadow-xs shadow-red-500/20',
    Icon: AlertTriangle,
  },
  Violado: {
    dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse',
    text: 'text-rose-700 dark:text-rose-300 font-bold',
    bg: 'bg-rose-500/15 dark:bg-rose-500/20',
    border: 'border-rose-300 dark:border-rose-500/50 shadow-xs shadow-rose-500/20',
    Icon: XCircle,
  },
  Pausado: {
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 dark:bg-slate-500/10',
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
