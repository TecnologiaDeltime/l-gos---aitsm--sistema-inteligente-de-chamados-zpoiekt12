import { Clock, PauseCircle, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { formatRemainingTime, formatDeadline } from '@/lib/sla-status'

interface SlaDetailBlockProps {
  type: 'response' | 'solution'
  status: string
  deadline?: string
  completedAt?: string
  startedAt?: string
  createdAt?: string
  totalPauseMinutes?: number
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
    barColor: 'bg-slate-500 dark:bg-amber-500',
    text: 'text-slate-600 dark:text-amber-600',
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
    barColor: 'bg-slate-400 dark:bg-amber-400 opacity-60',
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

export function SlaDetailBlock({
  type,
  status,
  deadline,
  completedAt,
  startedAt,
  createdAt,
  totalPauseMinutes = 0,
}: SlaDetailBlockProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Não definido']
  const { Icon } = config
  const label = type === 'response' ? 'SLA Resposta' : 'SLA Solução'

  // Cálculo de percentual em tempo real
  let computedPercent = config.percent
  if (deadline && createdAt && status !== 'Pausado' && status !== 'Não definido') {
    const startMs = new Date(createdAt).getTime()
    const deadlineMs = new Date(deadline).getTime()
    const endMs = completedAt ? new Date(completedAt).getTime() : Date.now()
    const totalMs = deadlineMs - startMs
    if (totalMs > 0) {
      const elapsedMs = Math.max(0, endMs - startMs)
      computedPercent = Math.min(100, Math.max(5, Math.round((elapsedMs / totalMs) * 100)))
    }
  }

  const barWidth = status === 'Pausado' || status === 'Não definido' ? 100 : computedPercent

  // Cálculo do tempo decorrido
  let elapsedText = ''
  if (createdAt) {
    const startMs = new Date(createdAt).getTime()
    const endMs = completedAt ? new Date(completedAt).getTime() : Date.now()
    const grossMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000))
    const netMinutes =
      type === 'solution' ? Math.max(0, grossMinutes - (totalPauseMinutes || 0)) : grossMinutes
    const hours = Math.floor(netMinutes / 60)
    const mins = netMinutes % 60
    elapsedText = hours > 0 ? `${hours}h ${mins}min decorridos` : `${mins}min decorridos`
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 dark:border-slate-700 bg-card">
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
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
        <span>Prazo: {formatDeadline(deadline)}</span>
        {completedAt ? (
          <span className="text-slate-400 font-medium">
            Concluído: {formatDeadline(completedAt)}
          </span>
        ) : status === 'Pausado' ? (
          <span className="text-amber-600 font-medium">SLA Pausado</span>
        ) : (
          <span className={config.text}>{formatRemainingTime(deadline)}</span>
        )}
      </div>
      {(elapsedText || startedAt) && (
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-muted-foreground">
          {startedAt ? (
            <span>Início: {formatDeadline(startedAt)}</span>
          ) : (
            <span>{elapsedText}</span>
          )}
          {type === 'solution' && totalPauseMinutes > 0 && (
            <span className="text-amber-600/90 font-medium">Pausas: {totalPauseMinutes}min</span>
          )}
          {startedAt && elapsedText && <span>{elapsedText}</span>}
        </div>
      )}
    </div>
  )
}
