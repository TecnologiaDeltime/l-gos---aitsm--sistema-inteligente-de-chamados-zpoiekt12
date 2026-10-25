import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function ChartCard({ title, children, action, className }: ChartCardProps) {
  return (
    <Card
      className={`itsm-card border border-border/80 bg-card/95 shadow-sm hover:border-border transition-colors ${className || ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}
