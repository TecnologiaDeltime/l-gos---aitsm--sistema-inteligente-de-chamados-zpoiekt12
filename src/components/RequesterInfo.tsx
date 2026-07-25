import { User, Phone, Building2, Network } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { TicketRecord } from '@/services/tickets'

interface RequesterInfoProps {
  ticket: TicketRecord | null
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <span className="text-slate-400 block">{label}</span>
        <span className="text-slate-700 dark:text-slate-200 font-medium break-words">
          {value || 'Não informado'}
        </span>
      </div>
    </div>
  )
}

export function RequesterInfo({ ticket }: RequesterInfoProps) {
  if (!ticket) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4 dark:bg-slate-900">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  const departmentName = ticket.expand?.department?.name
  const unitName = ticket.expand?.unit?.name

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900">
      <h3 className="font-semibold text-sm border-b pb-2">Solicitante</h3>
      <div className="space-y-2.5">
        <InfoRow icon={User} label="Nome" value={ticket.requester_name} />
        <InfoRow icon={Phone} label="Telefone" value={ticket.requester_phone} />
        <InfoRow icon={Building2} label="Setor" value={departmentName} />
        <InfoRow icon={Network} label="Filial" value={unitName} />
      </div>
    </div>
  )
}
