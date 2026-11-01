import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, Link2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getActiveTemplates, TicketTemplateRecord } from '@/services/ticket-templates'
import { TicketRecord } from '@/services/tickets'
import { batchResolveAssociated } from '@/services/ticket-associations'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'

interface BatchResolveConfirmDialogProps {
  ticket: TicketRecord
  associatedTickets: TicketRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved?: () => void
  /** Chamado quando o usuário opta por resolver apenas este ticket. */
  onResolveOnlyCurrent?: () => void
}

/**
 * Diálogo exibido quando o usuário tenta resolver um ticket que possui
 * associações. Pergunta se deseja resolver TODOS os chamados associados com a
 * mesma descrição de resolução.
 */
export function BatchResolveConfirmDialog({
  ticket,
  associatedTickets,
  open,
  onOpenChange,
  onResolved,
  onResolveOnlyCurrent,
}: BatchResolveConfirmDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [solution, setSolution] = useState('')
  const [templates, setTemplates] = useState<TicketTemplateRecord[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TicketTemplateRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openCount = associatedTickets.filter(
    (t) => !['Resolvido', 'Cancelado', 'Encerrado'].includes(t.status),
  ).length

  useEffect(() => {
    if (open) {
      setSolution('')
      setSelectedTemplate(null)
      setError('')
      getActiveTemplates('Resolução')
        .then(setTemplates)
        .catch(() => setTemplates([]))
    }
  }, [open])

  const handleTemplateSelect = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId)
    if (tmpl) {
      setSelectedTemplate(tmpl)
      setSolution(tmpl.content)
      setError('')
    }
  }

  const handleConfirm = async () => {
    if (solution.trim().length < 10) {
      setError('A solução deve ter no mínimo 10 caracteres.')
      return
    }
    if (!user) return
    setLoading(true)
    try {
      const result = await batchResolveAssociated(ticket.id, solution.trim(), user.id)
      const total = result.resolved.length
      toast({
        title: 'Fechamento em massa concluído!',
        description: `${total} chamado(s) resolvido(s) com a mesma solução.`,
      })
      onOpenChange(false)
      onResolved?.()
    } catch (err) {
      toast({
        title: 'Erro ao resolver em massa',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOnlyCurrent = () => {
    onOpenChange(false)
    onResolveOnlyCurrent?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Fechamento em Massa
          </DialogTitle>
          <DialogDescription>
            Este chamado possui{' '}
            <span className="font-semibold text-foreground">
              {openCount} chamado(s) associado(s)
            </span>
            . Deseja resolver todos com a mesma descrição de resolução?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/40 dark:border-amber-900">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <Link2 className="h-3.5 w-3.5" />
              Chamados que serão resolvidos ({openCount + 1}):
            </div>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-white px-2 py-1 dark:bg-slate-900 dark:border-amber-800">
                <span className="font-bold text-primary">{ticket.number}</span>
                <span className="truncate font-medium text-foreground flex-1 mx-2">
                  {ticket.title}
                </span>
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </li>
              {associatedTickets.map((c) => {
                const isOpen = !['Resolvido', 'Cancelado', 'Encerrado'].includes(c.status)
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${
                      isOpen
                        ? 'border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700'
                        : 'border-slate-200 bg-slate-100 opacity-60 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-primary">{c.number}</span>
                    <span className="truncate font-medium text-foreground flex-1 mx-2">
                      {c.title}
                    </span>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </li>
                )
              })}
            </ul>
            {!openCount && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                Nenhum chamado associado aberto — apenas este será resolvido.
              </p>
            )}
          </div>

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Modelos</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um modelo para preencher..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Solução <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={solution}
              onChange={(e) => {
                setSolution(e.target.value)
                setError('')
              }}
              rows={5}
              placeholder="Descreva a solução aplicada a TODOS os chamados do grupo (mínimo 10 caracteres)..."
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-xs text-slate-400">{solution.trim().length} caracteres</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={handleOnlyCurrent}
            disabled={loading}
            className="sm:mr-auto"
          >
            Resolver apenas este
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || solution.trim().length < 10}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Resolver Todos ({openCount + 1})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
