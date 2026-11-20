import { Card, CardContent } from '@/components/ui/card'
import { SlaGauge } from '@/components/dashboard/SlaGauge'
import { Timer, Hourglass, CheckCircle2, Inbox } from 'lucide-react'
import type { TvMetasData } from '@/services/tv-mode'

interface TvExecutiveGoalsDashboardProps {
  data: TvMetasData | null
  loading?: boolean
}

export function TvExecutiveGoalsDashboard({ data, loading }: TvExecutiveGoalsDashboardProps) {
  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#D97706] border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  const { kpis, slaByPriority } = data
  const negative = kpis.balanceHours < 0

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Indicadores principais em destaque */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <Card className="border-2 border-[#D97706]/60 bg-[#17181C] text-white">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-lg font-bold uppercase text-[#FCD34D]">Chamados abertos</p>
              <p className="mt-2 text-6xl font-black text-white">{kpis.opened}</p>
            </div>
            <Inbox className="h-14 w-14 text-[#D97706]" />
          </CardContent>
        </Card>

        <Card className="border-2 border-[#FCD34D]/60 bg-[#17181C] text-white">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-lg font-bold uppercase text-[#FCD34D]">Resolvidos</p>
              <p className="mt-2 text-6xl font-black text-white">{kpis.resolved}</p>
            </div>
            <CheckCircle2 className="h-14 w-14 text-[#FCD34D]" />
          </CardContent>
        </Card>

        <Card className="border-2 border-[#D97706]/60 bg-[#17181C] text-white">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-lg font-bold uppercase text-[#FCD34D]">Horas consumidas</p>
              <p className="mt-2 font-mono text-4xl font-black text-white lg:text-5xl">
                {kpis.consumedDisplay}
              </p>
            </div>
            <Timer className="h-14 w-14 text-[#D97706]" />
          </CardContent>
        </Card>

        <Card
          className={`border-2 bg-[#17181C] text-white ${
            negative ? 'border-red-600' : 'border-[#FCD34D]/60'
          }`}
        >
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p
                className={`text-lg font-bold uppercase ${
                  negative ? 'text-red-500' : 'text-[#FCD34D]'
                }`}
              >
                Saldo de horas
              </p>
              <p
                className={`mt-2 font-mono text-4xl font-black lg:text-5xl ${
                  negative ? 'text-red-500' : 'text-white'
                }`}
              >
                {kpis.balanceDisplay}
              </p>
            </div>
            <Hourglass className={`h-14 w-14 ${negative ? 'text-red-500' : 'text-[#FCD34D]'}`} />
          </CardContent>
        </Card>
      </div>

      {/* Metas de SLA por prioridade */}
      <Card className="flex flex-1 flex-col justify-between border-2 border-[#D97706]/50 bg-[#17181C] p-6 text-white">
        <div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-4">
            <div>
              <h3 className="text-4xl font-black tracking-tight text-[#FCD34D] lg:text-5xl">
                Cumprimento de meta por prioridade
              </h3>
              <p className="mt-1 text-lg text-white/70">
                Aderência ao SLA contratual por nível de criticidade
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-white/70">Referência</p>
              <p className="text-lg font-black text-[#FCD34D]">
                Verde ≥ 90% · Amarelo ≥ 80% · Vermelho &lt; 80%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-2 md:grid-cols-4">
            {slaByPriority.map((d) => (
              <div
                key={d.priority}
                className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <SlaGauge data={d} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/15 pt-5 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 p-4">
            <span className="text-xl font-bold text-white/80">Total de horas contratadas</span>
            <span className="font-mono text-3xl font-black text-white">
              {kpis.contractedDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 p-4">
            <span className="text-xl font-bold text-white/80">Total de chamados fechados</span>
            <span className="font-mono text-3xl font-black text-white">{kpis.closed}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
