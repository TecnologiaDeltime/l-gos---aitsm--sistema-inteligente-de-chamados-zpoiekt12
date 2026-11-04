import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { Link } from 'react-router-dom'
import { formatMinutes } from '@/lib/duration'
import type { TicketRecord } from '@/services/tickets'

interface DrillDownDialogProps {
  open: boolean
  onClose: () => void
  title: string
  tickets: TicketRecord[]
}

export function DrillDownDialog({ open, onClose, title, tickets }: DrillDownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {title} — {tickets.length} chamado(s)
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nº</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Solicitante</TableHead>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs">Atividade</TableHead>
                <TableHead className="text-xs">Prioridade</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Abertura</TableHead>
                <TableHead className="text-xs">Fechamento</TableHead>
                <TableHead className="text-xs">SLA</TableHead>
                <TableHead className="text-xs">Horas</TableHead>
                <TableHead className="text-xs">Contrato</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={13}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum chamado encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      <Link
                        to={`/tickets/${t.id}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        #{t.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.expand?.company?.trade_name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs">{t.requester_name || 'N/A'}</TableCell>
                    <TableCell className="text-xs">
                      {t.expand?.assigned_to?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs">{t.expand?.category?.name || 'N/A'}</TableCell>
                    <TableCell className="text-xs">
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="text-xs">
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.created ? new Date(t.created).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.closure_date ? new Date(t.closure_date).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-xs">{t.sla_status || '-'}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatMinutes((t.work_hours || 0) * 60)}
                    </TableCell>
                    <TableCell className="text-xs">{t.expand?.contract?.number || '-'}</TableCell>
                    <TableCell className="text-xs">{t.type || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
