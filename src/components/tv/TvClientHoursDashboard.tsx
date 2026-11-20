import { Card } from '@/components/ui/card'
import { formatSeconds } from '@/lib/duration'
import { AlertTriangle, Building2 } from 'lucide-react'
import type { ClientHoursData } from '@/services/client-hours'

interface TvClientHoursDashboardProps {
  data: ClientHoursData[]
  loading?: boolean
  periodLabel?: string
}

export function TvClientHoursDashboard({
  data,
  loading,
  periodLabel,
}: TvClientHoursDashboardProps) {
  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#D97706] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Cabeçalho com legenda grande */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#D97706]/50 bg-[#17181C] p-5">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-[#FCD34D] lg:text-5xl">
            Consumo de Horas por Cliente
          </h2>
          <p className="mt-1 text-lg text-white/70">
            {periodLabel
              ? 'Horas consumidas no período e percentual da franquia contratada'
              : 'Horas consumidas no mês e percentual da franquia contratada'}
          </p>
          {periodLabel && (
            <span className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm font-bold uppercase tracking-wider text-amber-300">
              Período: {periodLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-lg font-bold text-white">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-[#FCD34D]" />
            <span>Normal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-[#D97706]" />
            <span>Atenção (80–99%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-red-600" />
            <span>Estourado (≥100%)</span>
          </div>
        </div>
      </div>

      {/* Grade de cartões por cliente */}
      <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {data.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/70">
            <Building2 className="mb-4 h-16 w-16 text-[#D97706]" />
            <p className="text-3xl font-black">Nenhum contrato ativo de horas neste mês</p>
          </div>
        ) : (
          data.map((item) => {
            const pct = Math.round(item.percentage)
            const isExceeded = pct >= 100
            const isWarning = pct >= 80 && pct < 100

            let borderColor = 'border-[#D97706]/40'
            let pctClass = 'bg-[#FCD34D] text-[#17181C]'
            let barColor = 'bg-[#FCD34D]'
            let consumedClass = 'text-[#FCD34D]'

            if (isExceeded) {
              borderColor = 'border-red-600'
              pctClass = 'bg-red-600 text-white'
              barColor = 'bg-red-600'
              consumedClass = 'text-red-500'
            } else if (isWarning) {
              borderColor = 'border-[#D97706]'
              pctClass = 'bg-[#D97706] text-white'
              barColor = 'bg-[#D97706]'
              consumedClass = 'text-[#D97706]'
            }

            const consumedFormatted = formatSeconds(item.consumedSeconds)
            const contractedFormatted = formatSeconds(item.contractedSeconds)

            return (
              <Card
                key={item.company.id}
                className={`flex flex-col justify-between border-2 ${borderColor} bg-[#17181C] p-6 text-white`}
              >
                {/* Nome do cliente e percentual */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-3xl font-black leading-tight text-white">
                      {item.company.trade_name || item.company.legal_name}
                    </p>
                    <p className="mt-1 truncate text-base text-white/60">
                      {item.company.legal_name}
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-xl px-4 py-2 text-3xl font-black ${pctClass}`}>
                    {pct}%
                  </div>
                </div>

                {/* Destaque: horas consumidas */}
                <div className="my-5 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/50 px-4 py-4">
                  <span className="text-base font-bold uppercase tracking-wider text-white/70">
                    Horas consumidas
                  </span>
                  <span
                    className={`mt-1 font-mono text-6xl font-black tracking-tight ${consumedClass}`}
                  >
                    {consumedFormatted}
                  </span>
                </div>

                {/* Franquia e barra */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-xl font-semibold">
                    <span className="text-white/70">Franquia contratada</span>
                    <span className="font-mono text-2xl font-black text-white">
                      {contractedFormatted}
                    </span>
                  </div>

                  <div className="h-4 w-full overflow-hidden rounded-full border border-white/15 bg-black/70">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-700`}
                      style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                    />
                  </div>

                  {isExceeded && (
                    <div className="mt-3 flex items-center gap-2 text-xl font-black text-red-500">
                      <AlertTriangle className="h-6 w-6" />
                      <span>Franquia estourada</span>
                    </div>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
