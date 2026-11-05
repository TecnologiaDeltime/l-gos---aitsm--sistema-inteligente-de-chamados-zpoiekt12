import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock, Archive } from 'lucide-react'
import type { TicketStatusSummary } from '@/services/tv-mode'

interface TvStatusTicketsDashboardProps {
  data: TicketStatusSummary[]
  loading?: boolean
}

export function TvStatusTicketsDashboard({ data, loading }: TvStatusTicketsDashboardProps) {
  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data])

  const activeTickets = useMemo(
    () =>
      data
        .filter((d) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(d.status))
        .reduce((acc, curr) => acc + curr.count, 0),
    [data],
  )

  const resolvedTickets = useMemo(
    () =>
      data
        .filter((d) => ['Resolvido', 'Encerrado'].includes(d.status))
        .reduce((acc, curr) => acc + curr.count, 0),
    [data],
  )

  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* 3 Top Big Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-[#17181C] border-amber-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Total de Chamados
              </p>
              <p className="text-4xl lg:text-6xl font-black text-white mt-1">{total}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Archive className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-amber-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Chamados Ativos / Em Aberto
              </p>
              <p className="text-4xl lg:text-6xl font-black text-amber-300 mt-1">{activeTickets}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-emerald-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                Resolvidos / Encerrados
              </p>
              <p className="text-4xl lg:text-6xl font-black text-emerald-400 mt-1">
                {resolvedTickets}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Status com Barras de Progresso Grandes e Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto pr-1">
        {data.map((item) => {
          const isResolved = ['Resolvido', 'Encerrado'].includes(item.status)
          const isAlert = ['Novo', 'Reaberto', 'Aguardando Aprovação'].includes(item.status)

          let colorClass = 'border-amber-500/20 text-amber-300'
          let barBg = 'bg-amber-500'
          if (isResolved) {
            colorClass = 'border-emerald-500/30 text-emerald-400'
            barBg = 'bg-emerald-500'
          } else if (isAlert) {
            colorClass = 'border-amber-400/40 text-amber-400'
            barBg = 'bg-amber-400'
          }

          return (
            <Card
              key={item.status}
              className={`bg-[#17181C] ${colorClass} p-5 flex flex-col justify-between shadow-lg hover:border-amber-500/60 transition-all`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-lg lg:text-xl font-bold text-white tracking-tight">
                    {item.status}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.percentage}% do volume total
                  </p>
                </div>
                <span className="text-3xl lg:text-4xl font-extrabold text-amber-300">
                  {item.count}
                </span>
              </div>

              {/* Barra de Proporção */}
              <div className="mt-4">
                <div className="h-3 w-full rounded-full bg-black/60 overflow-hidden border border-white/10">
                  <div
                    className={`h-full rounded-full ${barBg} transition-all duration-700`}
                    style={{ width: `${Math.max(4, Math.min(100, item.percentage))}%` }}
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
