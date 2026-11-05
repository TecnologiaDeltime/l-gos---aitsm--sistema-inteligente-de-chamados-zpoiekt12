import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitPullRequest, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import type { ChangesSummary } from '@/services/tv-mode'

interface TvChangesDashboardProps {
  data: ChangesSummary | null
  loading?: boolean
}

export function TvChangesDashboard({ data, loading }: TvChangesDashboardProps) {
  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  const statusEntries = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* 3 Top Big Numbers: Abertas, Em Andamento, Fechadas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#17181C] border-amber-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Mudanças Abertas
              </p>
              <p className="text-4xl lg:text-6xl font-black text-amber-300 mt-2">{data.open}</p>
              <p className="text-xs text-slate-400 mt-1">
                Solicitadas, em avaliação ou aguardando aprovação
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-blue-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                Em Andamento
              </p>
              <p className="text-4xl lg:text-6xl font-black text-blue-300 mt-2">
                {data.inProgress}
              </p>
              <p className="text-xs text-slate-400 mt-1">Agendadas, em execução ou em validação</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Clock className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-emerald-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                Fechadas / Concluídas
              </p>
              <p className="text-4xl lg:text-6xl font-black text-emerald-400 mt-2">{data.closed}</p>
              <p className="text-xs text-slate-400 mt-1">
                Concluídas com sucesso, canceladas ou recusadas
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Status Real de Mudanças */}
      <Card className="bg-[#17181C] border-amber-500/25 text-white flex-1 p-6 flex flex-col justify-between shadow-xl">
        <CardHeader className="p-0 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl lg:text-2xl font-bold text-amber-300 flex items-center gap-2">
              <GitPullRequest className="h-6 w-6 text-amber-400" />
              Detalhamento por Status de Mudança
            </CardTitle>
            <span className="text-sm text-slate-400">
              Total registrado: <strong className="text-white text-base">{data.total}</strong>
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-6 flex-1 overflow-y-auto">
          {statusEntries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 italic">
              Nenhuma mudança cadastrada no sistema
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {statusEntries.map(([status, count]) => {
                const isClosed = ['Concluída', 'Cancelada', 'Recusada'].includes(status)
                const isProgress = [
                  'Em Execução',
                  'Em Validação',
                  'Agendada',
                  'Em Planejamento',
                ].includes(status)

                let badgeColor = 'border-amber-500/30 text-amber-400'
                if (isClosed) badgeColor = 'border-emerald-500/40 text-emerald-400'
                else if (isProgress) badgeColor = 'border-blue-500/40 text-blue-400'

                return (
                  <div
                    key={status}
                    className={`p-4 rounded-xl bg-black/40 border ${badgeColor} flex flex-col justify-between`}
                  >
                    <span className="text-sm font-semibold text-slate-200 truncate">{status}</span>
                    <span className="text-3xl font-black mt-2 text-white">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
