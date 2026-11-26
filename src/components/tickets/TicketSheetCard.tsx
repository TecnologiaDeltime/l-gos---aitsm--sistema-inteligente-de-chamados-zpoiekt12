import { UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Card padronizado da Ficha do Chamado: mesmas alturas, mesmas escalações
 * tipográficas e mesma borda/sombra nos dois lados da ficha (simetria).
 */
export function TicketSheetCard({
  title,
  icon,
  className,
  contentClassName,
  children,
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('gap-2 rounded-xl border shadow-sm py-3', className)}>
      <CardHeader className="px-4 pb-1">
        <CardTitle className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn('px-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

/**
 * Item rótulo/valor do bloco de Solicitante e de detalhes.
 */
export function TicketSheetField({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="truncate text-right text-sm font-medium">{children}</span>
    </div>
  )
}

/**
 * Bloco de Solicitante (nome, e-mail, botão de perfil) — parte da coluna
 * direita da ficha.
 */
export function TicketSheetRequesterCard({
  ticket,
  onOpenProfile,
}: {
  ticket: any
  onOpenProfile: () => void
}) {
  return (
    <TicketSheetCard
      title="Solicitante"
      icon={<UserRound className="h-3.5 w-3.5" />}
      contentClassName="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {ticket.requester_name || 'Não informado'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{ticket.requester_email || '—'}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpenProfile} className="shrink-0">
          Perfil
        </Button>
      </div>
    </TicketSheetCard>
  )
}
