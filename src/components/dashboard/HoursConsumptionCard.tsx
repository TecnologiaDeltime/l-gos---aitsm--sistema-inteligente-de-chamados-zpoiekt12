import { Card, CardContent } from '@/components/ui/card'

interface HoursConsumptionCardProps {
  contractedHours: number
  consumedMinutes: number
  consumedDisplay: string
}

export function HoursConsumptionCard({
  contractedHours,
  consumedMinutes,
  consumedDisplay,
}: HoursConsumptionCardProps) {
  const consumedHours = consumedMinutes / 60
  const balanceHours = contractedHours - consumedHours
  const pct = contractedHours > 0 ? (consumedHours / contractedHours) * 100 : 0

  let riskLevel = 'normal'
  let riskColor = 'text-green-600'
  let barColor = 'bg-green-500'
  let riskLabel = 'Normal'

  if (pct > 100) {
    riskLevel = 'excedido'
    riskColor = 'text-red-700'
    barColor = 'bg-red-700'
    riskLabel = 'Excedido'
  } else if (pct >= 86) {
    riskLevel = 'critico'
    riskColor = 'text-red-600'
    barColor = 'bg-red-500'
    riskLabel = 'Crítico'
  } else if (pct >= 71) {
    riskLevel = 'atencao'
    riskColor = 'text-amber-600'
    barColor = 'bg-amber-500'
    riskLabel = 'Atenção'
  }

  return (
    <Card className="itsm-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Saldo de Horas</span>
          <span className={`text-xs font-bold ${riskColor}`}>{riskLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Contratadas</p>
            <p className="text-sm font-bold text-foreground">{contractedHours.toFixed(0)}h</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Consumidas</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{consumedDisplay}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Saldo</p>
            <p
              className={`text-sm font-bold ${balanceHours < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {balanceHours.toFixed(1)}h
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{pct.toFixed(1)}% consumido</span>
            <span>{(100 - pct).toFixed(1)}% disponível</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
