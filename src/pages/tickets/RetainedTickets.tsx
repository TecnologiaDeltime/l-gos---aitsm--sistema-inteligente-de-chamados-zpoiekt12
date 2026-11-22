import { useEffect, useState, useCallback } from 'react'
import { Loader2, MailX, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const STATUS_COLORS: Record<string, string> = {
  Pendente:
    'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  Liberado:
    'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
  Excluído:
    'bg-slate-500/10 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40',
}

export default function RetainedTickets() {
  const { toast } = useToast()
  const [items, setItems] = useState<RetainedTicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<'release' | 'dismiss'>('release')
  const [reviewNotes, setReviewNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRetainedTickets('status = "Pendente"')
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const reviewItem = items.find((i) => i.id === reviewId) || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">E-mails Retidos</h1>
        <p className="text-sm text-muted-foreground">
          Moderação de e-mails bloqueados pelas regras de retenção antes de virar chamado.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${items.length} e-mail(s) pendente(s) de moderação`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Nenhum e-mail retido aguardando moderação.
              </p>
            </div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MailX className="h-4 w-4 text-muted-foreground" />
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[r.status] || ''}`}
                    >
                      {r.status}
                    </Badge>
                    {r.domain && (
                      <Badge variant="outline" className="text-[10px]">
                        domínio: {r.domain}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                </div>
                <div className="text-sm font-medium">{r.subject}</div>
                <div className="text-xs text-muted-foreground">
                  De: {r.from_name ? `${r.from_name} ` : ''}
                  &lt;{r.from_email}&gt; · Recebido em {new Date(r.created).toLocaleString('pt-BR')}
                  {r.reason ? ` · Motivo: ${r.reason}` : ''}
                </div>
                {r.body && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {r.body}
                  </p>
                )}
              </div>
            ))
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
