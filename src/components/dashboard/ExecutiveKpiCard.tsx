import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface ExecutiveKpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  bg?: string
  onClick?: () => void
}

export function ExecutiveKpiCard({
  label,
  value,
  icon: Icon,
  color = 'text-blue-600',
  bg = 'bg-blue-50',
  onClick,
}: ExecutiveKpiCardProps) {
  return (
    <Card
      className={`itsm-card itsm-card-hover transition-all duration-200 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
