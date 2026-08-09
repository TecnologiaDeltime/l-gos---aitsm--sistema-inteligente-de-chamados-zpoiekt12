import type { SlaPriorityData } from '@/lib/dashboard-metrics'

interface SlaGaugeProps {
  data: SlaPriorityData
}

const STATUS_COLORS: Record<string, string> = {
  atingida: '#22c55e',
  proxima: '#eab308',
  nao_atingida: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  atingida: '🟢 Atingida',
  proxima: '🟡 Próxima da meta',
  nao_atingida: '🔴 Não atingida',
}

export function SlaGauge({ data }: SlaGaugeProps) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(data.pct, 100) / 100) * circumference
  const color = STATUS_COLORS[data.status]

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card">
      <div className="relative w-[130px] h-[130px]">
        <svg width="130" height="130" className="-rotate-90">
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="9"
          />
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{data.pct.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground">Meta: {data.target}%</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">{data.priority}</p>
      <span className="text-[10px] font-medium" style={{ color }}>
        {STATUS_LABELS[data.status]}
      </span>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>✅ {data.withinTarget}</span>
        <span>❌ {data.outsideTarget}</span>
        <span>Total: {data.total}</span>
      </div>
    </div>
  )
}
