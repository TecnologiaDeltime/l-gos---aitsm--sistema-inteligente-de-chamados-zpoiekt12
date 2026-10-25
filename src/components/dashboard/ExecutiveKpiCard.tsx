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
  color = 'text-cyan-400',
  bg = 'bg-cyan-500/10 border border-cyan-500/20',
  onClick,
}: ExecutiveKpiCardProps) {
  return (
    <Card
      className={`relative overflow-hidden itsm-card transition-all duration-200 group border border-border/80 bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
      onClick={onClick}
    >
      {/* Sutil linha de acento no topo do card ao passar o mouse */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div
            className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${bg}`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          {onClick && (
            <span className="text-[10px] font-mono text-muted-foreground/60 group-hover:text-primary transition-colors">
              DETALHAR &rarr;
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
