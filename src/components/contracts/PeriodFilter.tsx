import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react'

export type PeriodFilterMode = 'current_month' | 'custom_range'

export interface PeriodFilterValue {
  mode: PeriodFilterMode
  /** Formato YYYY-MM para modo mês */
  month: string
  /** Formato YYYY-MM-DD para período personalizado */
  startDate: string
  /** Formato YYYY-MM-DD para período personalizado */
  endDate: string
  /** ISO string início do período (ex: "2025-11-01 00:00:00") */
  startIso: string
  /** ISO string fim do período (ex: "2025-11-30 23:59:59") */
  endIso: string
  /** Data formatada legível em pt-BR (ex: "01/11/2025 – 30/11/2025") */
  formattedLabel: string
}

const MONTH_NAMES_FULL = [
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

export function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10))
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthName(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10))
  if (!y || !m || m < 1 || m > 12) return monthKey
  return `${MONTH_NAMES_FULL[m - 1]} de ${y}`
}

export function computePeriodRange(
  mode: PeriodFilterMode,
  month: string,
  startDate: string,
  endDate: string,
) {
  const pad = (n: number) => String(n).padStart(2, '0')

  if (mode === 'custom_range' && startDate && endDate) {
    const sParts = startDate.split('-').map(Number)
    const eParts = endDate.split('-').map(Number)
    const sDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0)
    const eDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59)

    const fmtStart = `${pad(sParts[2])}/${pad(sParts[1])}/${sParts[0]}`
    const fmtEnd = `${pad(eParts[2])}/${pad(eParts[1])}/${eParts[0]}`

    return {
      startIso: `${startDate} 00:00:00`,
      endIso: `${endDate} 23:59:59`,
      startDateObj: sDate,
      endDateObj: eDate,
      formattedLabel: `${fmtStart} – ${fmtEnd}`,
    }
  }

  // Modo mês (padrão ou selecionado)
  const effectiveMonth = month || getCurrentMonthKey()
  const [yearStr, monthStr] = effectiveMonth.split('-')
  const y = parseInt(yearStr, 10) || new Date().getFullYear()
  const m = parseInt(monthStr, 10) || new Date().getMonth() + 1

  const firstDay = new Date(y, m - 1, 1, 0, 0, 0)
  const lastDay = new Date(y, m, 0, 23, 59, 59)

  const sStr = `${y}-${pad(m)}-01`
  const eStr = `${y}-${pad(m)}-${pad(lastDay.getDate())}`
  const fmtStart = `01/${pad(m)}/${y}`
  const fmtEnd = `${pad(lastDay.getDate())}/${pad(m)}/${y}`

  return {
    startIso: `${sStr} 00:00:00`,
    endIso: `${eStr} 23:59:59`,
    startDateObj: firstDay,
    endDateObj: lastDay,
    formattedLabel: `${fmtStart} – ${fmtEnd}`,
  }
}

interface PeriodFilterProps {
  value: PeriodFilterValue
  onChange: (value: PeriodFilterValue) => void
  className?: string
  showActiveBadgeOnly?: boolean
}

/**
 * Hook para gerenciar estado do filtro de período com persistência na URL.
 */
