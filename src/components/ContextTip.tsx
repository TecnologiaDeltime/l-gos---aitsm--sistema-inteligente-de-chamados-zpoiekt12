import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ContextTipProps {
  /** Texto curto da dica (1–2 frases, português operacional). */
  text: string
  /** Nome acessível do botão de dica. */
  label?: string
  className?: string
  /** Alinhamento do balão em relação ao ícone. */
  align?: 'start' | 'center' | 'end'
}

/**
 * Dica contextual da Ficha do Chamado: ícone "?" pequeno e discreto (âmbar do
 * tema) que abre um balão curto. No desktop abre ao passar o mouse e no
 * celular ao tocar — o alvo de toque tem ≥44px (área invisível ao redor do
 * ícone), sem mudar o visual pequeno.
 */
export function ContextTip({
  text,
  label = 'Dica de ajuda',
  className,
  align = 'end',
}: ContextTipProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          className={cn(
            'relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full',
            'border border-amber-600/50 bg-amber-500/15 text-[10px] font-bold leading-none text-amber-700 dark:text-amber-400',
            'transition-colors hover:bg-amber-500/30 hover:text-amber-800 dark:hover:text-amber-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            // Alvo de toque ≥44px em celular, invisível (não muda o layout):
            'after:absolute after:-inset-[15px] after:rounded-full after:content-[""]',
            className,
          )}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align={align}
        sideOffset={6}
        className="w-64 rounded-lg border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground shadow-lg"
        role="note"
        onPointerEnter={() => setOpen(true)}
      >
        <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Dica
        </span>
        {text}
      </PopoverContent>
    </Popover>
  )
}
