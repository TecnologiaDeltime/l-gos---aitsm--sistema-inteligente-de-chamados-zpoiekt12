import { Clock, PauseCircle, AlertTriangle } from 'lucide-react'

interface SlaProgressBarProps {
  slaStatus?: string
  paused?: boolean
  deadline?: string
}

export function SlaProgressBar({
  slaStatus = 'Dentro do Prazo',
  paused,
  deadline,
}: SlaProgressBarProps) {
  let percent = 35
  let color = 'bg-emerald-500'

  if (slaStatus === 'Atenção') {
    percent = 65
    color = 'bg-slate-500 dark:bg-amber-500'
  } else if (slaStatus === 'Risco') {
    percent = 82
    color = 'bg-orange-500'
  } else if (slaStatus === 'Crítico') {
    percent = 95
    color = 'bg-red-500 animate-pulse'
  } else if (slaStatus === 'Violado') {
    percent = 100
    color = 'bg-red-600'
  }

  if (paused) {
    color = 'bg-slate-400 dark:bg-amber-400 opacity-60'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1">
          {paused ? (
            <PauseCircle className="h-3.5 w-3.5 text-slate-600 dark:text-amber-600" />
          ) : slaStatus === 'Violado' || slaStatus === 'Crítico' ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-slate-500" />
          )}
          {paused ? 'SLA Pausado' : slaStatus}
        </span>
        {deadline && (
          <span className="text-slate-500">
            {new Date(deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
