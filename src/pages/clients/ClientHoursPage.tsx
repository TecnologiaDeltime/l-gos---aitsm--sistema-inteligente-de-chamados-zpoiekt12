import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ClientHoursBreakdownDialog } from '@/components/ClientHoursBreakdownDialog'
import { ClientHoursHistoryDialog } from '@/components/ClientHoursHistoryDialog'
import { getClientHoursData, type ClientHoursData } from '@/services/client-hours'
import { useRealtime } from '@/hooks/use-realtime'
import { AlertCircle, RefreshCw, ChevronRight, Building2, History } from 'lucide-react'

function getColorClass(pct: number) {
  if (pct >= 100) return 'text-red-500'
  if (pct >= 80) return 'text-yellow-500'
  return 'text-green-500'
}

export default function ClientHoursPage() {
  const [data, setData] = useState<ClientHoursData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null)
  const [historyClient, setHistoryClient] = useState<{ id: string; name: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getClientHoursData()
      setData(result)
    } catch {
      setError('Falha ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('contract_periods', () => loadData())
  useRealtime('ticket_interactions', () => loadData())

  const handleRowClick = (item: ClientHoursData) => {
    setSelectedClient({
      id: item.company.id,
      name: item.company.trade_name || item.company.legal_name,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Horas Clientes</h2>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 space-y-3">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
          <p>Nenhum cliente com contrato ativo no mês atual.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">
                        Cliente
                      </th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                        Contratado
                      </th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                        Consumido
                      </th>
                      <th className="text-center p-4 text-xs font-medium text-muted-foreground">
                        % Consumo
                      </th>
                      <th className="text-center p-4 text-xs font-medium text-muted-foreground">
                        Histórico
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((item) => (
                      <tr
                        key={item.company.id}
                        className="cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => handleRowClick(item)}
                      >
                        <td className="p-4">
                          <p className="text-sm font-semibold">
                            {item.company.trade_name || item.company.legal_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.company.code}</p>
                        </td>
                        <td className="p-4 text-right text-sm">
                          {item.contractedHours.toFixed(1)}h
                        </td>
                        <td className="p-4 text-right text-sm">{item.consumedHours.toFixed(1)}h</td>
                        <td className="p-4 text-center">
                          <span className={`text-3xl font-bold ${getColorClass(item.percentage)}`}>
                            {item.percentage.toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHistoryClient({
                                id: item.company.id,
                                name: item.company.trade_name || item.company.legal_name,
                              })
                            }}
                          >
                            <History className="h-3.5 w-3.5 mr-1" />
                            Ver Histórico
                          </Button>
                        </td>
                        <td className="p-4">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:hidden">
            {data.map((item) => (
              <Card
                key={item.company.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRowClick(item)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {item.company.trade_name || item.company.legal_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.company.code}</p>
                    </div>
                    <span
                      className={`text-3xl font-bold shrink-0 ml-2 ${getColorClass(item.percentage)}`}
                    >
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Contratado: {item.contractedHours.toFixed(1)}h</span>
                    <span>Consumido: {item.consumedHours.toFixed(1)}h</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setHistoryClient({
                        id: item.company.id,
                        name: item.company.trade_name || item.company.legal_name,
                      })
                    }
                  >
                    <History className="h-3.5 w-3.5 mr-1" />
                    Ver Histórico
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <ClientHoursBreakdownDialog
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        companyId={selectedClient?.id || ''}
        clientName={selectedClient?.name || ''}
      />

      <ClientHoursHistoryDialog
        open={!!historyClient}
        onClose={() => setHistoryClient(null)}
        companyId={historyClient?.id || ''}
        clientName={historyClient?.name || ''}
      />
    </div>
  )
}
