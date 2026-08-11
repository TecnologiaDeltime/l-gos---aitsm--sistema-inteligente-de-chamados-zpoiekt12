import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Download } from 'lucide-react'
import {
  getTravelEntries,
  createTravelEntry,
  TravelEntryRecord,
  TRANSPORT_MODES,
} from '@/services/travel-entries'
import { getUsers } from '@/services/users'
import { exportToCsv } from '@/lib/export-utils'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function TravelEntriesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [entries, setEntries] = useState<TravelEntryRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    origin_address: '',
    destination_address: '',
    travel_date: '',
    departure_time: '',
    arrival_time: '',
    actual_distance: '',
    transport_mode: 'Veículo Próprio',
    tolls: '',
    parking: '',
    fuel: '',
    other_costs: '',
    notes: '',
  })

  const loadData = () => {
    getTravelEntries()
      .then(setEntries)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
    getUsers()
      .then(setTechs)
      .catch(() => {})
  }, [])
  useRealtime('travel_entries', () => loadData())

  const handleSubmit = async () => {
    setErrors({})
    try {
      await createTravelEntry({
        technician: user?.id,
        origin_address: form.origin_address,
        destination_address: form.destination_address,
        travel_date: form.travel_date,
        departure_time: form.departure_time,
        arrival_time: form.arrival_time,
        actual_distance: form.actual_distance ? parseFloat(form.actual_distance) : undefined,
        transport_mode: form.transport_mode,
        tolls: form.tolls ? parseFloat(form.tolls) : undefined,
        parking: form.parking ? parseFloat(form.parking) : undefined,
        fuel: form.fuel ? parseFloat(form.fuel) : undefined,
        other_costs: form.other_costs ? parseFloat(form.other_costs) : undefined,
        notes: form.notes,
      } as any)
      toast({ title: 'Deslocamento registrado!' })
      setShowForm(false)
      setForm({
        origin_address: '',
        destination_address: '',
        travel_date: '',
        departure_time: '',
        arrival_time: '',
        actual_distance: '',
        transport_mode: 'Veículo Próprio',
        tolls: '',
        parking: '',
        fuel: '',
        other_costs: '',
        notes: '',
      })
      loadData()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao registrar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Deslocamentos</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv(
                'deslocamentos.csv',
                entries.map((e) => ({
                  Origem: e.origin_address,
                  Destino: e.destination_address,
                  Data: e.travel_date,
                  KM: e.actual_distance,
                  Custos: (e.tolls || 0) + (e.parking || 0) + (e.fuel || 0),
                })),
                ['Origem', 'Destino', 'Data', 'KM', 'Custos'],
              )
            }
          >
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Técnico</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Rota</th>
                  <th className="p-3">KM</th>
                  <th className="p-3">Custos</th>
                  <th className="p-3">Transporte</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhum deslocamento.
                    </td>
                  </tr>
                ) : (
                  entries.slice(0, 50).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        {techs.find((t) => t.id === e.technician)?.name || '-'}
                      </td>
                      <td className="p-3">
                        {e.travel_date ? new Date(e.travel_date).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {e.origin_address || '?'} → {e.destination_address || '?'}
                      </td>
                      <td className="p-3 font-medium">{(e.actual_distance || 0).toFixed(1)}km</td>
                      <td className="p-3">
                        R${' '}
                        {(
                          (e.tolls || 0) +
                          (e.parking || 0) +
                          (e.fuel || 0) +
                          (e.other_costs || 0)
                        ).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[9px]">
                          {e.transport_mode || '-'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Deslocamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Origem</Label>
              <Input
                value={form.origin_address}
                onChange={(e) => setForm({ ...form, origin_address: e.target.value })}
                className="h-9"
              />
              {errors.origin_address && (
                <p className="text-xs text-red-500">{errors.origin_address}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Destino</Label>
              <Input
                value={form.destination_address}
                onChange={(e) => setForm({ ...form, destination_address: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={form.travel_date}
                  onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">KM</Label>
                <Input
                  type="number"
                  value={form.actual_distance}
                  onChange={(e) => setForm({ ...form, actual_distance: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Saída</Label>
                <Input
                  type="time"
                  value={form.departure_time}
                  onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Chegada</Label>
                <Input
                  type="time"
                  value={form.arrival_time}
                  onChange={(e) => setForm({ ...form, arrival_time: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Transporte</Label>
              <Select
                value={form.transport_mode}
                onValueChange={(v) => setForm({ ...form, transport_mode: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_MODES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Pedágio</Label>
                <Input
                  type="number"
                  value={form.tolls}
                  onChange={(e) => setForm({ ...form, tolls: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Estacion.</Label>
                <Input
                  type="number"
                  value={form.parking}
                  onChange={(e) => setForm({ ...form, parking: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Combust.</Label>
                <Input
                  type="number"
                  value={form.fuel}
                  onChange={(e) => setForm({ ...form, fuel: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Outros</Label>
                <Input
                  type="number"
                  value={form.other_costs}
                  onChange={(e) => setForm({ ...form, other_costs: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
