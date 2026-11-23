import { useState } from 'react'
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
import { parseHHMMToMinutes } from '@/lib/duration'
import { addAccompanimentHours } from '@/services/tickets'
import { useToast } from '@/hooks/use-toast'
import { Loader2, PlusCircle } from 'lucide-react'

interface AccompanimentHoursDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  ticketNumber?: string
  /** Permite escolher data de competência retroativa (admin_accompaniment_hours_edit). */
  canEditCompetency?: boolean
  onSaved?: () => void
}

/**
 * Diálogo "+ Acompanhamento": lança um acompanhamento com horas (HH:MM, campo
 * com dois-pontos travados) e descrição/observação. Usa o serviço existente
 * addAccompanimentHours — o lançamento soma nas horas de log
 * (accompaniment_seconds) do chamado.
 */
export function AccompanimentHoursDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  canEditCompetency = false,
  onSaved,
}: AccompanimentHoursDialogProps) {
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [competencyDate, setCompetencyDate] = useState('')
  const [saving, setSaving] = useState(false)

  const minutes = parseHHMMToMinutes(value)
  const invalid = value.trim() !== '' && (minutes === null || minutes === undefined) ? true : false

  const reset = () => {
    setValue('')
    setDescription('')
    setCompetencyDate('')
  }

  const handleSave = async () => {
    const m = parseHHMMToMinutes(value)
    if (m === null || m === undefined) {
      toast({
        title: 'Informe o tempo',
        description: 'Preencha o tempo no formato 00:00 (horas:minutos).',
        variant: 'destructive',
      })
      return
    }
    if (m <= 0) {
      toast({
        title: 'Tempo inválido',
        description: 'O tempo deve ser maior que 00:00.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      await addAccompanimentHours(ticketId, {
        content: description.trim(),
        duration_minutes: m,
        duration_seconds: m * 60,
        hour_type: 'Contratada',
        billing_status: 'Faturável',
        competency_date: canEditCompetency && competencyDate ? competencyDate : undefined,
      })
      toast({
        title: 'Acompanhamento lançado',
        description:
          canEditCompetency && competencyDate
            ? `Registro gravado com competência ${competencyDate}.`
            : 'As horas foram registradas no log do chamado.',
      })
      reset()
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      console.error('Erro ao lançar acompanhamento', e)
      toast({
        title: 'Erro ao lançar acompanhamento',
        description:
          e instanceof Error ? e.message : 'Não foi possível registrar o acompanhamento.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-primary" />
            Lançar Acompanhamento
          </DialogTitle>
          <DialogDescription>
            {ticketNumber ? (
              <>
                Lança horas no log do chamado{' '}
                <span className="font-medium text-foreground">{ticketNumber}</span>. O valor é
                somado nas horas de log (Horas de Acompanhamento).
              </>
            ) : (
              'Lança horas no log do chamado (Horas de Acompanhamento).'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="accompaniment-hours">Tempo (HH:MM)</Label>
            <HHMMInput
              id="accompaniment-hours"
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

          {canEditCompetency && (
            <div className="space-y-2">
              <Label htmlFor="accompaniment-competency">Data de competência</Label>
              <input
                id="accompaniment-competency"
                type="date"
                value={competencyDate}
                onChange={(e) => setCompetencyDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Campo opcional. A data informada passa a ser a competência do lançamento — útil para
                registrar correções em meses anteriores.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="accompaniment-description">Descrição / Observação</Label>
            <Textarea
              id="accompaniment-description"
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
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lançar horas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
