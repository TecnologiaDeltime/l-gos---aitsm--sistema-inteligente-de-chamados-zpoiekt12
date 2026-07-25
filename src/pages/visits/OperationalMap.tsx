import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Clock, User } from 'lucide-react'
import { getTechnicianLocations, TechnicianLocationRecord } from '@/services/visit-extras'
import { getUsers } from '@/services/users'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'

const STATUS_CLS: Record<string, string> = {
  Disponível: 'bg-green-100 text-green-700',
  'Em Deslocamento': 'bg-blue-100 text-blue-700',
  'Em Serviço': 'bg-amber-100 text-amber-700',
  Indisponível: 'bg-red-100 text-red-700',
  'Fora do Horário': 'bg-slate-100 text-slate-600',
}

export default function OperationalMap() {
  const [locations, setLocations] = useState<TechnicianLocationRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const perms = usePermissions()

  const loadData = async () => {
    try {
      setLocations(await getTechnicianLocations())
      setTechs(await getUsers())
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('technician_locations', () => loadData())

  const canViewLocation = perms.isAdmin || perms.isGestor || perms.role === 'auditor'

  if (!canViewLocation) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          Você não tem permissão para visualizar localização de técnicos.
        </CardContent>
      </Card>
    )
  }

  const activeTechs = locations.filter((l) => l.expand?.technician)
  const selected = locations.find((l) => l.technician === selectedTech)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <MapPin className="h-5 w-5" /> Mapa Operacional
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="h-[500px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900" />
                <div className="relative z-10 text-center">
                  <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Mapa Interativo</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeTechs.length} técnicos ativos no mapa
                  </p>
                </div>
                {activeTechs.slice(0, 20).map((loc, i) => {
                  const left = 10 + ((i * 37) % 80)
                  const top = 15 + ((i * 53) % 70)
                  return (
                    <div
                      key={loc.id}
                      className="absolute cursor-pointer"
                      style={{ left: `${left}%`, top: `${top}%` }}
                      onClick={() => setSelectedTech(loc.technician)}
                    >
                      <div
                        className={`p-1.5 rounded-full border-2 border-white shadow-lg ${
                          loc.status === 'Disponível'
                            ? 'bg-green-500'
                            : loc.status === 'Em Deslocamento'
                              ? 'bg-blue-500'
                              : loc.status === 'Em Serviço'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                        }`}
                      >
                        <User className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Técnicos no Campo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[460px] overflow-y-auto">
              {activeTechs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhuma localização ativa.
                </p>
              ) : (
                activeTechs.map((loc) => {
                  const tech = loc.expand?.technician
                  return (
                    <div
                      key={loc.id}
                      className={`border rounded-lg p-2 cursor-pointer hover:bg-slate-50 ${selectedTech === loc.technician ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setSelectedTech(loc.technician)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{tech?.name || 'N/A'}</span>
                        <Badge className={`text-[9px] ${STATUS_CLS[loc.status || 'Indisponível']}`}>
                          {loc.status || 'Indisponível'}
                        </Badge>
                      </div>
                      {loc.lat && loc.lon && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {loc.lat}, {loc.lon}
                        </p>
                      )}
                      {loc.updated_at_location && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />{' '}
                          {new Date(loc.updated_at_location).toLocaleTimeString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detalhes do Técnico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="font-semibold">{selected.expand?.technician?.name || 'N/A'}</p>
                <p className="text-slate-500">
                  Status:{' '}
                  <Badge className={`text-[9px] ${STATUS_CLS[selected.status || 'Indisponível']}`}>
                    {selected.status}
                  </Badge>
                </p>
                {selected.expand?.current_ticket && (
                  <p className="text-slate-500">
                    Ticket atual: #{selected.expand.current_ticket.number}
                  </p>
                )}
                {selected.expand?.current_client && (
                  <p className="text-slate-500">
                    Cliente: {selected.expand.current_client.trade_name}
                  </p>
                )}
                <p className="text-slate-400 text-[10px]">
                  Consentimento: {selected.consent_given ? 'Sim' : 'Não'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
