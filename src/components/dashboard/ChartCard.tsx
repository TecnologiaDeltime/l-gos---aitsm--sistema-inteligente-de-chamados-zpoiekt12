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
    <Card className={`itsm-card ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}
