import { useState, useEffect } from 'react'
import { User, Phone, Mail, Building2, Network, Briefcase } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { TicketRecord } from '@/services/tickets'
import { resolveDepartment } from '@/lib/department-resolver'

interface Props {
  ticket: TicketRecord
  open: boolean
  onOpenChange: (v: boolean) => void
}

function formatTelLink(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return `tel:+55${digits}`
}

function ProfileRow({
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
    <div className="flex items-start gap-3 rounded-lg border p-3 bg-slate-50 dark:bg-slate-800/50">
      <Icon className="h-5 w-5 mt-0.5 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-slate-400 block">{label}</span>
        {href && value ? (
          <a href={href} className="text-sm text-primary hover:underline font-medium break-words">
            {value}
          </a>
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-200 font-medium break-words">
            {value || '—'}
          </span>
        )}
      </div>
    </div>
  )
}

export function RequesterProfileDialog({ ticket, open, onOpenChange }: Props) {
  const [inferredDept, setInferredDept] = useState<string | null>(null)
  const departmentName = ticket.expand?.department?.name

  useEffect(() => {
    if (!open) return
    if (ticket.department) {
      setInferredDept(null)
      return
    }
    if (!ticket.company) {
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
  }, [open, ticket.department, ticket.company, ticket.requester_email, ticket.unit])
  const unitName = ticket.expand?.unit?.name
  const companyName = ticket.expand?.company?.trade_name || ticket.expand?.company?.legal_name
  const telHref = formatTelLink(ticket.requester_phone)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Perfil do Solicitante</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <ProfileRow icon={User} label="Nome" value={ticket.requester_name} />
          <ProfileRow icon={Mail} label="E-mail" value={ticket.requester_email} />
          <ProfileRow icon={Phone} label="Telefone" value={ticket.requester_phone} href={telHref} />
          {departmentName ? (
            <ProfileRow icon={Building2} label="Setor" value={departmentName} />
          ) : inferredDept ? (
            <div className="flex items-start gap-3 rounded-lg border p-3 bg-slate-50 dark:bg-slate-800/50">
              <Building2 className="h-5 w-5 mt-0.5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-slate-400 block">Setor</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-slate-700 dark:text-slate-200 font-medium italic break-words">
                    {inferredDept}
                  </span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                    automático
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <ProfileRow icon={Building2} label="Setor" value={null} />
          )}
          <ProfileRow icon={Network} label="Filial" value={unitName} />
          <ProfileRow icon={Briefcase} label="Empresa" value={companyName} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
