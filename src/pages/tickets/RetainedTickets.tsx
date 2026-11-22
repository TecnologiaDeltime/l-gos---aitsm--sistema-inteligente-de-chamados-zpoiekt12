import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, MailX, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getRetainedTickets,
  releaseRetainedTicket,
  dismissRetainedTicket,
  deleteRetainedTicket,
  RetainedTicketRecord,
} from '@/services/retained-tickets'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/StatusBadge'

const STATUS_COLORS: Record<string, string> = {
  Pendente:
    'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  Liberado:
    'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
  Excluído:
    'bg-slate-500/10 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40',
}

export default function RetainedTickets() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [items, setItems] = useState<RetainedTicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Pendente')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<'release' | 'dismiss'>('release')
  const [reviewNotes, setReviewNotes] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const filter = statusFilter === 'all' ? undefined : `status = "${statusFilter}"`
        const data = await getRetainedTickets(filter)
        setItems(data)
      } catch (err) {
        console.error(err)
        toast({
          title: 'Erro ao carregar e-mails retidos',
          description: 'Não foi possível buscar a lista de retenção.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [statusFilter],
  )

  useEffect(() => {
    load()
  }, [load])

  const openReview = (id: string, mode: 'release' | 'dismiss') => {
    setReviewId(id)
    setReviewMode(mode)
    setReviewNotes('')
  }

  const closeReview = () => {
    setReviewId(null)
    setReviewNotes('')
  }

  const confirmReview = async () => {
    if (!reviewId) return
    setActionBusy(reviewId)
    try {
      if (reviewMode === 'release') {
        await releaseRetainedTicket(reviewId, { notes: reviewNotes || undefined })
        toast({ title: 'E-mail liberado — chamado será criado' })
      } else {
        await dismissRetainedTicket(reviewId, reviewNotes || undefined)
        toast({ title: 'E-mail descartado' })
      }
      closeReview()
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro na moderação',
        description: err?.message || 'Não foi possível concluir a ação.',
        variant: 'destructive',
      })
    } finally {
      setActionBusy(null)
    }
  }

  const handleDelete = async (id: string) => {
    setActionBusy(id)
    try {
      await deleteRetainedTicket(id)
      toast({ title: 'Registro excluído' })
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o registro.',
        variant: 'destructive',
      })
    } finally {
      setActionBusy(null)
    }
  }

  const filtered = items.filter((r) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const hay = `${r.subject || ''} ${r.from_email || ''} ${r.from_name || ''}`.toLowerCase()
    return hay.includes(q)
  })

  const reviewItem = items.find((i) => i.id === reviewId) || null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-mails Retidos</h1>
          <p className="text-sm text-muted-foreground">
            Moderação de e-mails bloqueados pelas regras de retenção antes de virar chamado.
          </p>
        </div>
        <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por assunto, remetente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Liberado">Liberado</SelectItem>
                <SelectItem value="Excluído">Excluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${filtered.length} e-mail(s) retido(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Nenhum e-mail retido para o filtro atual.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Assunto / Prévia</TableHead>
                    <TableHead className="w-[220px]">Remetente</TableHead>
                    <TableHead className="w-[160px]">Motivo da retenção</TableHead>
                    <TableHead className="w-[150px]">Recebido</TableHead>
                    <TableHead className="w-[260px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`itsm-badge ${STATUS_COLORS[r.status] || ''}`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[360px] truncate text-sm font-medium">
                          {r.subject}
                        </div>
                        {r.body && (
                          <div className="mt-0.5 max-w-[360px] truncate text-xs text-muted-foreground">
                            {r.body}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.from_name ? `${r.from_name} · ` : ''}
                        {r.from_email}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.reason || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={actionBusy === r.id}
                            onClick={() => openReview(r.id, 'release')}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Liberar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionBusy === r.id}
                            onClick={() => openReview(r.id, 'dismiss')}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Descartar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            disabled={actionBusy === r.id}
                            onClick={() => handleDelete(r.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewId} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewMode === 'release' ? 'Liberar e-mail retido' : 'Descartar e-mail retido'}
            </DialogTitle>
            <DialogDescription>
              {reviewMode === 'release'
                ? 'O e-mail seguirá o fluxo normal e um chamado será criado a partir dele.'
                : 'O e-mail será marcado como descartado e não gerará chamado.'}
            </DialogDescription>
          </DialogHeader>
          {reviewItem && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{reviewItem.subject}</div>
              <div>
                De: {reviewItem.from_name ? `${reviewItem.from_name} ` : ''}
                &lt;{reviewItem.from_email}&gt;
              </div>
            </div>
          )}
          <div className="space-y-2 py-2">
            <Label htmlFor="review-notes">Observações da moderação</Label>
            <Textarea
              id="review-notes"
              placeholder="Justificativa da decisão (opcional)..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReview}>
              Cancelar
            </Button>
            <Button onClick={confirmReview} disabled={actionBusy === reviewId}>
              {actionBusy === reviewId ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {reviewMode === 'release' ? 'Liberar' : 'Descartar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
