/**
 * Serviço do Relatório de Aprovações.
 * Busca decisões de aprovação (Aprovado/Reprovado) e pendências (Pendente) de
 * chamados, cruzadas com tickets (número, título, solicitante, empresa) e aprovadores.
 */
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export type ApprovalReportStatus = 'Aprovado' | 'Reprovado' | 'Pendente'

export interface ApprovalReportRow {
  id: string
  decisionDate: string // dd/MM/yyyy HH:mm
  ticketId: string
  ticketNumber: string
  ticketTitle: string
  status: ApprovalReportStatus
  reason: string
  requesterName: string
  approverName: string
  companyId: string
  companyName: string
}

interface ApprovalRawRecord {
  id: string
  status: string
  created?: string
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
 * Busca aprovações de chamados no período e da empresa informados.
 * - Decididas (Aprovado/Reprovado): o período filtra pela data da decisão
 *   (approved_at / rejected_at).
 * - Pendentes (Pendente): o período filtra pela data de criação da aprovação (created).
 */
export async function getApprovalReportRows(params: {
  startDate: string
  endDate: string
  companyId: string
}): Promise<ApprovalReportRow[]> {
  try {
    const sd = params.startDate || '2000-01-01'
    const ed = params.endDate || '2099-12-31'

    const period = (field: string) =>
      `(${field} >= '${sd} 00:00:00.000Z' && ${field} <= '${ed} 23:59:59.999Z')`

    const parts = [
      `((status = 'Aprovado' && ${period('approved_at')}) || (status = 'Reprovado' && ${period('rejected_at')}) || (status = 'Pendente' && ${period('created')}))`,
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
      const isPending = rec.status === 'Pendente'
      // Pendente: data da criação da aprovação; decidida: data da decisão
      const rowDate = isPending ? rec.created : rec.approved_at || rec.rejected_at

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

      const status: ApprovalReportStatus = isPending
        ? 'Pendente'
        : rec.status === 'Aprovado'
          ? 'Aprovado'
          : 'Reprovado'

      return {
        id: rec.id,
        decisionDate: fmtDateTime(rowDate),
        ticketId: rec.ticket || '',
        ticketNumber,
        ticketTitle: t?.title || '—',
        status,
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
