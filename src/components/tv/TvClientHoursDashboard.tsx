import { Card } from '@/components/ui/card'
import { formatSeconds } from '@/lib/duration'
import { AlertTriangle, Building2 } from 'lucide-react'
import type { ClientHoursData } from '@/services/client-hours'

interface TvClientHoursDashboardProps {
  data: ClientHoursData[]
  loading?: boolean
}

export function TvClientHoursDashboard({ data, loading }: TvClientHoursDashboardProps) {
  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 p-2">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-[#17181C] border border-amber-500/30 flex items-center justify-between text-white">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-amber-300 tracking-tight">
            Consumo de Horas por Cliente
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cartões com Total Consumido em destaque grande, percentual e franquia contratada em
            00:00:00
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-slate-300">Normal (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="text-slate-300">Atenção (80-99%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-600" />
            <span className="text-slate-300">Estourado (≥100%)</span>
          </div>
        </div>
      </div>

      {/* Grid de Cartões por Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto pr-1">
        {data.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
            <Building2 className="h-12 w-12 mb-3 text-slate-500" />
            <p className="text-lg font-bold">
              Nenhum contrato ativo de horas encontrado para este mês
            </p>
          </div>
        ) : (
          data.map((item) => {
            const pct = Math.round(item.percentage)
            const isExceeded = pct >= 100
            const isWarning = pct >= 80 && pct < 100

            let borderColor = 'border-amber-500/25'
            let pctColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            let barColor = 'bg-emerald-500'

            if (isExceeded) {
              borderColor = 'border-red-600 shadow-red-900/30'
              pctColor = 'text-red-400 bg-red-600/15 border-red-600/40 animate-pulse'
              barColor = 'bg-red-600'
            } else if (isWarning) {
              borderColor = 'border-yellow-500/60 shadow-yellow-900/20'
              pctColor = 'text-yellow-400 bg-yellow-500/15 border-yellow-500/40'
              barColor = 'bg-yellow-500'
            }

            const consumedFormatted = formatSeconds(item.consumedSeconds)
            const contractedFormatted = formatSeconds(item.contractedSeconds)

            return (
              <Card
                key={item.company.id}
                className={`bg-[#17181C] text-white flex flex-col justify-between p-5 border ${borderColor} shadow-xl hover:scale-[1.01] transition-transform`}
              >
                {/* Nome do Cliente e Percentual discreto */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 truncate">
                    <p className="text-lg lg:text-xl font-extrabold text-white truncate leading-tight">
                      {item.company.trade_name || item.company.legal_name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.company.legal_name}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black border ${pctColor}`}>
                    {pct}%
                  </div>
                </div>

                {/* Destaque Grande: HORAS CONSUMIDAS */}
                <div className="my-4 py-3 px-4 rounded-xl bg-black/50 border border-white/5 flex flex-col items-center justify-center">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Horas Consumidas
                  </span>
                  <span
                    className={`text-3xl lg:text-4xl font-black tracking-tight mt-1 ${
                      isExceeded ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-amber-300'
                    }`}
                  >
                    {consumedFormatted}
                  </span>
                </div>

                {/* Total Contratado & Barra */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
                    <span className="text-slate-400">Franquia Contratada:</span>
                    <span className="font-bold text-white font-mono">{contractedFormatted}</span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-black/70 overflow-hidden border border-white/10">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-700`}
                      style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                    />
                  </div>

                  {isExceeded && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold mt-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
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
