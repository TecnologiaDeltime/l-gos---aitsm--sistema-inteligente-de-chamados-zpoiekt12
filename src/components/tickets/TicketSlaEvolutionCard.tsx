import { Clock } from 'lucide-react'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { ContextTip } from '@/components/ContextTip'
import { TicketSheetCard } from '@/components/tickets/TicketSheetCard'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
import type { TicketRecord } from '@/services/tickets'

interface TicketSlaEvolutionCardProps {
  ticket: TicketRecord
}

/**
 * Card "Evolução do SLA" da ficha do chamado: restaura a visão histórica com
 * a barra de progresso (decorrido vs. meta), prazo, tempo restante e pausas
 * do SLA Resposta e do SLA Solução — reintroduzida via SlaDetailBlock.
 * Usa apenas tokens do tema + acentos semânticos já usados na ficha.
 */
export function TicketSlaEvolutionCard({ ticket }: TicketSlaEvolutionCardProps) {
  return (
    <TicketSheetCard
      title={
        <span className="flex items-center gap-1.5">
          Evolução do SLA
          <ContextTip
            label="Como ler o SLA"
            text="A barra mostra o tempo DECORRIDO contra a META acordada com o cliente: verde dentro do prazo, âmbar/vermelho perto ou estourado. Quando o SLA está pausado, o prazo congela e o tempo pausado não conta — diferentemente do ciclo de trabalho, que é o seu cronômetro pessoal."
            align="end"
          />
        </span>
      }
      icon={<Clock className="h-3.5 w-3.5" />}
      contentClassName="space-y-3"
    >
      <SlaDetailBlock
        type="response"
        status={computeSlaResponseStatus(ticket)}
        deadline={ticket.sla_response_deadline}
        completedAt={ticket.sla_response_at || ticket.sla_response_start}
        createdAt={ticket.created}
        responseTimeSeconds={ticket.sla_response_time_seconds}
        compliance={ticket.sla_response_compliance}
      />
      <SlaDetailBlock
        type="solution"
        status={computeSlaSolutionStatus(ticket)}
        deadline={ticket.sla_solution_deadline}
        completedAt={ticket.sla_solution_at}
        createdAt={ticket.created}
        totalPauseMinutes={ticket.sla_pause_total_minutes || 0}
      />
    </TicketSheetCard>
  )
}
