import { Badge } from '@/components/ui/badge'
import { CalendarClock, FileClock, Laptop, UserCheck } from 'lucide-react'
import { formatHours } from '@/lib/duration'
import {
  AgreementUsageItem,
  AssetMovementSummary,
  MonthlyClientReportData,
  MonthlyComparisonAnalysis,
  RequesterUsageItem,
} from '@/services/monthly-client-report'
import { cn } from '@/lib/utils'

type ReportData = MonthlyClientReportData

interface PortalReportDataSectionsProps {
  data: ReportData
}

/** Cabeçalho de seção, fiel ao estilo do PDF (MonthlyClientReportPage). */
function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-baseline gap-2 border-b pb-1">
      <span className="text-amber-600 dark:text-amber-400">{icon}</span>
      <h4 className="font-bold text-foreground text-sm">{title}</h4>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  )
}

/** Tabela padrão, estilo fiel ao PDF. */
function DataTable({ head, body }: { head: React.ReactNode; body: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted text-muted-foreground font-semibold">{head}</thead>
        <tbody className="divide-y divide-border">{body}</tbody>
      </table>
    </div>
  )
}

/** Cabeçalhos de tabela (th), com alinhamento à direita opcional. */
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('p-2', right ? 'text-right' : 'text-left')}>{children}</th>
}

/** Célula de tabela (td), com alinhamento à direita opcional. */
function Td({
  children,
  right,
  className,
}: {
  children: React.ReactNode
  right?: boolean
  className?: string
}) {
  return <td className={cn('p-2', right && 'text-right font-mono', className)}>{children}</td>
}

/** Seção 1 — Consumo de horas por acordo de serviço. */
function AgreementsSection({ agreements }: { agreements: AgreementUsageItem[] }) {
  if (!agreements?.length) return null
  return (
    <div className="space-y-2">
      <SectionHeader
        icon={<FileClock className="h-4 w-4" />}
        title="Horas por Acordo de Serviço"
        subtitle="Consumo por acordo no mês de referência"
      />
      <DataTable
        head={
          <tr>
            <Th>Acordo</Th>
            <Th right>Horas Contratadas</Th>
            <Th right>Horas Utilizadas</Th>
            <Th right>Saldo</Th>
            <Th right>% Utilizado</Th>
          </tr>
        }
        body={agreements.map((a, idx) => (
          <tr key={idx} className="hover:bg-muted/20">
            <Td className="font-medium text-foreground">{a.name}</Td>
            <Td right>{formatHours(a.contractedHours)}</Td>
            <Td right className="font-bold text-amber-600 dark:text-amber-400">
              {formatHours(a.usedHours)}
            </Td>
            <Td right>{formatHours(a.balanceHours)}</Td>
            <Td right>{a.percentUsed.toFixed(1)}%</Td>
          </tr>
        ))}
      />
    </div>
  )
}

/** Seção 3 — Solicitantes mais demandantes. */
function RequestersSection({ requesters }: { requesters: RequesterUsageItem[] }) {
  if (!requesters?.length) return null
  return (
    <div className="space-y-2">
      <SectionHeader
        icon={<UserCheck className="h-4 w-4" />}
        title="Solicitantes"
        subtitle="Principais solicitantes do período"
      />
      <DataTable
        head={
          <tr>
            <Th>Solicitante</Th>
            <Th>Setor</Th>
            <Th right>Chamados</Th>
            <Th right>Horas</Th>
            <Th right>% do Total</Th>
          </tr>
        }
        body={requesters.slice(0, 10).map((r, idx) => (
          <tr key={idx} className="hover:bg-muted/20">
            <Td className="font-medium text-foreground">{r.name}</Td>
            <Td className="text-muted-foreground">{r.sectorName || '—'}</Td>
            <Td right>{r.ticketCount}</Td>
            <Td right className="font-bold text-amber-600 dark:text-amber-400">
              {formatHours(r.usedHours)}
            </Td>
            <Td right>{r.percentTotal}%</Td>
          </tr>
        ))}
      />
    </div>
  )
}

