import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, PauseCircle } from 'lucide-react'

const SLA_PAUSE_REASONS = [
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Aguardando Fornecedor',
  'Aguardando Peça',
  'Aguardando Janela de Manutenção',
  'Chamado Agendado',
  'Cliente Indisponível',
] as const

const STATUS_BY_REASON: Record<string, string> = {
  'Aguardando Cliente': 'Aguardando Cliente',
  'Aguardando Aprovação': 'Aguardando Aprovação',
  'Aguardando Terceiro': 'Aguardando Terceiro',
  'Aguardando Fornecedor': 'Aguardando Terceiro',
  'Aguardando Peça': 'Aguardando Terceiro',
  'Aguardando Janela de Manutenção': 'Agendado',
  'Chamado Agendado': 'Agendado',
  'Cliente Indisponível': 'Aguardando Cliente',
}

interface SlaPauseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string, justification: string) => Promise<void>
}

export function SlaPauseDialog({ open, onOpenChange, onConfirm }: SlaPauseDialogProps) {
  const [reason, setReason] = useState<string>('')
  const [justification, setJustification] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setJustification('')
      setError('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (!reason) {
      setError('Selecione um motivo para a pausa.')
      return
    }
    if (justification.trim().length < 5) {
      setError('A justificativa deve ter no mínimo 5 caracteres.')
      return
    }
    setLoading(true)
    try {
      await onConfirm(reason, justification.trim())
      onOpenChange(false)
    } catch {
      setError('Erro ao pausar SLA. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-600" />
            Pausar SLA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v)
                setError('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo da pausa..." />
              </SelectTrigger>
              <SelectContent>
                {SLA_PAUSE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Justificativa <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value)
                setError('')
              }}
              rows={4}
              placeholder="Descreva o motivo da pausa do SLA (mínimo 5 caracteres)..."
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !reason || justification.trim().length < 5}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Pausar SLA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SLA_PAUSE_REASONS, STATUS_BY_REASON }
