import { ChartCard } from '@/components/dashboard/ChartCard'
import { SlaGauge } from '@/components/dashboard/SlaGauge'
import { computeSlaByPriority } from '@/lib/dashboard-metrics'
import { useMemo } from 'react'
import type { TicketRecord } from '@/services/tickets'

interface SlaPrioritySectionProps {
  tickets: TicketRecord[]
}

export function SlaPrioritySection({ tickets }: SlaPrioritySectionProps) {
  const slaData = useMemo(() => computeSlaByPriority(tickets), [tickets])

  return (
    <ChartCard title="Cumprimento de Meta por Prioridade">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {slaData.map((d) => (
          <SlaGauge key={d.priority} data={d} />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Verde ≥ 90% · Amarelo ≥ 80% e &lt; 90% · Vermelho &lt; 80%
      </p>
    </ChartCard>
  )
}
