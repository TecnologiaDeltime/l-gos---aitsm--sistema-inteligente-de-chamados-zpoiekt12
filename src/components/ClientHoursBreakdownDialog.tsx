import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { getQueueBreakdown, type QueueBreakdownItem } from '@/services/client-hours'
import { formatSeconds } from '@/lib/duration'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  clientName: string
}

export function ClientHoursBreakdownDialog({ open, onClose, companyId, clientName }: Props) {
  const [data, setData] = useState<QueueBreakdownItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getQueueBreakdown(companyId)
      setData(result)
    } catch {
      setError('Falha ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && companyId) {
      load()
    }
  }, [open, companyId])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Horas por Equipe — {clientName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
            </Button>
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Sem dados de consumo para este cliente no mês atual.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.map((item) => (
              <div
                key={item.queueId}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.queueName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatSeconds(item.seconds)} consumidas
                  </p>
                </div>
                <span className="text-lg font-bold text-primary ml-2 shrink-0">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
