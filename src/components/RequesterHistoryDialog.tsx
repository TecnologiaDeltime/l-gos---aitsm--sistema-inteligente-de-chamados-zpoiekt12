import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

interface Props {
  email: string
  currentTicketId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

const PER_PAGE = 10

export function RequesterHistoryDialog({ email, currentTicketId, open, onOpenChange }: Props) {
  const [tickets, setTickets] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(
    async (pageNum: number) => {
      if (!email) return
      setLoading(true)
      try {
        const result = await pb.collection('tickets').getList(pageNum, PER_PAGE, {
          filter: `requester_email = "${email}"`,
          sort: '-created',
        })
        setTickets(result.items)
        setTotalPages(result.totalPages)
        setTotalItems(result.totalItems)
      } catch {
        setTickets([])
      } finally {
        setLoading(false)
      }
    },
    [email],
  )

  useEffect(() => {
    if (open) {
      setPage(1)
      loadHistory(1)
    }
  }, [open, loadHistory])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadHistory(newPage)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico do Solicitante</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-slate-500 mb-2">
          {totalItems} chamado(s) encontrado(s) para{' '}
          <span className="font-medium">{email || '—'}</span>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            Nenhum chamado encontrado para este solicitante.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {tickets.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border p-3 text-xs flex items-center justify-between gap-2 ${
                  t.id === currentTicketId
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      to={`/tickets/${t.id}`}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      #{t.number}
                    </Link>
                    {t.id === currentTicketId && (
                      <Badge variant="outline" className="text-[10px]">
                        Atual
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{t.title}</p>
                  <p className="text-slate-400 mt-0.5">
                    {new Date(t.created).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
