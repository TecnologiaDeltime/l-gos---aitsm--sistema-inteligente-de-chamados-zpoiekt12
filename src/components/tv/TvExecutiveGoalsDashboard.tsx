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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  const { kpis, slaByPriority } = data

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* Bloco 1: KPIs Principais do Gerencial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#17181C] border-amber-500/30 text-white shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-amber-400">Chamados Abertos</p>
              <p className="text-3xl lg:text-4xl font-black text-white mt-1">{kpis.opened}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
              <Inbox className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-emerald-500/30 text-white shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-emerald-400">Resolvidos</p>
              <p className="text-3xl lg:text-4xl font-black text-emerald-400 mt-1">
                {kpis.resolved}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-amber-500/30 text-white shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-amber-400">Horas Consumidas</p>
              <p className="text-2xl lg:text-3xl font-black text-amber-300 mt-1 font-mono">
                {kpis.consumedDisplay}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
              <Timer className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-[#17181C] text-white shadow-xl border ${
            kpis.balanceHours < 0 ? 'border-red-500/50' : 'border-emerald-500/30'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p
                className={`text-xs uppercase font-semibold ${
                  kpis.balanceHours < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                Saldo de Horas
              </p>
              <p
                className={`text-2xl lg:text-3xl font-black mt-1 font-mono ${
                  kpis.balanceHours < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {kpis.balanceDisplay}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                kpis.balanceHours < 0
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              <Hourglass className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloco 2: Painel "Cumprimento de Meta por Prioridade" (Gauges do Dashboard Gerencial) */}
      <Card className="bg-[#17181C] border-amber-500/30 text-white flex-1 p-6 flex flex-col justify-between shadow-2xl">
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div>
              <h3 className="text-2xl lg:text-3xl font-black text-amber-300 tracking-tight">
                Cumprimento de Meta por Prioridade
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Aderência às metas de SLA contratual por nível de criticidade
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Referência Contratual</span>
              <p className="text-xs font-semibold text-amber-400">
                Verde ≥ 90% · Amarelo ≥ 80% · Vermelho &lt; 80%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
            {slaByPriority.map((d) => (
              <div
                key={d.priority}
                className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center"
              >
                <SlaGauge data={d} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10 text-xs text-slate-400">
          <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
            <span className="font-semibold text-slate-300">Total de Horas Contratadas:</span>
            <span className="font-mono text-base font-bold text-white">
              {kpis.contractedDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
            <span className="font-semibold text-slate-300">Total de Chamados Fechados:</span>
            <span className="font-mono text-base font-bold text-white">{kpis.closed}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
