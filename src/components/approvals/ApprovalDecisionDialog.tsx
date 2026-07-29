import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function ApprovalDecisionDialog({
  open,
  onOpenChange,
  decision,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  decision: 'approved' | 'rejected' | null
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (open) setComment('')
  }, [open])

  if (!decision) return null

  const isReject = decision === 'rejected'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isReject ? 'Rejeitar Aprovação' : 'Aprovar Solicitação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">
            {isReject ? 'Motivo da rejeição *' : 'Comentário (opcional)'}
          </Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={isReject ? 'Informe o motivo...' : 'Adicione um comentário...'}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(comment)}
            disabled={isReject && !comment.trim()}
            className={isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isReject ? 'Confirmar Rejeição' : 'Confirmar Aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
