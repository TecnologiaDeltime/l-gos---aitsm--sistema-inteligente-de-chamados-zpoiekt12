import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { Car, DollarSign, Clock, AlertTriangle, MapPin } from 'lucide-react'
import { getTravelEntries, TravelEntryRecord } from '@/services/travel-entries'
import { getUsers } from '@/services/users'
import { exportToCsv } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'

export default function TravelDashboard() {
  const [entries, setEntries] = useState<TravelEntryRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])

  const loadData = async () => {
    try {
      setEntries(await getTravelEntries())
      setTechs(await getUsers())
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('travel_entries', () => loadData())

  const totalMileage = entries.reduce((s, e) => s + (e.actual_distance || 0), 0)
  const totalCost = entries.reduce(
    (s, e) => s + (e.tolls || 0) + (e.parking || 0) + (e.fuel || 0) + (e.other_costs || 0),
    0,
  )
  const divergent = entries.filter((e) => e.divergence && e.divergence > 10)
  const avgDistance = entries.length > 0 ? totalMileage / entries.length : 0

  const mileageByTech = techs
    .filter((t: any) => ['tecnico', 'gestor', 'admin'].includes(t.role))
    .map((t: any) => {
      const techEntries = entries.filter((e) => e.technician === t.id)
      return {
        name: t.name || 'N/A',
        km: techEntries.reduce((s, e) => s + (e.actual_distance || 0), 0),
      }
    })
    .filter((d) => d.km > 0)

  const chartConfig: ChartConfig = { km: { label: 'KM', color: 'hsl(var(--chart-1))' } }

  const kpis = [
    {
      label: 'KM Total',
      value: totalMileage.toFixed(0) + 'km',
      icon: Car,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Custo Total',
      value: 'R$ ' + totalCost.toFixed(2),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Distância Média',
      value: avgDistance.toFixed(1) + 'km',
      icon: MapPin,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Com Divergência',
      value: divergent.length,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard de Deslocamentos</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportToCsv(
              'deslocamentos.csv',
              entries.map((e) => ({
                Técnico: techs.find((t) => t.id === e.technician)?.name || '',
                Data: e.travel_date || '',
                Origem: e.origin_address || '',
                Destino: e.destination_address || '',
                KM: e.actual_distance || 0,
                Custos: (e.tolls || 0) + (e.parking || 0) + (e.fuel || 0),
              })),
              ['Técnico', 'Data', 'Origem', 'Destino', 'KM', 'Custos'],
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg ${k.bg} w-fit mb-2`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <p className="text-[10px] text-slate-500">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {mileageByTech.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">KM por Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={mileageByTech}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="km" fill="hsl(var(--chart-1))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registros de Deslocamento</CardTitle>
        </CardHeader>
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
                  <th className="p-3">Divergência</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhum deslocamento registrado.
                    </td>
                  </tr>
                ) : (
                  entries.slice(0, 20).map((e) => (
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
                        R$ {((e.tolls || 0) + (e.parking || 0) + (e.fuel || 0)).toFixed(2)}
                      </td>
                      <td className="p-3">
                        {e.divergence ? (
                          <Badge variant="outline" className="text-amber-700">
                            {e.divergence.toFixed(1)}%
                          </Badge>
                        ) : (
                          '-'
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
    </div>
  )
}
