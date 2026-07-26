import { Clock, PauseCircle, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { formatRemainingTime, formatDeadline } from '@/lib/sla-status'

interface SlaDetailBlockProps {
  type: 'response' | 'solution'
  status: string
  deadline?: string
  completedAt?: string
}

const STATUS_CONFIG: Record<
  string,
  { percent: number; barColor: string; text: string; Icon: typeof Clock }
> = {
  'Dentro do Prazo': {
    percent: 35,
    barColor: 'bg-emerald-500',
    text: 'text-green-600',
    Icon: CheckCircle2,
  },
  Atenção: {
    percent: 65,
    barColor: 'bg-amber-500',
    text: 'text-amber-600',
    Icon: Clock,
  },
  Risco: {
    percent: 82,
    barColor: 'bg-orange-500',
    text: 'text-orange-600',
    Icon: AlertTriangle,
  },
  Crítico: {
    percent: 95,
    barColor: 'bg-red-500 animate-pulse',
    text: 'text-red-600',
    Icon: AlertTriangle,
  },
  Violado: {
    percent: 100,
    barColor: 'bg-red-700',
    text: 'text-red-800',
    Icon: XCircle,
  },
  Pausado: {
    percent: 0,
    barColor: 'bg-amber-400 opacity-60',
    text: 'text-slate-500',
    Icon: PauseCircle,
  },
  'Não definido': {
    percent: 0,
    barColor: 'bg-slate-300',
    text: 'text-slate-400',
    Icon: MinusCircle,
  },
}

export function SlaDetailBlock({ type, status, deadline, completedAt }: SlaDetailBlockProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Não definido']
  const { Icon } = config
  const label = type === 'response' ? 'SLA Resposta' : 'SLA Solução'
  const barWidth = status === 'Pausado' || status === 'Não definido' ? 100 : config.percent

  return (
    <div className="rounded-lg border p-3 space-y-2 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${config.text}`}>
          <Icon className="h-3.5 w-3.5" />
          {status}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Prazo: {formatDeadline(deadline)}</span>
        {status !== 'Pausado' && status !== 'Não definido' && (
          <>
            {completedAt ? (
              <span className="text-slate-400">Concluído: {formatDeadline(completedAt)}</span>
            ) : (
              <span className={config.text}>{formatRemainingTime(deadline)}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