export function usePeriodFilter(): [PeriodFilterValue, (val: PeriodFilterValue) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentMonth = useMemo(() => getCurrentMonthKey(), [])

  // Lê da URL ou inicializa com valores padrão
  const modeParam = searchParams.get('period_mode') as PeriodFilterMode | null
  const monthParam = searchParams.get('period_month')
  const startParam = searchParams.get('period_from')
  const endParam = searchParams.get('period_to')

  const mode: PeriodFilterMode = modeParam === 'custom_range' ? 'custom_range' : 'current_month'
  const month: string = monthParam || currentMonth

  // Datas padrão para período customizado se vazias: início e fim do mês atual
  const [defYear, defMonth] = currentMonth.split('-')
  const lastDayCur = new Date(Number(defYear), Number(defMonth), 0).getDate()
  const startDate = startParam || `${currentMonth}-01`
  const endDate = endParam || `${currentMonth}-${String(lastDayCur).padStart(2, '0')}`

  const range = computePeriodRange(mode, month, startDate, endDate)

  const filterValue: PeriodFilterValue = {
    mode,
    month,
    startDate,
    endDate,
    startIso: range.startIso,
    endIso: range.endIso,
    formattedLabel: range.formattedLabel,
  }

  const updateFilter = (newVal: PeriodFilterValue) => {
    const params = new URLSearchParams(searchParams)

    if (newVal.mode === 'custom_range') {
      params.set('period_mode', 'custom_range')
      params.set('period_from', newVal.startDate)
      params.set('period_to', newVal.endDate)
      params.delete('period_month')
    } else {
      if (newVal.month && newVal.month !== currentMonth) {
        params.set('period_mode', 'current_month')
        params.set('period_month', newVal.month)
      } else {
        // Se for mês atual padrão, limpa parâmetros para manter URL limpa
        params.delete('period_mode')
        params.delete('period_month')
      }
      params.delete('period_from')
      params.delete('period_to')
    }

    setSearchParams(params, { replace: true })
  }

  return [filterValue, updateFilter]
}

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const currentMonth = useMemo(() => getCurrentMonthKey(), [])
  const isCurrentMonth = value.mode === 'current_month' && value.month === currentMonth

  // Estado local para os inputs do modo customizado (para validação antes de aplicar)
  const [customStart, setCustomStart] = useState(value.startDate)
  const [customEnd, setCustomEnd] = useState(value.endDate)
  const [customError, setCustomError] = useState<string | null>(null)

  useEffect(() => {
    setCustomStart(value.startDate)
    setCustomEnd(value.endDate)
  }, [value.startDate, value.endDate])

  const handleModeChange = (newMode: PeriodFilterMode) => {
    if (newMode === 'current_month') {
      const range = computePeriodRange('current_month', currentMonth, '', '')
      onChange({
        mode: 'current_month',
        month: currentMonth,
        startDate: value.startDate,
        endDate: value.endDate,
        startIso: range.startIso,
        endIso: range.endIso,
        formattedLabel: range.formattedLabel,
      })
    } else {
      const range = computePeriodRange('custom_range', value.month, customStart, customEnd)
      onChange({
        mode: 'custom_range',
        month: value.month,
        startDate: customStart,
        endDate: customEnd,
        startIso: range.startIso,
        endIso: range.endIso,
        formattedLabel: range.formattedLabel,
      })
    }
  }

  const handleMonthShift = (delta: number) => {
    const nextMonth = shiftMonthKey(value.month, delta)
    const range = computePeriodRange('current_month', nextMonth, '', '')
    onChange({
      ...value,
      mode: 'current_month',
      month: nextMonth,
      startIso: range.startIso,
      endIso: range.endIso,
      formattedLabel: range.formattedLabel,
    })
  }

  const handleResetToCurrentMonth = () => {
    const range = computePeriodRange('current_month', currentMonth, '', '')
    onChange({
      ...value,
      mode: 'current_month',
      month: currentMonth,
      startIso: range.startIso,
      endIso: range.endIso,
      formattedLabel: range.formattedLabel,
    })
  }

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      setCustomError('Preencha as datas de início e fim.')
      return
    }
    if (customStart > customEnd) {
      setCustomError('A data inicial não pode ser posterior à data final.')
      return
    }
    setCustomError(null)
    const range = computePeriodRange('custom_range', value.month, customStart, customEnd)
    onChange({
      ...value,
      mode: 'custom_range',
      startDate: customStart,
      endDate: customEnd,
      startIso: range.startIso,
      endIso: range.endIso,
      formattedLabel: range.formattedLabel,
    })
  }

  return (
    <Card className={className}>
      <CardContent className="p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Seletor de Modo e Controles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <Label className="text-xs font-semibold whitespace-nowrap">Filtrar período:</Label>
              <Select
                value={value.mode}
                onValueChange={(val) => handleModeChange(val as PeriodFilterMode)}
              >
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Mês Atual / Mensal</SelectItem>
                  <SelectItem value="custom_range">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modo Mês: Navegação de Mês */}
            {value.mode === 'current_month' && (
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleMonthShift(-1)}
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[140px] text-center px-2">
                  <span className="text-xs font-semibold">{formatMonthName(value.month)}</span>
                  {isCurrentMonth && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-medium">
                      Atual
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleMonthShift(1)}
                  title="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {!isCurrentMonth && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700"
                    onClick={handleResetToCurrentMonth}
                  >
                    Mês atual
                  </Button>
                )}
              </div>
            )}

            {/* Modo Período Personalizado: Inputs De / Até */}
            {value.mode === 'custom_range' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">De:</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs w-36"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value)
                      setCustomError(null)
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Até:</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs w-36"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value)
                      setCustomError(null)
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={handleApplyCustom}
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Aplicar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={handleResetToCurrentMonth}
                  title="Voltar ao mês atual"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Mês atual
                </Button>
              </div>
            )}
          </div>

          {/* Badge Visual do Período Ativo */}
          <div className="flex items-center gap-1.5 self-center">
            <span className="text-[11px] text-muted-foreground">Período ativo:</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              <CalendarIcon className="h-3.5 w-3.5" />
              {value.formattedLabel}
            </span>
          </div>
        </div>

        {customError && <p className="text-xs text-red-500 font-medium pl-1">{customError}</p>}
      </CardContent>
    </Card>
  )
}