/** Seção 6 — Movimentação de ativos (CMDB). */
function AssetsSection({ assets }: { assets: AssetMovementSummary }) {
  if (!assets || (!assets.enteredCount && !assets.exitedCount && !assets.activeCount)) return null
  return (
    <div className="space-y-2">
      <SectionHeader
        icon={<Laptop className="h-4 w-4" />}
        title="Movimentação de Ativos (CMDB)"
        subtitle={`${assets.activeCount} ativo(s) em escopo no período`}
      />
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
          <span className="block text-[10px] text-muted-foreground">Entradas</span>
          <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {assets.enteredCount}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border bg-red-500/5 border-red-500/20">
          <span className="block text-[10px] text-muted-foreground">Saídas</span>
          <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400">
            {assets.exitedCount}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border bg-amber-500/10 border-amber-500/20">
          <span className="block text-[10px] text-muted-foreground">Ativos no Escopo</span>
          <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
            {assets.activeCount}
          </span>
        </div>
      </div>

      {assets.enteredList?.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Ativos incluídos no escopo:
          </span>
          <ul className="text-xs divide-y divide-border border rounded-lg overflow-hidden">
            {assets.enteredList.map((a) => (
              <li key={a.id} className="p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-foreground block truncate">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {[a.device_type, a.manufacturer, a.model].filter(Boolean).join(' • ')}
                    {a.responsible_user ? ` • Resp.: ${a.responsible_user}` : ''}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  {a.date}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assets.exitedList?.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Ativos retirados do escopo:
          </span>
          <ul className="text-xs divide-y divide-border border rounded-lg overflow-hidden">
            {assets.exitedList.map((a) => (
              <li key={a.id} className="p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-foreground block truncate">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {[a.device_type, a.manufacturer, a.model].filter(Boolean).join(' • ')}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-red-500/40 text-red-600 dark:text-red-400"
                >
                  {a.date}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Seção 7 — Comparativo dos últimos 6 meses. */
function ComparisonSection({ comparison }: { comparison?: MonthlyComparisonAnalysis }) {
  if (!comparison?.items?.length) return null
  return (
    <div className="space-y-2">
      <SectionHeader
        icon={<CalendarClock className="h-4 w-4" />}
        title="Comparativo dos Últimos 6 Meses"
        subtitle={comparison.summaryText}
      />
      <DataTable
        head={
          <tr>
            <Th>Mês</Th>
            <Th right>Horas</Th>
            <Th right>Abertos</Th>
            <Th right>Resolvidos</Th>
            <Th right>Variação</Th>
          </tr>
        }
        body={comparison.items.map((m, idx) => (
          <tr
            key={idx}
            className={cn(
              'hover:bg-muted/20',
              m.isReferenceMonth && 'bg-amber-500/10 font-semibold',
            )}
          >
            <Td className="font-medium text-foreground">
              {m.label}
              {m.isReferenceMonth && (
                <Badge className="ml-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] px-1 py-0">
                  Mês de referência
                </Badge>
              )}
            </Td>
            <Td right>{m.horasUtilizadasFormatted}</Td>
            <Td right>{m.chamadosAbertos}</Td>
            <Td right>{m.chamadosResolvidos}</Td>
            <Td
              right
              className={cn(
                m.variacaoPercent == null
                  ? 'text-muted-foreground'
                  : m.variacaoPercent > 0
                    ? 'text-red-600 dark:text-red-400'
                    : m.variacaoPercent < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : '',
              )}
            >
              {m.variacaoPercent == null
                ? '—'
                : `${m.variacaoPercent > 0 ? '+' : ''}${m.variacaoPercent.toFixed(1)}%`}
            </Td>
          </tr>
        ))}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-lg border bg-muted/20">
          <span className="block text-[10px] text-muted-foreground">Média de Horas</span>
          <span className="font-bold font-mono text-foreground">
            {formatHours(comparison.averageHours)}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border bg-muted/20">
          <span className="block text-[10px] text-muted-foreground">Pico</span>
          <span className="font-bold font-mono text-foreground">
            {comparison.peakMonth ? comparison.peakMonth.label : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border bg-muted/20">
          <span className="block text-[10px] text-muted-foreground">Menor Consumo</span>
          <span className="font-bold font-mono text-foreground">
            {comparison.lowestMonth ? comparison.lowestMonth.label : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg border bg-muted/20">
          <span className="block text-[10px] text-muted-foreground">Tendência</span>
          <span className="font-bold text-foreground">
            {comparison.trendDirection === 'up'
              ? 'Alta'
              : comparison.trendDirection === 'down'
                ? 'Queda'
                : 'Estável'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Snapshot analítico — as seções que faltavam no portal, fiéis ao PDF. */
export default function PortalReportDataSections({ data }: PortalReportDataSectionsProps) {
  return (
    <div className="space-y-6">
      <AgreementsSection agreements={data.agreements || []} />
      <ComparisonSection comparison={data.comparison} />
      <AssetsSection assets={data.assets} />
      <RequestersSection requesters={data.requesters || []} />
    </div>
  )
}
