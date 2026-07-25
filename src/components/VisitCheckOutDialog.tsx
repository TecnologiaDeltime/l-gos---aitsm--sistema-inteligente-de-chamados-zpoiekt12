import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { checkoutVisit } from '@/services/technical-visits'
import { useToast } from '@/hooks/use-toast'

export function VisitCheckOutDialog({
  visitId,
  open,
  onOpenChange,
  onDone,
}: {
  visitId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone?: () => void
}) {
  const { toast } = useToast()
  const [result, setResult] = useState('')
  const [activities, setActivities] = useState('')
  const [pendingItems, setPendingItems] = useState('')
  const [returnNeeded, setReturnNeeded] = useState(false)
  const [initialOdo, setInitialOdo] = useState('')
  const [finalOdo, setFinalOdo] = useState('')
  const [travelTimeIn, setTravelTimeIn] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [travelTimeOut, setTravelTimeOut] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!result.trim() || !activities.trim()) {
      toast({ title: 'Resultado e atividades são obrigatórios', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const total =
        (parseInt(travelTimeIn) || 0) +
        (parseInt(serviceTime) || 0) +
        (parseInt(travelTimeOut) || 0)
      await checkoutVisit(visitId, {
        result,
        activities_performed: activities,
        pending_items: pendingItems,
        return_needed: returnNeeded,
        initial_odometer: initialOdo ? parseFloat(initialOdo) : 0,
        final_odometer: finalOdo ? parseFloat(finalOdo) : 0,
        travel_time_in: travelTimeIn ? parseInt(travelTimeIn) : 0,
        service_time: serviceTime ? parseInt(serviceTime) : 0,
        travel_time_out: travelTimeOut ? parseInt(travelTimeOut) : 0,
        total_time: total,
      })
      toast({ title: 'Check-out realizado com sucesso!' })
      onOpenChange(false)
      onDone?.()
    } catch {
      toast({ title: 'Erro no check-out', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-out de Visita</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Resultado da Visita *</Label>
            <Textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={2}
              placeholder="Descreva o resultado..."
            />
          </div>
          <div>
            <Label className="text-xs">Atividades Realizadas *</Label>
            <Textarea
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              rows={3}
              placeholder="Liste as atividades..."
            />
          </div>
          <div>
            <Label className="text-xs">Itens Pendentes</Label>
            <Textarea
              value={pendingItems}
              onChange={(e) => setPendingItems(e.target.value)}
              rows={2}
              placeholder="Itens pendentes (opcional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Odômetro Inicial</Label>
              <Input
                type="number"
                value={initialOdo}
                onChange={(e) => setInitialOdo(e.target.value)}
                className="h-9"
                placeholder="km"
              />
            </div>
            <div>
              <Label className="text-xs">Odômetro Final</Label>
              <Input
                type="number"
                value={finalOdo}
                onChange={(e) => setFinalOdo(e.target.value)}
                className="h-9"
                placeholder="km"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tempo Ida (min)</Label>
              <Input
                type="number"
                value={travelTimeIn}
                onChange={(e) => setTravelTimeIn(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Tempo Serviço (min)</Label>
              <Input
                type="number"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Tempo Volta (min)</Label>
              <Input
                type="number"
                value={travelTimeOut}
                onChange={(e) => setTravelTimeOut(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={returnNeeded}
              onCheckedChange={(v) => setReturnNeeded(!!v)}
              id="return"
            />
            <Label htmlFor="return" className="text-xs cursor-pointer">
              Necessita retorno
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !result.trim() || !activities.trim()}>
            {loading ? 'Processando...' : 'Confirmar Check-out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
