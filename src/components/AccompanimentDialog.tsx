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
import { HOUR_TYPES, BILLING_STATUSES } from '@/services/ticket-interactions'
import { addAccompanimentHours } from '@/services/tickets'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

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
  const [hourType, setHourType] = useState('Contratada')
  const [billingStatus, setBillingStatus] = useState('Faturável')
  const [isInternal, setIsInternal] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const validateTimeSpent = (val: string): string => {
    if (!val.trim()) return 'Informe o tempo gasto no acompanhamento.'
    const match = val.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return 'Formato inválido. Use hh:mm (ex: 00:30).'
    const mins = parseInt(match[2], 10)
    if (mins > 59) return 'Minutos inválidos (máximo 59).'
    const totalMin = parseInt(match[1], 10) * 60 + mins
    if (totalMin <= 0) return 'O tempo deve ser maior que 00:00.'
    return ''
  }

  const parseTimeToSeconds = (val: string): number => {
    const match = val.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return 0
    return (parseInt(match[1], 10) * 60 + parseInt(match[2], 10)) * 60
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
        hour_type: hourType,
        billing_status: billingStatus,
        is_internal: isInternal,
      })

      toast({
        title: 'Acompanhamento registrado com sucesso!',
        description: 'O tempo foi somado em Horas de Acompanhamento e Horas Trabalhadas.',
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
            um log no chamado e somado diretamente no Total de Horas Trabalhadas.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tempo Gasto (hh:mm) *</Label>
              <Input
                placeholder="00:30"
                value={timeSpent}
                onChange={(e) => {
                  setTimeSpent(e.target.value)
                  setTimeError(validateTimeSpent(e.target.value))
                }}
                className="h-8 text-sm font-mono"
              />
              {timeError && <p className="text-[11px] text-red-500">{timeError}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Tipo de Hora</Label>
              <Select value={hourType} onValueChange={setHourType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Faturamento</Label>
              <Select value={billingStatus} onValueChange={setBillingStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
