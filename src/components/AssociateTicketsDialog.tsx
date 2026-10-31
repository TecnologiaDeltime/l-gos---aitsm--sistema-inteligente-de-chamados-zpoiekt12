import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Link2, Search, Check } from 'lucide-react'
import { TicketRecord } from '@/services/tickets'
import {
  searchEligibleTicketsForAssociation,
  associateTickets,
} from '@/services/ticket-associations'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'

interface AssociateTicketsDialogProps {
  ticket: TicketRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssociated?: () => void
}

export function AssociateTicketsDialog({
  ticket,
  open,
  onOpenChange,
  onAssociated,
}: AssociateTicketsDialogProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<TicketRecord[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(new Set())
    setLoading(true)
    searchEligibleTicketsForAssociation(ticket.id, '')
      .then(setCandidates)
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [open, ticket.id])

  // Debounce simples da busca.
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const handle = setTimeout(() => {
      searchEligibleTicketsForAssociation(ticket.id, search)
        .then(setCandidates)
        .catch(() => setCandidates([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [search, open, ticket.id])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const alreadyInGroup = useMemo(
    () =>
      new Set(
        candidates
          .filter(
            (c) => c.association_group_id && c.association_group_id === ticket.association_group_id,
          )
          .map((c) => c.id),
      ),
    [candidates, ticket.association_group_id],
  )

  const handleConfirm = async () => {
    const targetIds = Array.from(selected).filter((id) => !alreadyInGroup.has(id))
    if (targetIds.length === 0) {
      toast({ title: 'Selecione ao menos um ticket para associar', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await associateTickets(ticket.id, targetIds)
      toast({
        title: 'Associação realizada!',
        description: `${targetIds.length} ticket(s) associado(s) com sucesso.`,
      })
      onOpenChange(false)
      onAssociated?.()
    } catch (err) {
      toast({
        title: 'Erro ao associar chamados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Associar Chamados
          </DialogTitle>
          <DialogDescription>
            Selecione outros chamados abertos para associar ao ticket{' '}
            <span className="font-semibold text-foreground">{ticket.number}</span>. A associação é
            bidirecional: todos os chamados do grupo enxergam uns aos outros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              Apenas chamados <strong>abertos</strong> e sem ticket pai podem ser associados.
              Tickets filhos (hierarquia pai/filho) são mutuamente exclusivos com associação.
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nº, título ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : candidates.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum chamado elegível encontrado.
              </div>
            ) : (
              <ul className="divide-y">
                {candidates.map((c) => {
                  const isSelected = selected.has(c.id)
                  const isAlready = alreadyInGroup.has(c.id)
                  return (
                    <li
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-muted/60 ${
                        isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                      }`}
                      onClick={() => !isAlready && toggleSelect(c.id)}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isAlready
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-slate-300'
                        }`}
                      >
                        {isAlready ? (
                          <Check className="h-3 w-3" />
                        ) : isSelected ? (
                          <Check className="h-3 w-3" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-primary">{c.number}</span>
                          <span className="truncate font-medium text-foreground">{c.title}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {c.expand?.company?.trade_name || 'Geral'} • {c.requester_name}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isAlready && (
                          <Badge variant="outline" className="text-[10px] text-emerald-700">
                            Já associado
                          </Badge>
                        )}
                        <PriorityBadge priority={c.priority} />
                        <StatusBadge status={c.status} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {selected.size > 0 && (
            <div className="text-xs text-muted-foreground">
              {selected.size} ticket(s) selecionado(s) para associação.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || selected.size === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            <Link2 className="mr-1.5 h-4 w-4" />
            Associar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
