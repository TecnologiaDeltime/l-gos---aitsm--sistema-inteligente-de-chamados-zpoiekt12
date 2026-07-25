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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Camera } from 'lucide-react'
import { checkinVisit } from '@/services/technical-visits'
import { useToast } from '@/hooks/use-toast'

export function VisitCheckInDialog({
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
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [radius, setRadius] = useState('300')
  const [justification, setJustification] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Geolocalização não suportada', variant: 'destructive' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toString())
        setLon(pos.coords.longitude.toString())
        toast({ title: 'Localização capturada!' })
      },
      () => toast({ title: 'Erro ao obter localização', variant: 'destructive' }),
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await checkinVisit(visitId, { lat, lon, radius: parseInt(radius), justification })
      toast({ title: 'Check-in realizado com sucesso!' })
      onOpenChange(false)
      onDone?.()
    } catch {
      toast({ title: 'Erro no check-in', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in de Visita</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Raio de Validação</Label>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100m</SelectItem>
                <SelectItem value="300">300m</SelectItem>
                <SelectItem value="500">500m</SelectItem>
                <SelectItem value="1000">1km</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="h-9"
                placeholder="-23.5..."
              />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="h-9"
                placeholder="-46.6..."
              />
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleGetCurrentLocation}>
            <MapPin className="mr-2 h-4 w-4" /> Capturar Localização Atual
          </Button>
          <div>
            <Label className="text-xs">Justificativa (se fora do raio)</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={2}
              placeholder="Justifique se estiver fora do raio permitido"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !lat || !lon}>
            {loading ? 'Processando...' : 'Confirmar Check-in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
