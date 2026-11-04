import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface SlaTimerProps {
  label: string
  deadline?: string
  completedAt?: string
  compact?: boolean
}

function formatDuration(diffMs: number) {
  const isNegative = diffMs < 0
  const abs = Math.abs(diffMs)
  const totalSeconds = Math.floor(abs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  // Padrão do sistema: HH:MM:SS (ex.: 00:00:00)
  return `${isNegative ? '-' : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function SlaLiveCountdown({ label, deadline, completedAt, compact = false }: SlaTimerProps) {
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    if (completedAt || !deadline) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline, completedAt])

  if (!deadline) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        <span>{label}: Não definido</span>
      </div>
    )
  }

  const deadlineMs = new Date(deadline).getTime()

  // Se já foi concluído
  if (completedAt) {
    const completedMs = new Date(completedAt).getTime()
    const met = completedMs <= deadlineMs
    return (
      <div
        className={`flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded border ${
          met
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span className="font-sans font-medium">{label}:</span>
        <span>{met ? 'Atendido' : 'Estourado'}</span>
      </div>
    )
  }

  const diffMs = deadlineMs - now
  const isBreached = diffMs <= 0
  const isWarning = diffMs > 0 && diffMs <= 15 * 60000 // Menos de 15 min

  let colorClasses = 'bg-muted/60 text-foreground border-border'
  if (isBreached) {
    colorClasses =
      'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 font-bold animate-pulse'
  } else if (isWarning) {
    colorClasses =
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold'
  }

  if (compact) {
    return (
      <span
        title={`${label} (restante)`}
        className={`inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded border ${colorClasses}`}
      >
        {isBreached ? (
          <AlertTriangle className="w-3 h-3 text-red-500" />
        ) : (
          <Clock className="w-3 h-3 text-amber-500" />
        )}
        <span>{formatDuration(diffMs)}</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center justify-between gap-2 p-2 rounded border ${colorClasses}`}>
      <div className="flex items-center gap-1.5">
        {isBreached ? (
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <span className="text-xs font-sans font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className="font-mono text-xs font-bold tracking-tight">{formatDuration(diffMs)}</span>
        {isBreached && (
          <span className="block text-[10px] text-red-600 dark:text-red-400 font-sans font-semibold">
            SLA Violado
          </span>
        )}
      </div>
    </div>
  )
}
