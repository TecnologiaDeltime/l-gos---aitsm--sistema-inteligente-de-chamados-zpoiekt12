import { Clock, History, Pencil, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextTip } from '@/components/ContextTip'
import { TicketSheetCard } from '@/components/tickets/TicketSheetCard'
import { formatSeconds } from '@/lib/duration'
import { cn } from '@/lib/utils'

interface TicketHoursAuditCardProps {
  /** Segundos do ciclo de trabalho do operador (ao vivo, "Horas Trabalhadas"). */
  workedSeconds: number
  /** Segundos lançados via logs de acompanhamento ("Horas de Log"). */
  loggedSeconds: number
  canLaunchAccompaniment: boolean
  /** Permite corrigir horas (perfis admin/qualidade com admin_accompaniment_hours_edit). */
  canEditHours?: boolean
  isClosed: boolean
  onLaunchAccompaniment: () => void
  onEditHours?: () => void
}

/**
 * Bloco "Apuração de Horas" da ficha do chamado: 2 cartões lado a lado
 * (Horas Trabalhadas em âmbar / Horas de Log em neutro), linha de resumo da
 * diferença e botão "+ Acompanhamento". Usa apenas tokens do tema + acentos
 * semânticos já consagrados do sistema (âmbar para trabalhadas, neutro para
 * log, emerald para positivo).
 */
export function TicketHoursAuditCard({
  workedSeconds,
  loggedSeconds,
  canLaunchAccompaniment,
  canEditHours = false,
  isClosed,
  onLaunchAccompaniment,
  onEditHours,
}: TicketHoursAuditCardProps) {
  const hasHours = workedSeconds > 0 || loggedSeconds > 0
  const diffSeconds = workedSeconds - loggedSeconds
  const showDiff = hasHours && diffSeconds !== 0

  return (
    <TicketSheetCard
      title="Apuração de Horas"
      icon={<Clock className="h-3.5 w-3.5" />}
      contentClassName="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2.5">
        {/* Horas Trabalhadas — acento âmbar do sistema */}
        <div className="group relative overflow-hidden rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.06] to-transparent px-3 py-2.5 transition-colors hover:border-amber-500/50">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Clock className="h-3 w-3" />
            </span>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Horas Trabalhadas
            </p>
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold leading-none tabular-nums text-amber-700 dark:text-amber-400">
            {formatSeconds(workedSeconds)}
          </p>
        </div>

        {/* Horas de Log — neutro do tema */}
        <div className="group relative overflow-hidden rounded-lg border bg-muted/50 px-3 py-2.5 transition-colors hover:border-muted-foreground/30">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <History className="h-3 w-3" />
            </span>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Horas de Log
            </p>
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold leading-none tabular-nums">
            {formatSeconds(loggedSeconds)}
          </p>
          {canEditHours && onEditHours && loggedSeconds > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1.5 top-1.5 h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              title="Corrigir horas de log"
              aria-label="Corrigir horas de log"
              onClick={onEditHours}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Resumo — diferença entre trabalhadas e log, ou estado de vazio elegante */}
      {hasHours ? (
        showDiff ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground">Diferença (trabalhadas − log)</span>
            <span
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                diffSeconds > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {diffSeconds > 0 ? '+' : '−'}
              {formatSeconds(Math.abs(diffSeconds))}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Horas trabalhadas e log conferem
            </span>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2.5 py-2">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground">Nenhuma hora lançada ainda</span>
        </div>
      )}

      {canLaunchAccompaniment && !isClosed && (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="outline" className="flex-1" onClick={onLaunchAccompaniment}>
            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Acompanhamento
          </Button>
          <ContextTip
            label="O que é o Acompanhamento"
            text="Registra um apontamento formal no chamado com data, descrição e tempo — é o que alimenta as Horas de Log e o histórico oficial. Admin/qualidade pode informar data de competência (retroativa) e corrigir horas depois pelo lápis."
            align="end"
          />
        </div>
      )}
    </TicketSheetCard>
  )
}
