import { useState, useMemo } from 'react'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { HoursConsumptionCard } from '@/components/dashboard/HoursConsumptionCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMinutes } from '@/lib/duration'
import { computeConsumedMinutesByDimension } from '@/lib/dashboard-metrics'
import type { DashboardData } from '@/services/dashboard'

interface HoursSectionProps {
  data: DashboardData
  contractedHours: number
  consumedMinutes: number
  consumedDisplay: string
}

type Dimension = 'client' | 'operator' | 'contract' | 'technician' | 'total'

const DIM_LABELS: Record<Dimension, string> = {
  total: 'Total geral',
  client: 'Por cliente',
  operator: 'Por autor',
  contract: 'Por contrato',
  technician: 'Por operador',
}

export function HoursSection({
  data,
  contractedHours,
  consumedMinutes,
  consumedDisplay,
}: HoursSectionProps) {
  const [dimension, setDimension] = useState<Dimension>('total')

  const breakdown = useMemo(() => {
    if (dimension === 'total') return []
    return computeConsumedMinutesByDimension(data, dimension)
  }, [data, dimension])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <HoursConsumptionCard
        contractedHours={contractedHours}
        consumedMinutes={consumedMinutes}
        consumedDisplay={consumedDisplay}
      />
      <ChartCard
        title="Horas Consumidas"
        action={
          <Select value={dimension} onValueChange={(v) => setDimension(v as Dimension)}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIM_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {dimension === 'total' ? (
          <div className="flex items-center justify-center h-[180px]">
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-foreground">{consumedDisplay}</p>
              <p className="text-xs text-muted-foreground mt-1">Total consumido no período</p>
            </div>
          </div>
        ) : breakdown.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sem dados</p>
        ) : (
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[60%]">{item.label}</span>
                <span className="font-bold tabular-nums">{formatMinutes(item.minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  )
}
