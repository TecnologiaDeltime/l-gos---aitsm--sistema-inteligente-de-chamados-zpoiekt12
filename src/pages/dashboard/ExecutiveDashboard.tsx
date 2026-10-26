import { useState, useMemo } from 'react'
import {
  Inbox,
  CheckCircle,
  XCircle,
  Clock,
  Hourglass,
  Timer,
  MapPin,
  Download,
  FileText,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExecutiveKpiCard } from '@/components/dashboard/ExecutiveKpiCard'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { TicketsChartSection } from '@/components/dashboard/TicketsChartSection'
import { SlaPrioritySection } from '@/components/dashboard/SlaPrioritySection'
import { HoursSection } from '@/components/dashboard/HoursSection'
import { OperatorPerformanceSection } from '@/components/dashboard/OperatorPerformanceSection'
import { VisitsSection } from '@/components/dashboard/VisitsSection'
import { AiInsightCard } from '@/components/dashboard/AiInsightCard'
import { DrillDownDialog } from '@/components/dashboard/DrillDownDialog'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { computeKpis } from '@/lib/dashboard-metrics'
import { exportToCsv } from '@/lib/export-utils'
import { useTheme } from '@/hooks/use-theme'
import type { TicketRecord } from '@/services/tickets'

export default function ExecutiveDashboard() {
  const { designSettings } = useTheme()
  const { data, options, filters, loading, lastUpdate, updateFilter, clearFilters } =
    useDashboardData()
  const [drillDown, setDrillDown] = useState<{
    open: boolean
    tickets: TicketRecord[]
    title: string
  }>({
    open: false,
    tickets: [],
    title: '',
  })

  const kpis = useMemo(() => (data ? computeKpis(data) : null), [data])

  const openDrillDown = (tickets: TicketRecord[], title: string) => {
    setDrillDown({ open: true, tickets, title })
  }

  const handleExportCsv = () => {
    if (!data) return
    exportToCsv(
      'dashboard-gerencial.csv',
      data.tickets.map((t) => ({
        Numero: t.number,
        Cliente: t.expand?.company?.trade_name || '',
        Solicitante: t.requester_name || '',
        Operador: t.expand?.assigned_to?.name || '',
        Prioridade: t.priority,
        Status: t.status === 'Atribuído' ? 'Em aberto' : t.status,
        Tipo: t.type,
        Abertura: t.created,
        Fechamento: t.closure_date || '',
        SLA: t.sla_status || '',
        Horas: t.work_hours || 0,
      })),
      [
        'Numero',
        'Cliente',
        'Solicitante',
        'Operador',
        'Prioridade',
        'Status',
        'Tipo',
        'Abertura',
        'Fechamento',
        'SLA',
        'Horas',
      ],
    )
  }

  const handleExportPdf = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!data) return
    const rows = data.tickets.map((t) => ({
      Numero: t.number,
      Cliente: t.expand?.company?.trade_name || '',
      Prioridade: t.priority,
      Status: t.status === 'Atribuído' ? 'Em aberto' : t.status,
      Tipo: t.type,
      Abertura: t.created,
      SLA: t.sla_status || '',
    }))
    const html = `<table><tr>${Object.keys(rows[0] || {})
      .map((h) => `<th>${h}</th>`)
      .join('')}</tr>${rows
      .map(
        (r) =>
          `<tr>${Object.values(r)
            .map((v) => `<td>${v}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</table>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dashboard-gerencial.xls'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data || !kpis) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {designSettings?.report_logo_url || designSettings?.logo_url ? (
            <div className="flex items-center max-h-12 max-w-[180px] p-1.5 rounded-lg bg-card/60 border border-border/60">
              <img
                src={designSettings.report_logo_url || designSettings.logo_url}
                alt="Logotipo de Documentos"
                className="max-h-9 w-auto object-contain"
              />
            </div>
          ) : null}
          <div>
            <h2 className="text-xl font-bold text-foreground">Dashboard Gerencial</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Última atualização:{' '}
              {lastUpdate.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPdf}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <DashboardFilters
        filters={filters}
        options={options}
        onUpdate={updateFilter}
        onClear={clearFilters}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ExecutiveKpiCard
          label="Chamados Abertos"
          value={kpis.opened}
          icon={Inbox}
          color="text-primary"
          bg="bg-primary/10 border border-primary/20"
          onClick={() => openDrillDown(data.tickets, 'Chamados Abertos')}
        />
        <ExecutiveKpiCard
          label="Chamados Resolvidos"
          value={kpis.resolved}
          icon={CheckCircle}
          color="text-emerald-400"
          bg="bg-emerald-500/10 border border-emerald-500/20"
          onClick={() =>
            openDrillDown(
              data.tickets.filter((t) => t.status === 'Resolvido'),
              'Chamados Resolvidos',
            )
          }
        />
        <ExecutiveKpiCard
          label="Chamados Fechados"
          value={kpis.closed}
          icon={XCircle}
          color="text-slate-400"
          bg="bg-slate-500/10 border border-slate-500/20"
          onClick={() =>
            openDrillDown(
              data.tickets.filter((t) => t.status === 'Encerrado'),
              'Chamados Fechados',
            )
          }
        />
        <ExecutiveKpiCard
          label="Chamados em Aberto"
          value={kpis.pending}
          icon={Clock}
          color="text-amber-400"
          bg="bg-amber-500/10 border border-amber-500/20"
          onClick={() =>
            openDrillDown(
              data.tickets.filter(
                (t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status),
              ),
              'Chamados em Aberto',
            )
          }
        />
        <ExecutiveKpiCard
          label="Horas Contratadas"
          value={kpis.contractedDisplay}
          icon={Hourglass}
          color="text-indigo-400"
          bg="bg-indigo-500/10 border border-indigo-500/20"
        />
        <ExecutiveKpiCard
          label="Horas Consumidas"
          value={kpis.consumedDisplay}
          icon={Timer}
          color="text-purple-400"
          bg="bg-purple-500/10 border border-purple-500/20"
        />
        <ExecutiveKpiCard
          label="Saldo de Horas"
          value={kpis.balanceDisplay}
          icon={Hourglass}
          color={kpis.balanceHours < 0 ? 'text-rose-400' : 'text-emerald-400'}
          bg={
            kpis.balanceHours < 0
              ? 'bg-rose-500/10 border border-rose-500/20'
              : 'bg-emerald-500/10 border border-emerald-500/20'
          }
        />
        <ExecutiveKpiCard
          label="Visitas Técnicas"
          value={kpis.visits}
          icon={MapPin}
          color="text-sky-400"
          bg="bg-sky-500/10 border border-sky-500/20"
        />
      </div>

      <TicketsChartSection tickets={data.tickets} onDrillDown={openDrillDown} />

      <SlaPrioritySection tickets={data.tickets} />

      <HoursSection
        data={data}
        contractedHours={kpis.contractedHours}
        consumedMinutes={kpis.consumedMinutes}
        consumedDisplay={kpis.consumedDisplay}
      />

      <OperatorPerformanceSection data={data} />

      <VisitsSection data={data} />

      <AiInsightCard />

      <DrillDownDialog
        open={drillDown.open}
        onClose={() => setDrillDown((prev) => ({ ...prev, open: false }))}
        title={drillDown.title}
        tickets={drillDown.tickets}
      />
    </div>
  )
}
