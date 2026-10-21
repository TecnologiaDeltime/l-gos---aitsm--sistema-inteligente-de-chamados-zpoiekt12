import { useState } from 'react'
import { RefreshCw, Clock, Check, Play, Pause, ChevronDown } from 'lucide-react'
import {
  useAutoRefresh,
  REFRESH_OPTIONS,
  RefreshIntervalValue,
} from '@/contexts/AutoRefreshContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function RefreshIndicator() {
  const {
    interval,
    setIntervalValue,
    secondsLeft,
    isRefreshing,
    lastRefreshedAt,
    triggerRefresh,
    hasActiveHandlers,
  } = useAutoRefresh()

  const [open, setOpen] = useState(false)

  const currentOption = REFRESH_OPTIONS.find((o) => o.value === interval)

  const handleManualRefresh = async () => {
    await triggerRefresh()
  }

  const lastRefreshedLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—'

  return (
    <div className="flex items-center">
      {/* Botão de Atualizar Agora com ícone girando quando ativo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
            aria-label="Atualizar agora"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 transition-transform duration-300',
                isRefreshing && 'animate-spin text-primary',
              )}
            />
            {/* Ponto indicador de status se o timer estiver ligado */}
            {interval > 0 && hasActiveHandlers && (
              <span className="absolute bottom-1 right-1 flex h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-semibold">Atualizar tela agora</p>
          <p className="text-[11px] text-muted-foreground">
            Última verificação: {lastRefreshedLabel}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Menu do Timer configurável */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 gap-1 text-xs font-medium text-muted-foreground hover:text-foreground tabular-nums select-none"
                aria-label="Configurar intervalo de atualização automática"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="hidden sm:inline">
                  {interval === 0
                    ? 'Pausado'
                    : secondsLeft !== null
                      ? `${formatSeconds(secondsLeft)}`
                      : currentOption?.shortLabel || '5m'}
                </span>
                <span className="sm:hidden text-[11px]">
                  {interval === 0 ? 'Off' : currentOption?.shortLabel || '5m'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {interval === 0 ? (
              <p>Atualização automática pausada. Clique para configurar.</p>
            ) : (
              <div>
                <p className="font-medium">
                  Próxima atualização em {secondsLeft !== null ? formatSeconds(secondsLeft) : '...'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Intervalo atual: {currentOption?.label || `${interval}s`}
                </p>
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center justify-between text-xs py-1.5">
            <span className="font-semibold">Atualização Automática</span>
            {isRefreshing ? (
              <span className="text-[10px] text-primary flex items-center gap-1 font-normal">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Atualizando...
              </span>
            ) : interval > 0 ? (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                Ativo ({secondsLeft !== null ? formatSeconds(secondsLeft) : ''})
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground font-normal">Pausado</span>
            )}
          </DropdownMenuLabel>
          <div className="px-2 py-1 text-[11px] text-muted-foreground">
            Última verificação:{' '}
            <span className="font-mono text-foreground">{lastRefreshedLabel}</span>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1">
            Intervalo de atualização
          </DropdownMenuLabel>

          {REFRESH_OPTIONS.map((opt) => {
            const isSelected = interval === opt.value
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setIntervalValue(opt.value as RefreshIntervalValue)}
                className="flex items-center justify-between cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2">
                  {opt.value === 0 ? (
                    <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-xs text-primary font-medium cursor-pointer"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            <span>Atualizar Agora</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
