import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, History } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatDateOnly } from '@/lib/date-format'
import { cn } from '@/lib/utils'

/**
 * Seção expandível "Histórico de chamados" dentro do card Solicitante da
 * Ficha do Chamado: lista em linha (nº, título, status, data) dos chamados
 * abertos pelo mesmo solicitante, resolvidos por requester_email — a mesma
 * busca do TicketRequesterProfileDialog, porém sem abrir o diálogo.
 *
 * Lazy: a busca só acontece no PRIMEIRO clique em expandir (nada é carregado
 * junto com a ficha). O chamado atual vem destacado; os demais itens são
 * clicáveis e abrem a própria ficha do chamado.
 */

interface RequesterTicketHistoryProps {
  requesterEmail?: string
  /** id do chamado atual, para destacá-lo na lista */
  currentTicketId?: string
}

interface TicketRow {
  id: string
  number: string
  title: string
  status: string
  created: string
}

const statusTone: Record<string, string> = {
  Aberto: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  'Em Atendimento': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  Pendente: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  Resolvido: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Fechado: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
}

export function RequesterTicketHistory({
  requesterEmail,
  currentTicketId,
}: RequesterTicketHistoryProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [error, setError] = useState('')
  // guarda o e-mail já carregado: troca de ficha reseta a busca
  const loadedEmailRef = useRef<string | null>(null)

  useEffect(() => {
    // ao trocar o solicitante (outra ficha), reseta para carregar de novo
    if (loadedEmailRef.current && loadedEmailRef.current !== requesterEmail) {
      loadedEmailRef.current = null
      setTickets(null)
      setError('')
      setOpen(false)
    }
  }, [requesterEmail])

  const loadHistory = () => {
    if (!requesterEmail || loading) return
    setLoading(true)
    setError('')
    const email = requesterEmail.replace(/["\\]/g, '')
    pb.collection('tickets')
      .getFullList<TicketRow>({
        filter: `requester_email = "${email}"`,
        sort: '-created',
      })
      .then((list) => {
        setTickets(list)
        loadedEmailRef.current = requesterEmail
      })
      .catch(() => {
        setError('Não foi possível carregar o histórico de chamados.')
      })
      .finally(() => setLoading(false))
  }

  if (!requesterEmail) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // lazy: busca apenas na primeira expansão
        if (o && !loadedEmailRef.current && !tickets) loadHistory()
      }}
      className="border-t pt-2"
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground',
          'transition-colors hover:bg-muted/60 hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Histórico de chamados do solicitante
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        {loading ? (
          <div className="space-y-1.5 px-1 py-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : error ? (
          <p className="px-1 py-1 text-xs text-destructive">{error}</p>
        ) : !tickets || tickets.length === 0 ? (
          <p className="rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground">
            Nenhum outro chamado encontrado para este solicitante.
          </p>
        ) : (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
            {tickets.map((t) => {
              const isCurrent = t.id === currentTicketId
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors',
                      isCurrent ? 'cursor-default bg-primary/5' : 'hover:bg-muted/60',
                    )}
                    title={isCurrent ? 'Chamado atual' : `Abrir chamado ${t.number}`}
                  >
                    <span className="w-20 shrink-0 font-mono text-muted-foreground">
                      {t.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground" title={t.title}>
                      {t.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        'shrink-0 border ' + (statusTone[t.status] || 'text-muted-foreground')
                      }
                    >
                      {t.status}
                    </Badge>
                    <span className="w-20 shrink-0 text-right text-muted-foreground">
                      {formatDateOnly(t.created)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
