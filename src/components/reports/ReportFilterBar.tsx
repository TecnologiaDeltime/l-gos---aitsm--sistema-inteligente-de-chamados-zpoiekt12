import React, { useMemo } from 'react'
import { Calendar, Building, User, Layers, Tag, CheckCircle2, MapPin } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import type { AuxiliaryFilterOptions, ReportFilterParams } from '@/services/itsm-reports'

interface ReportFilterBarProps {
  filterParams: ReportFilterParams
  onFilterChange: (newParams: Partial<ReportFilterParams>) => void
  filterOptions: AuxiliaryFilterOptions
  onReset: () => void
}

export function ReportFilterBar({
  filterParams,
  onFilterChange,
  filterOptions,
  onReset,
}: ReportFilterBarProps) {
  // Lista dos últimos 12 meses para o filtro rápido
  const availableMonths = useMemo(() => {
    const list: Array<{ value: string; label: string }> = []
    const now = new Date()
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const pad = (n: number) => String(n).padStart(2, '0')
      const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      const label = `${monthNames[d.getMonth()]} de ${d.getFullYear()}`
      list.push({ value: val, label })
    }
    return list
  }, [])

  // Filiais filtradas pela empresa selecionada (se houver)
  const availableBranches = useMemo(() => {
    if (!filterParams.companyId || filterParams.companyId === 'all') {
      return filterOptions.branches
    }
    return filterOptions.branches.filter((b) => b.companyId === filterParams.companyId)
  }, [filterOptions.branches, filterParams.companyId])

  // Setores filtrados pela empresa selecionada (se houver)
  const availableSectors = useMemo(() => {
    if (!filterParams.companyId || filterParams.companyId === 'all') {
      return filterOptions.sectors
    }
    return filterOptions.sectors.filter((s) => s.companyId === filterParams.companyId)
  }, [filterOptions.sectors, filterParams.companyId])

  return (
    <Card className="itsm-card border-border/80 bg-card/90">
      <CardContent className="p-4 space-y-4">
        {/* Linha superior: Modo de período e botões rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Filtros de Período e Segmentação</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={filterParams.filterMode === 'month' ? 'default' : 'outline'}
              className={`h-7 px-2.5 text-xs ${
                filterParams.filterMode === 'month'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:border-primary/40'
              }`}
              onClick={() => onFilterChange({ filterMode: 'month' })}
            >
              Mês Atual / Mensal
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterParams.filterMode === 'custom' ? 'default' : 'outline'}
              className={`h-7 px-2.5 text-xs ${
                filterParams.filterMode === 'custom'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:border-primary/40'
              }`}
              onClick={() => onFilterChange({ filterMode: 'custom' })}
            >
              Período Específico
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Grade com os 7 filtros pedidos pelo usuário:
            Cliente, Período, Operador, Filial, Setor, Status, Atividade */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 items-end">
          {/* 1. Período */}
          {filterParams.filterMode === 'month' ? (
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" /> Período (Mês)
              </Label>
              <Select
                value={filterParams.monthKey}
                onValueChange={(val) => onFilterChange({ monthKey: val })}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1 xl:col-span-1">
              <Label className="text-[11px] font-medium text-muted-foreground">De / Até</Label>
              <div className="flex gap-1 items-center">
                <Input
                  type="date"
                  value={filterParams.startDate || ''}
                  onChange={(e) => onFilterChange({ startDate: e.target.value })}
                  className="h-8 text-[11px] px-1.5 w-1/2"
                />
                <Input
                  type="date"
                  value={filterParams.endDate || ''}
                  onChange={(e) => onFilterChange({ endDate: e.target.value })}
                  className="h-8 text-[11px] px-1.5 w-1/2"
                />
              </div>
            </div>
          )}

          {/* 2. Cliente (Empresa) */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Building className="h-3 w-3 text-primary" /> Cliente
            </Label>
            <Select
              value={filterParams.companyId || 'all'}
              onValueChange={(val) =>
                onFilterChange({ companyId: val, branchId: 'all', sectorId: 'all' })
              }
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os Clientes
                </SelectItem>
                {filterOptions.companies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Filial */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" /> Filial
            </Label>
            <Select
              value={filterParams.branchId || 'all'}
              onValueChange={(val) => onFilterChange({ branchId: val })}
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todas as filiais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Filiais
                </SelectItem>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Setor Solicitante */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-primary" /> Setor
            </Label>
            <Select
              value={filterParams.sectorId || 'all'}
              onValueChange={(val) => onFilterChange({ sectorId: val })}
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os Setores
                </SelectItem>
                {availableSectors.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Operador */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary" /> Operador
            </Label>
            <Select
              value={filterParams.operatorId || 'all'}
              onValueChange={(val) => onFilterChange({ operatorId: val })}
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todos os operadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os Operadores
                </SelectItem>
                {filterOptions.operators.map((op) => (
                  <SelectItem key={op.id} value={op.id} className="text-xs">
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 6. Status */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Status
            </Label>
            <Select
              value={filterParams.status || 'all'}
              onValueChange={(val) => onFilterChange({ status: val })}
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os Status
                </SelectItem>
                {filterOptions.statuses.map((st) => (
                  <SelectItem key={st} value={st} className="text-xs">
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7. Atividade */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3 text-primary" /> Atividade
            </Label>
            <Select
              value={filterParams.activityId || 'all'}
              onValueChange={(val) => onFilterChange({ activityId: val })}
            >
              <SelectTrigger className="h-8 text-xs w-full bg-background">
                <SelectValue placeholder="Todas as atividades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Atividades
                </SelectItem>
                {filterOptions.activities.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
