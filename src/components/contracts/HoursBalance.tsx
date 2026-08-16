import { cn } from '@/lib/utils'
import { formatSeconds } from '@/lib/duration'

interface HoursBalanceBarProps {
  /** Total contratado em SEGUNDOS (fixado pelo botão "Aplicar"). */
  total: number | null | undefined
  /** Segundos já alocados nos acordos de atendimento. */
  allocated: number
  className?: string
}

/**
 * Barra de saldo de horas em tempo real.
 *
 * Recebe e exibe tudo em HH:MM:SS (segundos internamente):
 *  - verde quando todo o saldo foi alocado (allocated === total)
 *  - vermelho quando ultrapassou o total (allocated > total)
 *  - azul/amber enquanto está em distribuição
 */
export function HoursBalanceBar({ total, allocated, className }: HoursBalanceBarProps) {
  const totalSec = typeof total === 'number' && !Number.isNaN(total) ? total : 0
  const allocatedSec = typeof allocated === 'number' && !Number.isNaN(allocated) ? allocated : 0
  const hasTotal = totalSec > 0
  const remaining = Math.max(0, totalSec - allocatedSec)
  const over = hasTotal && allocatedSec > totalSec
  const fullyAllocated = hasTotal && allocatedSec === totalSec
  const pct = hasTotal ? Math.min(100, (allocatedSec / totalSec) * 100) : 0

  const barColor = over ? 'bg-red-500' : fullyAllocated ? 'bg-green-500' : 'bg-blue-500'

  const textColor = over
    ? 'text-red-600 dark:text-red-400'
    : fullyAllocated
      ? 'text-green-600 dark:text-green-400'
      : 'text-slate-600 dark:text-slate-300'

  const label = over
    ? `Excedido em ${formatSeconds(allocatedSec - totalSec)}`
    : fullyAllocated
      ? 'Saldo totalmente alocado'
      : hasTotal
        ? `Saldo: ${formatSeconds(remaining)} restantes`
        : 'Defina e aplique as horas mensais para acompanhar o saldo'

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs font-semibold', textColor)}>{label}</span>
        {hasTotal && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatSeconds(allocatedSec)} / {formatSeconds(totalSec)}
          </span>
        )}
      </div>
      {hasTotal && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
