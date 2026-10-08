import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Plus } from 'lucide-react'
import { getKmRates, createKmRate, KmRateRecord } from '@/services/visit-extras'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { getContracts } from '@/services/contracts'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

const VEHICLE_TYPES = ['Veículo Próprio', 'Veículo da Empresa', 'Moto', 'Outro']

export default function KmRatesPage() {
  const { toast } = useToast()
  const [rates, setRates] = useState<KmRateRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    rate_per_km: '',
    vehicle_type: 'Veículo Próprio',
    technician: '',
    client: '',
    contract: '',
    min_distance: '',
    max_distance: '',
    effective_date: '',
    active: true,
  })

  const loadData = () => {
    getKmRates()
      .then(setRates)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
    getUsers()
      .then(setTechs)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getContracts()
      .then(setContracts)
      .catch(() => {})
  }, [])
  useRealtime('km_rates', () => loadData())

  const handleSubmit = async () => {
    try {
      await createKmRate({
        ...form,
        rate_per_km: parseFloat(form.rate_per_km),
        min_distance: form.min_distance ? parseFloat(form.min_distance) : undefined,
        max_distance: form.max_distance ? parseFloat(form.max_distance) : undefined,
        effective_date: form.effective_date || undefined,
      } as any)
      toast({ title: 'Taxa criada!' })
      setShowForm(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao criar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Taxas de KM</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Taxa
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">R$/KM</th>
                  <th className="p-3">Veículo</th>
                  <th className="p-3">Operador</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Distância</th>
                  <th className="p-3">Vigência</th>
                  <th className="p-3">Ativo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      Nenhuma taxa cadastrada.
                    </td>
                  </tr>
                ) : (
                  rates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold">R$ {(r.rate_per_km || 0).toFixed(2)}</td>
                      <td className="p-3">{r.vehicle_type || '-'}</td>
                      <td className="p-3">
                        {techs.find((t) => t.id === r.technician)?.name || '-'}
                      </td>
                      <td className="p-3">
                        {companies.find((c) => c.id === r.client)?.trade_name || '-'}
                      </td>
                      <td className="p-3">
                        {r.min_distance || 0} - {r.max_distance || '∞'}km
                      </td>
                      <td className="p-3">
                        {r.effective_date
                          ? new Date(r.effective_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="p-3">
                        {r.active ? (
                          <Badge className="bg-green-100 text-green-800 text-[9px]">Sim</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px]">
                            Não
                          </Badge>
                        )}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Taxa de KM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">R$ por KM *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.rate_per_km}
                onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo de Veículo</Label>
              <Select
                value={form.vehicle_type}
                onValueChange={(v) => setForm({ ...form, vehicle_type: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Operador</Label>
              <Select
                value={form.technician}
                onValueChange={(v) => setForm({ ...form, technician: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {techs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dist. Mín (km)</Label>
                <Input
                  type="number"
                  value={form.min_distance}
                  onChange={(e) => setForm({ ...form, min_distance: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Dist. Máx (km)</Label>
                <Input
                  type="number"
                  value={form.max_distance}
                  onChange={(e) => setForm({ ...form, max_distance: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Data de Vigência</Label>
              <Input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-xs">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!form.rate_per_km}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
