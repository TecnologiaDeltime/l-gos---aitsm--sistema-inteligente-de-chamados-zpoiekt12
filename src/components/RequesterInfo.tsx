import { useState, useEffect } from 'react'
import { User, Phone, Building2, Network, Pencil, History, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TicketRecord } from '@/services/tickets'
import { RequesterEditDialog } from '@/components/RequesterEditDialog'
import { RequesterHistoryDialog } from '@/components/RequesterHistoryDialog'
import { RequesterProfileDialog } from '@/components/RequesterProfileDialog'
import { resolveDepartment } from '@/lib/department-resolver'

interface RequesterInfoProps {
  ticket: TicketRecord | null
  onUpdated?: () => void
}

function formatTelLink(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return `tel:+55${digits}`
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <span className="text-slate-400 block">{label}</span>
        {href && value ? (
          <a href={href} className="text-primary hover:underline font-medium break-words">
            {value}
          </a>
        ) : (
          <span className="text-slate-700 dark:text-slate-200 font-medium break-words">
            {value || '—'}
          </span>
        )}
      </div>
    </div>
  )
}

export function RequesterInfo({ ticket, onUpdated }: RequesterInfoProps) {
  const [showEdit, setShowEdit] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [inferredDept, setInferredDept] = useState<string | null>(null)

  useEffect(() => {
    if (ticket?.department) {
      setInferredDept(null)
      return
    }
    if (!ticket?.company) {
      setInferredDept(null)
      return
    }
    let cancelled = false
    resolveDepartment({
      companyId: ticket.company,
      requesterEmail: ticket.requester_email || undefined,
      unitId: ticket.unit || undefined,
    })
      .then((dept) => {
        if (!cancelled) setInferredDept(dept?.name || null)
      })
      .catch(() => {
        if (!cancelled) setInferredDept(null)
      })
    return () => {
      cancelled = true
    }
  }, [ticket?.department, ticket?.company, ticket?.requester_email, ticket?.unit])

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
  const telHref = formatTelLink(ticket.requester_phone)

  return (
    <>
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-semibold text-sm">Solicitante</h3>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setShowEdit(true)}
              title="Editar solicitante"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-2.5">
          <InfoRow icon={User} label="Nome" value={ticket.requester_name} />
          <InfoRow icon={Phone} label="Telefone" value={ticket.requester_phone} href={telHref} />
          {departmentName ? (
            <InfoRow icon={Building2} label="Setor" value={departmentName} />
          ) : inferredDept ? (
            <div className="flex items-start gap-2 text-xs">
              <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-slate-400 block">Setor</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-700 dark:text-slate-200 font-medium italic break-words">
                    {inferredDept}
                  </span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                    automático
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <InfoRow icon={Building2} label="Setor" value={null} />
          )}
          <InfoRow icon={Network} label="Filial" value={unitName} />
        </div>
        <div className="flex flex-col gap-1.5 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs justify-start"
            onClick={() => setShowProfile(true)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver perfil completo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs justify-start"
            onClick={() => setShowHistory(true)}
          >
            <History className="mr-1.5 h-3.5 w-3.5" /> Histórico do Solicitante
          </Button>
        </div>
      </div>

      <RequesterEditDialog
        ticket={ticket}
        open={showEdit}
        onOpenChange={setShowEdit}
        onSaved={onUpdated}
      />
      <RequesterHistoryDialog
        email={ticket.requester_email || ''}
        currentTicketId={ticket.id}
        open={showHistory}
        onOpenChange={setShowHistory}
      />
      <RequesterProfileDialog ticket={ticket} open={showProfile} onOpenChange={setShowProfile} />
    </>
  )
}
