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
import { Loader2, Coffee } from 'lucide-react'

// Motivos EXCLUSIVOS da Pausa do Ciclo de Trabalho (contabilização de horas do
// operador). NÃO interferem no SLA — os motivos de Pausa de SLA são outros
// (ver SlaPauseDialog.tsx) e nunca devem ser misturados a esta lista.
export const WORK_CYCLE_PAUSE_REASONS = [
  'Almoço',
  'Intervalo/Café',
  'Reunião interna',
  'Treinamento',
  'Atendimento presencial',
  'Compromisso externo',
  'Outro',
] as const

interface WorkCyclePauseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string, description: string) => Promise<void>
}

export function WorkCyclePauseDialog({ open, onOpenChange, onConfirm }: WorkCyclePauseDialogProps) {
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setDescription('')
      setError('')
    }
  }, [open])

  const descriptionRequired = reason === 'Outro'
  const canConfirm = !!reason && (!descriptionRequired || description.trim().length >= 3)

  const handleConfirm = async () => {
    if (!reason) {
      setError('Selecione um motivo para a pausa do ciclo de trabalho.')
      return
    }
    if (descriptionRequired && description.trim().length < 3) {
      setError('Descreva o motivo quando selecionar "Outro".')
      return
    }
    setLoading(true)
    try {
      await onConfirm(reason, description.trim())
      onOpenChange(false)
    } catch {
      setError('Erro ao pausar o ciclo de trabalho. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-amber-500" />
            Pausar Ciclo de Trabalho
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          A pausa do ciclo de trabalho é apenas para contabilização das horas do operador —{' '}
          <strong>não pausa o SLA do chamado</strong>. Para pausar o SLA, use o botão "Pausar SLA".
        </p>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Motivo da pausa do ciclo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v)
                setError('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo da pausa do ciclo..." />
              </SelectTrigger>
              <SelectContent>
                {WORK_CYCLE_PAUSE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Descrição {descriptionRequired && <span className="text-red-500">*</span>}
              {!descriptionRequired && (
                <span className="text-xs font-normal text-muted-foreground"> (opcional)</span>
              )}
            </Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setError('')
              }}
              rows={3}
              placeholder={
                descriptionRequired
                  ? 'Descreva o motivo da pausa (obrigatório quando "Outro")...'
                  : 'Detalhe opcional da pausa do ciclo de trabalho...'
              }
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
            disabled={loading || !canConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Pausar Ciclo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
