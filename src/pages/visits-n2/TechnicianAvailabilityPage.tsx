import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { getTechnicianAvailability, TechnicianAvailabilityRecord } from '@/services/visit-extras'
import { getTechnicianLocations } from '@/services/visit-extras'
import { getUsers } from '@/services/users'
import { useRealtime } from '@/hooks/use-realtime'

const AVAIL_STATUSES = [
  'Disponível',
  'Em Deslocamento',
  'Em Serviço Remoto',
  'Em Serviço Presencial',
  'Em Pausa',
  'Em Reunião',
  'Indisponível',
  'Fora do Horário',
  'Em Treinamento',
  'Em Plantão',
  'Finalizando Serviço',
  'Aguardando Cliente',
]

export default function TechnicianAvailabilityPage() {
  const [avail, setAvail] = useState<TechnicianAvailabilityRecord[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [techs, setTechs] = useState<any[]>([])

  const loadData = async () => {
    try {
      const [a, l, t] = await Promise.all([
        getTechnicianAvailability(),
        getTechnicianLocations(),
        getUsers(),
      ])
      setAvail(a)
      setLocations(l)
      setTechs(t)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('technician_availability', () => loadData())
  useRealtime('technician_locations', () => loadData())

  const activeTechs = techs.filter((t: any) => ['tecnico', 'gestor', 'admin'].includes(t.role))

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Calendar className="h-5 w-5" /> Disponibilidade de Operadores
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disponibilidade</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y">
                  <tr>
                    <th className="p-3">Operador</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Turno</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {avail.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        Sem registros.
                      </td>
                    </tr>
                  ) : (
                    avail.slice(0, 30).map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="p-3">{a.expand?.technician?.name || '-'}</td>
                        <td className="p-3">
                          {a.date ? new Date(a.date).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="p-3">
                          {a.shift_start || '-'} - {a.shift_end || '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[9px]">
                            {a.status || '-'}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Localização Atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {locations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Sem localizações ativas.</p>
            ) : (
              locations.map((l) => (
                <div key={l.id} className="border rounded-lg p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold">
                      {l.expand?.technician?.name || 'N/A'}
                    </span>
                    <Badge variant="outline" className="text-[9px]">
                      {l.status || 'N/A'}
                    </Badge>
                  </div>
                  {l.lat && l.lon && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {l.lat}, {l.lon}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
