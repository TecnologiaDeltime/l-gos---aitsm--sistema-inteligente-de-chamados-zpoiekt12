import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RotateCcw } from 'lucide-react'
import type { DashboardFilterState } from '@/services/dashboard'
import { TICKET_TYPES, TICKET_STATUSES, PRIORITIES } from '@/services/dashboard'
import type { FilterOptions } from '@/services/dashboard'

interface DashboardFiltersProps {
  filters: DashboardFilterState
  options: FilterOptions | null
  onUpdate: (key: keyof DashboardFilterState, value: string) => void
  onClear: () => void
}

export function DashboardFilters({ filters, options, onUpdate, onClear }: DashboardFiltersProps) {
  const operators =
    options?.users.filter((u) => ['tecnico', 'gestor', 'admin'].includes(u.role || '')) || []
  const technicians = operators

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Filtros Globais</span>
        <Button size="sm" variant="outline" onClick={onClear}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar filtros
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-[11px]">Período Inicial</Label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => onUpdate('startDate', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Período Final</Label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => onUpdate('endDate', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <FilterSelect
          label="Cliente"
          value={filters.companyId}
          onChange={(v) => onUpdate('companyId', v)}
          options={options?.companies.map((c) => ({ value: c.id, label: c.trade_name })) || []}
        />
        <FilterSelect
          label="Contrato"
          value={filters.contractId}
          onChange={(v) => onUpdate('contractId', v)}
          options={options?.contracts.map((c) => ({ value: c.id, label: c.number })) || []}
        />
        <FilterSelect
          label="Operador"
          value={filters.operatorId}
          onChange={(v) => onUpdate('operatorId', v)}
          options={operators.map((u) => ({ value: u.id, label: u.name || u.email }))}
        />
        <FilterSelect
          label="Equipe"
          value={filters.queueId}
          onChange={(v) => onUpdate('queueId', v)}
          options={options?.queues.map((q) => ({ value: q.id, label: q.name })) || []}
        />
        <FilterSelect
          label="Prioridade"
          value={filters.priority}
          onChange={(v) => onUpdate('priority', v)}
          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Categoria"
          value={filters.categoryId}
          onChange={(v) => onUpdate('categoryId', v)}
          options={options?.categories.map((c) => ({ value: c.id, label: c.name })) || []}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => onUpdate('status', v)}
          options={TICKET_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <FilterSelect
          label="Tipo"
          value={filters.ticketType}
          onChange={(v) => onUpdate('ticketType', v)}
          options={TICKET_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          label="Operador"
          value={filters.technicianId}
          onChange={(v) => onUpdate('technicianId', v)}
          options={technicians.map((u) => ({ value: u.id, label: u.name || u.email }))}
        />
        <FilterSelect
          label="Região/Local"
          value={filters.region}
          onChange={(v) => onUpdate('region', v)}
          options={options?.units.map((u) => ({ value: u.id, label: u.name })) || []}
        />
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
