/**
 * Serviço do Relatório de Aprovações.
 * Busca decisões de aprovação (Aprovado/Reprovado) de chamados, cruzadas com
 * tickets (número, título, solicitante, empresa) e aprovadores.
 */
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export interface ApprovalReportRow {
  id: string
  decisionDate: string // dd/MM/yyyy HH:mm
  ticketId: string
  ticketNumber: string
  ticketTitle: string
  status: 'Aprovado' | 'Reprovado'
  reason: string
  requesterName: string
  approverName: string
  companyId: string
  companyName: string
}

interface ApprovalRawRecord {
  id: string
  status: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  approver_comment?: string
  target_email?: string
  approver?: string
  target_contact?: string
  ticket?: string
  expand?: {
    approver?: { name?: string; email?: string }
    target_contact?: { full_name?: string; name?: string }
    ticket?: {
      number?: string
      title?: string
      requester_name?: string
      company?: string
      expand?: {
        company?: { name?: string; trade_name?: string }
      }
    }
  }
}

function fmtDateTime(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Busca as decisões de aprovação (Aprovado/Reprovado) no período (data da decisão —
 * approved_at / rejected_at) e da empresa do chamado.
 */
export async function getApprovalReportRows(params: {
  startDate: string
  endDate: string
  companyId: string
}): Promise<ApprovalReportRow[]> {
  try {
    const sd = params.startDate || '2000-01-01'
    const ed = params.endDate || '2099-12-31'
    const parts = [
      `(status = 'Aprovado' || status = 'Reprovado')`,
      `((approved_at >= '${sd} 00:00:00.000Z' && approved_at <= '${ed} 23:59:59.999Z') || (rejected_at >= '${sd} 00:00:00.000Z' && rejected_at <= '${ed} 23:59:59.999Z'))`,
    ]

    if (params.companyId && params.companyId !== 'all') {
      parts.push(`ticket.company = '${params.companyId}'`)
    }

    const records = await pb.collection('approvals').getFullList<ApprovalRawRecord>({
      filter: parts.join(' && '),
      expand: 'ticket,ticket.company,approver,target_contact',
      sort: '-updated',
    })

    return records.map((rec) => {
      const t = rec.expand?.ticket
      const approver = rec.expand?.approver
      const contact = rec.expand?.target_contact
      const decidedAt = rec.approved_at || rec.rejected_at

      const requesterName = t?.requester_name || '—'

      const approverName =
        approver?.name ||
        approver?.email ||
        contact?.full_name ||
        contact?.name ||
        rec.target_email ||
        '—'

      const companyName = t?.expand?.company?.trade_name || t?.expand?.company?.name || '—'
      const ticketNumber = String(t?.number || '—')

      return {
        id: rec.id,
        decisionDate: fmtDateTime(decidedAt),
        ticketId: rec.ticket || '',
        ticketNumber,
        ticketTitle: t?.title || '—',
        status: (rec.status === 'Aprovado' ? 'Aprovado' : 'Reprovado') as 'Aprovado' | 'Reprovado',
        // Motivo: na reprovação é o motivo do aprovador; na aprovação, o comentário (se houver)
        reason:
          rec.status === 'Reprovado'
            ? rec.rejection_reason || rec.approver_comment || ''
            : rec.approver_comment || '',
        requesterName,
        approverName,
        companyId: t?.company || '',
        companyName,
      }
    })
  } catch (err) {
    throw new Error(getErrorMessage(err))
  }
}
