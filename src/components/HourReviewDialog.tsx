import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Clock, AlertTriangle, Timer, ArrowRight } from 'lucide-react'
import { formatMinutes } from '@/lib/duration'

export interface HourReviewInteraction {
  id: string
  created: string
  content?: string
  type?: string
  duration_minutes?: number
  hour_type?: string
  expand?: {
    author?: { name?: string }
  }
}

interface HourReviewDialogProps {
  interactions: HourReviewInteraction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onProceed: () => void
  timerRunning?: boolean
  timerDisplay?: string
  pendingTimeSpent?: string
}

/**
 * Converte um valor "HH:MM" (ou vazio) em minutos. Retorna 0 quando vazio/inválido.
 */
function durationToMinutes(value?: string): number {
  if (!value) return 0
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 0
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function formatBrDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function truncate(text: string | undefined, max = 100): string {
  if (!text) return '-'
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.substring(0, max) + '...'
}

export function HourReviewDialog({
  interactions,
  open,
  onOpenChange,
  onProceed,
  timerRunning = false,
  timerDisplay = '00:00',
  pendingTimeSpent = '',
}: HourReviewDialogProps) {
  const timedInteractions = interactions.filter((i) => (i.duration_minutes || 0) > 0)
  const totalMinutes = timedInteractions.reduce((sum, i) => sum + (i.duration_minutes || 0), 0)
  const hasHours = timedInteractions.length > 0

  const pendingMinutes = durationToMinutes(pendingTimeSpent)
  const hasPendingTime = !timerRunning && pendingMinutes > 0

  const handleProceed = () => {
    onOpenChange(false)
    onProceed()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Revisão de Horas do Chamado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Aviso de timer em andamento */}
          {timerRunning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Há um timer em andamento ({timerDisplay}). Pare o timer e envie o comentário para
                registrar as horas.
              </span>
            </div>
          )}

          {/* Horas no campo (não enviadas) */}
          {hasPendingTime && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <Timer className="h-4 w-4 shrink-0" />
              <span>
                Horas no campo (não enviadas):{' '}
                <strong className="tabular-nums">{formatMinutes(pendingMinutes)}</strong>
              </span>
            </div>
          )}

          {/* Listagem de horas */}
          {hasHours ? (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timedInteractions.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatBrDateTime(i.created)}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {i.expand?.author?.name || 'Usuário'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={i.type === 'Interno' ? 'secondary' : 'outline'}
                          className="text-[10px]"
                        >
                          {i.type === 'Interno' ? 'Interno' : 'Público'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {i.hour_type ? (
                          <Badge variant="outline" className="text-[10px]">
                            {i.hour_type}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                        {formatMinutes(i.duration_minutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold text-sm">
                      Total geral de horas
                    </TableCell>
                    <TableCell className="text-right font-mono text-base tabular-nums font-bold text-primary">
                      {formatMinutes(totalMinutes)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            !timerRunning &&
            !hasPendingTime && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma hora registrada neste chamado.
              </div>
            )
          )}

          {/* Conteúdo das interações (referência rápida) */}
          {hasHours && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Resumo das interações
              </p>
              {timedInteractions.map((i) => (
                <div key={i.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {i.expand?.author?.name || 'Usuário'}
                  </span>{' '}
                  — {truncate(i.content)}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleProceed} className="bg-emerald-600 hover:bg-emerald-700">
            Prosseguir com Resolução
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
