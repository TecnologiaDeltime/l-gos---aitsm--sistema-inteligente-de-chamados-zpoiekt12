import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateOnly } from '@/lib/date-format'
import { Phone, Building2, Users, Mail } from 'lucide-react'

interface RequesterUserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e-mail do solicitante (campo requester_email do chamado) */
  requesterEmail?: string
  /** nome de exibição (fallback, caso o registro do usuário não seja encontrado) */
  fallbackName?: string
  /** id do chamado atual, para marcar "chamado atual" no histórico */
  currentTicketId?: string
}

interface UserRecord {
  id: string
  name: string
  email?: string
  phone?: string
  position?: string
  role?: string
  unit?: string
  expand?: { unit?: { name?: string } }
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

/**
 * Diálogo "Ver o perfil completo e o histórico do solicitante": dados
 * completos do perfil (nome, e-mail, telefone, cargo, filial) + lista dos
 * chamados que esse solicitante já abriu (número, título, status, data).
 * Abre sobreposto à ficha do chamado — nunca navega para fora dela.
 *
 * Os chamados são buscados por requester_email (o chamado não tem relação
 * "requester" — apenas requester_name/requester_email/requester_phone).
 * O registro em users é buscado pelo e-mail, mas é OPCIONAL: quando o
 * solicitante é um usuário de cliente (que outros perfis não conseguem ver
 * pela regra da collection), o diálogo ainda mostra o histórico e o nome
 * vindo do chamado.
 */
export function TicketRequesterProfileDialog({
  open,
  onOpenChange,
  requesterEmail,
  fallbackName,
  currentTicketId,
}: RequesterUserProfileDialogProps) {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<UserRecord | null>(null)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !requesterEmail) return
    let cancelled = false
    setLoading(true)
    setError('')
    const email = requesterEmail.replace(/["\\]/g, '')
    // O perfil em users é um bônus (pode falhar por regra de acesso); o
    // histórico de chamados por e-mail funciona para os perfis internos.
    const userFetch = pb
      .collection('users')
      .getFirstListItem<UserRecord>(`email = "${email}"`, { expand: 'unit' })
      .catch(() => null)
    const ticketsFetch = pb
      .collection('tickets')
      .getFullList<TicketRow>({
        filter: `requester_email = "${email}"`,
        sort: '-created',
      })
      .catch(() => null)
    Promise.all([userFetch, ticketsFetch])
      .then(([u, list]) => {
        if (cancelled) return
        setUser(u)
        if (list) {
          setTickets(list)
          setError('')
        } else {
          setError('Não foi possível carregar o histórico de chamados do solicitante.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('Não foi possível carregar o perfil e o histórico do solicitante.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, requesterEmail])

  const unit = user?.expand?.unit?.name || ''
  const displayName = user?.name || fallbackName || 'Solicitante'

  const infoRows: { icon: React.ReactNode; label: string; value?: string }[] = [
    {
      icon: <Mail className="h-3.5 w-3.5" />,
      label: 'E-mail',
      value: user?.email || requesterEmail,
    },
    { icon: <Phone className="h-3.5 w-3.5" />, label: 'Telefone', value: user?.phone || '' },
    { icon: <Building2 className="h-3.5 w-3.5" />, label: 'Filial', value: unit },
    {
      icon: null,
      label: 'Cargo',
      value: user?.position || (user?.role ? String(user.role) : ''),
    },
  ].filter((r) => r.value && String(r.value).trim() !== '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Perfil do Solicitante</DialogTitle>
          <DialogDescription>
            Dados completos do perfil e histórico de chamados abertos por{' '}
            <span className="font-medium text-foreground">{displayName}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              {infoRows.length > 0 && (
                <dl className="mt-2 space-y-1.5">
                  {infoRows.map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-xs">
                      {row.icon && <span className="text-muted-foreground">{row.icon}</span>}
                      <dt className="w-16 shrink-0 text-muted-foreground">{row.label}</dt>
                      <dd className="text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Histórico de chamados ({tickets.length})
              </p>
              {tickets.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Nenhum chamado encontrado para este solicitante.
                </p>
              ) : (
                <ScrollArea className="h-56 rounded-md border">
                  <ul className="divide-y">
                    {tickets.map((t) => (
                      <li
                        key={t.id}
                        className={
                          'flex items-center gap-2 px-3 py-2 text-xs' +
                          (t.id === currentTicketId ? ' bg-primary/5' : '')
                        }
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
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
