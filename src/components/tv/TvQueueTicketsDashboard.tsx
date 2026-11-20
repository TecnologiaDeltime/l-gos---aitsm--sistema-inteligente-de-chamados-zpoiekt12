import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Layers, Ticket } from 'lucide-react'
import type { QueueTicketsSummary } from '@/services/tv-mode'

interface TvQueueTicketsDashboardProps {
  data: QueueTicketsSummary[]
  loading?: boolean
  periodLabel?: string
}

export function TvQueueTicketsDashboard({
  data,
  loading,
  periodLabel,
}: TvQueueTicketsDashboardProps) {
  const totalAllTickets = useMemo(() => data.reduce((acc, q) => acc + q.total, 0), [data])

  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* Legenda discreta do período aplicado */}
      {periodLabel && (
        <div className="flex items-center justify-end">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm font-bold uppercase tracking-wider text-amber-300">
            Período: {periodLabel}
          </span>
        </div>
      )}

      {/* Top Banner KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#17181C]/90 border-amber-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold uppercase tracking-wider text-amber-400">
                Total de Filas Ativas
              </p>
              <p className="text-5xl lg:text-6xl font-black text-white mt-2">{data.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Layers className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C]/90 border-amber-500/40 text-white shadow-xl md:col-span-2">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold uppercase tracking-wider text-amber-400">
                Total Geral de Chamados nas Filas
              </p>
              <p className="text-5xl lg:text-7xl font-black text-amber-300 mt-2">
                {totalAllTickets}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Ticket className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Filas em Cartões Grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 overflow-y-auto pr-1">
        {data.map((item) => {
          const statuses = Object.entries(item.byStatus).sort((a, b) => b[1] - a[1])
          return (
            <Card
              key={item.queue.id}
              className="bg-[#17181C] border-amber-500/25 text-white flex flex-col justify-between hover:border-amber-500/50 transition-colors shadow-lg"
            >
              <CardHeader className="pb-3 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-2xl lg:text-3xl font-black text-amber-300 tracking-tight truncate">
                      {item.queue.name}
                    </CardTitle>
                    {item.queue.level && (
                      <Badge className="mt-1 bg-amber-500/20 text-amber-300 border-amber-500/40 text-sm font-bold">
                        {item.queue.level}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-5xl lg:text-6xl font-black text-white leading-none">
                      {item.total}
                    </span>
                    <p className="text-xs lg:text-sm uppercase font-bold tracking-wider text-slate-400">
                      chamados
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 flex-1 flex flex-col justify-center">
                {statuses.length === 0 ? (
                  <p className="text-base text-slate-400 italic text-center py-4">
                    Nenhum chamado nesta fila no momento
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {statuses.map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5"
                      >
                        <span className="text-sm lg:text-base font-semibold text-white truncate mr-2">
                          {status}
                        </span>
                        <span className="text-2xl lg:text-3xl font-black text-amber-400">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
