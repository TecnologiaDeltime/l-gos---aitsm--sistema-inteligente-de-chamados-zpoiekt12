import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, Loader2 } from 'lucide-react'
import { addAccompanimentHours } from '@/services/tickets'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { parseDurationToSeconds } from '@/lib/duration'
import { DurationInput } from '@/components/ui/DurationInput'
import { validateTimeSpentValue } from '@/lib/time-mask'

interface AccompanimentDialogProps {
  ticketId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function AccompanimentDialog({
  ticketId,
  open,
  onOpenChange,
  onSaved,
}: AccompanimentDialogProps) {
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const [timeSpent, setTimeSpent] = useState('')
  const [timeError, setTimeError] = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const validateTimeSpent = (val: string): string => {
    return validateTimeSpentValue(val, true)
  }

  const parseTimeToSeconds = (val: string): number => {
    const s = parseDurationToSeconds(val)
    return s ?? 0
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      toast({
        title: 'Relato obrigatório',
        description: 'Descreva as ações realizadas durante o acompanhamento.',
        variant: 'destructive',
      })
      return
    }

    const err = validateTimeSpent(timeSpent)
    if (err) {
      setTimeError(err)
      return
    }

    const durationSeconds = parseTimeToSeconds(timeSpent)
    setSubmitting(true)

    try {
      await addAccompanimentHours(ticketId, {
        content: trimmed,
        duration_seconds: durationSeconds,
        duration_minutes: durationSeconds / 60,
        hour_type: 'Contratada',
        billing_status: 'Faturável',
        is_internal: isInternal,
      })

      toast({
        title: 'Acompanhamento registrado com sucesso!',
        description: 'O tempo foi somado em Horas de Acompanhamento.',
      })

      setContent('')
      setTimeSpent('')
      setTimeError('')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: 'Erro ao registrar acompanhamento',
        description: getErrorMessage(e),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-amber-500" />
            Registrar Horas de Acompanhamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Registre o relato do acompanhamento técnico realizado. O tempo gasto será registrado em
            um log no chamado e somado em Horas de Acompanhamento.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Relato / Log de Acompanhamento *</Label>
            <Textarea
              placeholder="Descreva detalhadamente o acompanhamento efetuado..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[110px] text-sm"
            />
          </div>

          <div className="space-y-1 max-w-xs">
            <Label className="text-xs font-medium">Tempo Gasto (00:00:00) *</Label>
            <DurationInput
              placeholder="00:00:00"
              value={timeSpent}
              onChange={(val) => {
                setTimeSpent(val)
                setTimeError(validateTimeSpent(val))
              }}
              className="h-8 w-32 text-center font-mono text-sm tracking-wider"
            />
            {timeError ? (
              <p className="text-[11px] text-red-500">{timeError}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Digite horas, minutos e segundos livremente (ex.: 02:00:00).
              </p>
            )}
          </div>

          <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-border text-amber-500 focus:ring-amber-500"
            />
            <span>Nota interna (visível apenas para a equipe técnica)</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar Acompanhamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
