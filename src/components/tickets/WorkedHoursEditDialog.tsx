import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { HHMMInput } from '@/components/ui/HHMMInput'
import { parseHHMMToMinutes, formatSeconds } from '@/lib/duration'
import { editWorkedHoursWithRecalculation } from '@/services/hours-edit'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Timer } from 'lucide-react'

interface WorkedHoursEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID do chamado cujas horas trabalhadas serão corrigidas. */
  ticketId: string
  /** Segundos ao vivo exibidos no card Horas Trabalhadas (acumulado + segmento atual). */
  liveSeconds: number
  onSaved: () => void
}

/**
 * Diálogo "Corrigir Horas Trabalhadas" da Apuração de Horas: define o total de
 * horas do ciclo de trabalho (play/pause) do chamado. O backend
 * (/backend/v1/tickets/{id}/worked-hours/edit) valida a permissão
 * admin_accompaniment_hours_edit, ajusta operator_worked_seconds/work_hours e
 * grava auditoria, histórico e interação de rastreabilidade. Não há data de
 * competência: as horas trabalhadas são um acumulado do ciclo, não um
 * lançamento datado (diferença intencional em relação às Horas de Log).
 */
export function WorkedHoursEditDialog({
  open,
  onOpenChange,
  ticketId,
  liveSeconds,
  onSaved,
}: WorkedHoursEditDialogProps) {
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const s = Math.max(0, Math.round(liveSeconds))
      setValue(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`,
      )
      setDescription('')
    }
  }, [open, liveSeconds])

  const minutes = parseHHMMToMinutes(value)
  const invalid = value.trim() !== '' && (minutes === null || minutes === undefined)

  const handleSave = async () => {
    const m = parseHHMMToMinutes(value)
    if (m === null || m === undefined || m < 0) {
      toast({
        title: 'Informe o tempo',
        description: 'Preencha o tempo no formato 00:00 (horas:minutos).',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      await editWorkedHoursWithRecalculation(ticketId, {
        worked_seconds: m * 60,
        description: description.trim() || undefined,
      })
      toast({
        title: 'Horas trabalhadas corrigidas',
        description: `Apuração atualizada para ${formatSeconds(m * 60)}.`,
      })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: 'Erro ao corrigir horas trabalhadas',
        description: getErrorMessage(e),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Corrigir Horas Trabalhadas
          </DialogTitle>
          <DialogDescription>
            Define o total de horas do ciclo de trabalho do chamado. Recalcula a apuração e registra
            quem corrigiu, com os valores anterior e novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="worked-hours-edit-time">Tempo corrigido (HH:MM)</Label>
            <HHMMInput
              id="worked-hours-edit-time"
              value={value}
              onChange={setValue}
              placeholder="00:00"
            />
            {invalid && (
              <p className="text-xs text-destructive">
                Tempo inválido. Use o formato 00:00 (horas:minutos).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="worked-hours-edit-description">Descrição / Observação</Label>
            <Textarea
              id="worked-hours-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo da correção (opcional)..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || invalid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar correção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
