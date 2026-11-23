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
import { editInteractionWithRecalculation } from '@/services/hours-edit'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Pencil } from 'lucide-react'

interface AccompanimentEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lançamento a corrigir (origin != Cronômetro). */
  interaction: {
    id: string
    content?: string
    duration_minutes?: number
    created?: string
  } | null
  onSaved: () => void
}

/** Data (AAAA-MM-DD) extraída do created atual do lançamento. */
const currentDateValue = (created?: string) => {
  if (!created) return ''
  const d = new Date(created)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().substring(0, 10)
}

/**
 * Diálogo "Corrigir Horas" da Apuração de Horas: ajusta o tempo (HH:MM) e a
 * data de competência de um lançamento de acompanhamento. O backend
 * (/backend/v1/interactions/{id}/edit) valida a permissão
 * admin_accompaniment_hours_edit, recalcula as horas do chamado e grava a
 * auditoria (quem, anterior, novo).
 */
export function AccompanimentEditDialog({
  open,
  onOpenChange,
  interaction,
  onSaved,
}: AccompanimentEditDialogProps) {
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && interaction) {
      const m = interaction.duration_minutes || 0
      setValue(
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`,
      )
      setDescription(interaction.content || '')
      setDate(currentDateValue(interaction.created))
    }
  }, [open, interaction])

  const minutes = parseHHMMToMinutes(value)
  const invalid = value.trim() !== '' && (minutes === null || minutes === undefined)

  const handleSave = async () => {
    if (!interaction) return
    const m = parseHHMMToMinutes(value)
    if (m === null || m === undefined || m < 0) {
      toast({
        title: 'Informe o tempo',
        description: 'Preencha o tempo no formato 00:00 (horas:minutos).',
        variant: 'destructive',
      })
      return
    }

    const payload: Parameters<typeof editInteractionWithRecalculation>[1] = {
      duration_minutes: m,
      content: description.trim() || undefined,
    }
    // Competência alterada ⇒ manda a nova data; igual ⇒ não envia.
    const currentDate = currentDateValue(interaction.created)
    if (date && date !== currentDate) payload.competency_date = date

    try {
      setSaving(true)
      await editInteractionWithRecalculation(interaction.id, payload)
      toast({
        title: 'Horas corrigidas',
        description: `Apuração atualizada para ${formatSeconds(m * 60)}.`,
      })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: 'Erro ao corrigir horas',
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
            <Pencil className="h-4 w-4 text-primary" />
            Corrigir Horas de Log
          </DialogTitle>
          <DialogDescription>
            Ajusta o tempo do lançamento, recalcula as horas do chamado e registra quem corrigiu,
            com os valores anterior e novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="accompaniment-edit-hours">Tempo corrigido (HH:MM)</Label>
            <HHMMInput
              id="accompaniment-edit-hours"
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
            <Label htmlFor="accompaniment-edit-date">Data de competência</Label>
            <input
              id="accompaniment-edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Define em qual mês do relatório mensal este lançamento é considerado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accompaniment-edit-description">Descrição / Observação</Label>
            <Textarea
              id="accompaniment-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o acompanhamento realizado..."
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
