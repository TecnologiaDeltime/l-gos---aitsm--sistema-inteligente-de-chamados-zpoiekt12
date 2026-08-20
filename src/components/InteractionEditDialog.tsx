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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HOUR_TYPES, BILLING_STATUSES } from '@/services/ticket-interactions'
import { editInteractionWithRecalculation } from '@/services/ticket-interactions'
import { getErrorMessage, extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface InteractionEditDialogProps {
  interaction: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function InteractionEditDialog({
  interaction,
  open,
  onOpenChange,
  onSaved,
}: InteractionEditDialogProps) {
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const [duration, setDuration] = useState('')
  const [hourType, setHourType] = useState('Contratada')
  const [billingStatus, setBillingStatus] = useState('Faturável')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (interaction) {
      setContent(interaction.content || '')
      setDuration(String(interaction.duration_minutes || 0))
      setHourType(interaction.hour_type || 'Contratada')
      setBillingStatus(interaction.billing_status || 'Faturável')
      setFieldErrors({})
    }
  }, [interaction])

  const handleSave = async () => {
    if (!interaction) return
    setSaving(true)
    setFieldErrors({})
    try {
      const durationNum = parseInt(duration, 10)
      await editInteractionWithRecalculation(interaction.id, {
        content,
        duration_minutes: isNaN(durationNum) ? 0 : durationNum,
        hour_type: hourType,
        billing_status: billingStatus,
      })
      toast({ title: 'Interação atualizada e horas recalculadas!' })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao atualizar interação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Interação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Conteúdo</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Conteúdo da interação..."
            />
            {fieldErrors.content && <p className="text-xs text-red-500">{fieldErrors.content}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Duração (min)</Label>
              <Input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={interaction?.origin === 'Cronômetro'}
              />
              {interaction?.origin === 'Cronômetro' && (
                <p className="text-xs text-muted-foreground">
                  Horas de cronômetro não podem ser editadas.
                </p>
              )}
              {fieldErrors.duration_minutes && (
                <p className="text-xs text-red-500">{fieldErrors.duration_minutes}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de Hora</Label>
              <Select value={hourType} onValueChange={setHourType}>
                <SelectTrigger className="h-9">
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
            <div className="space-y-1.5">
              <Label className="text-sm">Faturamento</Label>
              <Select value={billingStatus} onValueChange={setBillingStatus}>
                <SelectTrigger className="h-9">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
