import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileDown, Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getContract,
  getContractTickets,
  ContractRecord,
  CONTRACT_HOURS_LEVELS,
} from '@/services/contracts'
import { StatusBadge } from '@/components/StatusBadge'
import { exportContractPdf } from '@/lib/pdf-export'
import { formatHours, formatMinutes, formatSeconds } from '@/lib/duration'
import { PeriodFilter, usePeriodFilter } from '@/components/contracts/PeriodFilter'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

export default function ContractView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [periodFilter, setPeriodFilter] = usePeriodFilter()
  const [contract, setContract] = useState<ContractRecord | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [periodInteractions, setPeriodInteractions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const c = await getContract(id)
      setContract(c)
      const t = await getContractTickets(id)
      setTickets(t)

      // Se houver tickets, busca as interações dentro do período filtrado
      if (t.length > 0) {
        const ticketIds = t.map((item: any) => item.id)
        const batchSize = 50
        const dateFilter = `created >= "${periodFilter.startIso}" && created <= "${periodFilter.endIso}"`
        const allInteractions: any[] = []

        for (let i = 0; i < ticketIds.length; i += batchSize) {
          const batch = ticketIds.slice(i, i + batchSize)
          const batchFilter = batch.map((tid) => `ticket = "${tid}"`).join(' || ')
          const filter = `(${batchFilter}) && ${dateFilter}`
          const list = await pb.collection('ticket_interactions').getFullList({
            filter,
            fields: 'id,ticket,duration_minutes,hour_type,created',
          })
          allInteractions.push(...list)
        }
        setPeriodInteractions(allInteractions)
      } else {
        setPeriodInteractions([])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [id, periodFilter.startIso, periodFilter.endIso])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('contracts', () => loadData())
  useRealtime('tickets', () => loadData())
  useRealtime('ticket_interactions', () => loadData())

  if (loading)
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  if (!contract)
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-slate-500">Contrato não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/contracts')}>
          Voltar
        </Button>
      </div>
    )

  const daysLeft = contract.end_date
    ? Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000)
    : null
  const showBanner = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
  const company = contract.expand?.company
  const details = [
    { l: 'Empresa', v: company?.legal_name || 'N/A' },
    { l: 'Nome Fantasia', v: company?.trade_name || 'N/A' },
    { l: 'Número', v: contract.number },
    { l: 'Status', v: contract.status },
    { l: 'Tipo', v: contract.type || 'N/A' },
    {
      l: 'Início',
      v: contract.start_date ? new Date(contract.start_date).toLocaleDateString('pt-BR') : 'N/A',
    },
    {
      l: 'Término',
      v: contract.end_date ? new Date(contract.end_date).toLocaleDateString('pt-BR') : 'N/A',
    },
    { l: 'Horas Mensais', v: formatHours(contract.monthly_hours || 0) },
    { l: 'SLA Resposta', v: formatMinutes(contract.sla_response_time || 0) },
    { l: 'SLA Solução', v: formatMinutes(contract.sla_solution_time || 0) },
    {
      l: 'Horário',
      v: `${contract.service_hours_start || 'N/A'} - ${contract.service_hours_end || 'N/A'}`,
    },
    { l: 'Dias', v: contract.service_days || 'N/A' },
  ]

  // Distribuição de horas por acordo de atendimento
  const removedLevels = contract.removed_levels ?? []
  const baseLevels = CONTRACT_HOURS_LEVELS.filter((lvl) => !removedLevels.includes(lvl.key)).map(
    (lvl) => ({
      label: lvl.label,
      hours: contract[lvl.key],
    }),
  )
  const activeCustomAgreements = (contract.custom_agreements ?? []).filter((a) => a.active)
  const distributionRows = [
    ...baseLevels.map((b) => ({ label: b.label, hours: b.hours })),
    ...activeCustomAgreements.map((a) => ({ label: a.name, hours: a.hours })),
  ].filter((r) => Number(r.hours) > 0)
  const showDistribution = distributionRows.length > 0

  // Consumo no período filtrado
  const totalPeriodMinutes = periodInteractions.reduce(
    (acc, it) => acc + (Number(it.duration_minutes) || 0),
    0,
  )
  const totalPeriodHours = Math.round((totalPeriodMinutes / 60) * 100) / 100
  const contractedMonthlyHours = contract.monthly_hours || 0
  const periodBalance = Math.round((contractedMonthlyHours - totalPeriodHours) * 100) / 100

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{contract.number}</h2>
            <p className="text-sm text-slate-500">{company?.trade_name || 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportContractPdf(contract, user?.name || 'Sistema')}
          >
            <FileDown className="mr-1.5 h-4 w-4" /> Exportar PDF
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate(`/contracts/${contract.id}/edit`)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      {showBanner && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Este contrato vence em {daysLeft} dias (
            {new Date(contract.end_date!).toLocaleDateString('pt-BR')}). Renove-o em breve.
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-700"
            onClick={() => navigate(`/contracts/${contract.id}/edit`)}
          >
            Renovar Contrato
          </Button>
        </div>
      )}

      {/* Filtro de Período para consumo do contrato */}
      <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />

      {/* Card de Consumo no Período Selecionado */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Consumo de Horas no Período</h3>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {periodFilter.formattedLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
            <p className="text-xs text-slate-500">Horas Contratadas (Mensal)</p>
            <p className="text-lg font-bold">{formatHours(contractedMonthlyHours)}</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
            <p className="text-xs text-orange-600 dark:text-orange-400">Consumido no Período</p>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {formatHours(totalPeriodHours)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <p className="text-xs text-green-600 dark:text-green-400">Saldo no Período</p>
            <p
              className={`text-lg font-bold ${
                periodBalance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-700 dark:text-green-300'
              }`}
            >
              {formatHours(periodBalance)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <p className="text-xs text-blue-600 dark:text-blue-400">Interações Registradas</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {periodInteractions.length} ({formatSeconds(totalPeriodMinutes * 60)})
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="text-sm font-semibold mb-4">Dados do Contrato</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {details.map((d, i) => (
            <div key={i}>
              <p className="text-xs text-slate-500">{d.l}</p>
              <p className="text-sm font-medium">{d.v}</p>
            </div>
          ))}
        </div>
      </div>

      {showDistribution && (
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
          <h3 className="text-sm font-semibold mb-4">
            Distribuição de horas por acordo de atendimento
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {distributionRows.map((row, i) => (
              <div key={i}>
                <p className="text-xs text-slate-500">{row.label}</p>
                <p className="text-sm font-medium">{formatHours(row.hours || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="text-sm font-semibold mb-4">Chamados Vinculados ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Nenhum chamado vinculado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y text-slate-700">
                <tr>
                  <th className="p-2.5">Número</th>
                  <th className="p-2.5">Título</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Operador</th>
                  <th className="p-2.5">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <Link to={`/tickets/${t.id}`} className="font-semibold text-blue-600">
                        #{t.number}
                      </Link>
                    </td>
                    <td className="p-2.5 max-w-xs truncate">{t.title}</td>
                    <td className="p-2.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="p-2.5">{t.expand?.assigned_to?.name || 'N/A'}</td>
                    <td className="p-2.5">{new Date(t.created).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
