import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TicketRecord } from '@/services/tickets'

interface PendingChildrenAlertProps {
  pending: TicketRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Diálogo de alerta exibido ao tentar resolver/fechar um ticket pai que
 * ainda possui tickets filhos pendentes (status diferente de Resolvido /
 * Cancelado / Encerrado). Bloqueia o encerramento e lista os filhos
 * pendentes (número e título).
 */
export function PendingChildrenAlert({ pending, open, onOpenChange }: PendingChildrenAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tickets filhos pendentes</AlertDialogTitle>
          <AlertDialogDescription>
            Este chamado possui tickets filhos pendentes. Resolva todos os tickets filhos antes de
            encerrar o chamado principal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-muted p-3 space-y-1.5">
          {pending.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-foreground truncate">
                {c.number} — {c.title}
              </span>
              <span className="text-muted-foreground shrink-0">{c.status}</span>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Entendi</AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onOpenChange(false)}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
