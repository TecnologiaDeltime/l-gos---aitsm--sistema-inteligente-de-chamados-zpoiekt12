import pb from '@/lib/pocketbase/client'
import { MonthlyClientReportData } from '@/services/monthly-client-report'

export interface ClientMonthlyReportRecord {
  id: string
  company: string
  month_key: string
  period_label: string
  status: 'rascunho' | 'liberado' | 'arquivado'
  released_to_client: boolean
  released_at?: string
  released_by?: string
  generated_by?: string
  summary_notes?: string
  report_data?: MonthlyClientReportData | any
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      legal_name?: string
      trade_name?: string
    }
    released_by?: {
      id: string
      name?: string
      email?: string
    }
    generated_by?: {
      id: string
      name?: string
      email?: string
    }
  }
}

/**
 * Busca relatórios mensais liberados para a empresa do cliente (portal do cliente).
 * Retorna APENAS os relatórios que possuem released_to_client = true.
 */
export async function getReleasedMonthlyReportsForCompany(
  companyId: string,
): Promise<ClientMonthlyReportRecord[]> {
  if (!companyId) return []
  try {
    return await pb.collection('client_monthly_reports').getFullList<ClientMonthlyReportRecord>({
      filter: `company = "${companyId}" && released_to_client = true`,
      sort: '-month_key',
      expand: 'company,released_by,generated_by',
    })
  } catch (err) {
    console.warn('Erro ao carregar relatórios mensais liberados:', err)
    return []
  }
}

/**
 * Busca o status de publicação/liberação de um relatório específico de um mês e empresa (área interna).
 */
export async function getClientMonthlyReportRecord(
  companyId: string,
  monthKey: string,
): Promise<ClientMonthlyReportRecord | null> {
  if (!companyId || !monthKey) return null
  try {
    const list = await pb
      .collection('client_monthly_reports')
      .getFullList<ClientMonthlyReportRecord>({
        filter: `company = "${companyId}" && month_key = "${monthKey}"`,
        limit: 1,
        sort: '-created',
        expand: 'released_by,generated_by',
      })
    return list[0] || null
  } catch {
    return null
  }
}

/**
 * Salva ou atualiza um relatório mensal gerado pela equipe interna (com snapshot de dados).
 */
export async function saveClientMonthlyReportRecord(params: {
  companyId: string
  monthKey: string
  periodLabel: string
  reportData?: any
  summaryNotes?: string
  userId?: string
}): Promise<ClientMonthlyReportRecord> {
  const existing = await getClientMonthlyReportRecord(params.companyId, params.monthKey)

  const payload: any = {
    company: params.companyId,
    month_key: params.monthKey,
    period_label: params.periodLabel,
    report_data: params.reportData,
  }

  if (params.summaryNotes !== undefined) {
    payload.summary_notes = params.summaryNotes
  }
  if (params.userId) {
    payload.generated_by = params.userId
  }

  if (existing) {
    return pb
      .collection('client_monthly_reports')
      .update<ClientMonthlyReportRecord>(existing.id, payload)
  }

  return pb.collection('client_monthly_reports').create<ClientMonthlyReportRecord>({
    ...payload,
    status: 'rascunho',
    released_to_client: false,
  })
}

/**
 * Libera o relatório mensal para visualização no Portal do Cliente.
 */
export async function releaseMonthlyReportToClient(
  companyId: string,
  monthKey: string,
  periodLabel: string,
  userId: string,
  reportData?: any,
  notes?: string,
): Promise<ClientMonthlyReportRecord> {
  const existing = await getClientMonthlyReportRecord(companyId, monthKey)

  const payload = {
    company: companyId,
    month_key: monthKey,
    period_label: periodLabel,
    status: 'liberado',
    released_to_client: true,
    released_at: new Date().toISOString(),
    released_by: userId,
    report_data: reportData,
    summary_notes: notes,
  }

  if (existing) {
    return pb
      .collection('client_monthly_reports')
      .update<ClientMonthlyReportRecord>(existing.id, payload)
  }

  return pb.collection('client_monthly_reports').create<ClientMonthlyReportRecord>({
    ...payload,
    generated_by: userId,
  })
}

/**
 * Revoga a liberação do relatório mensal (recolhe de volta para rascunho/interno).
 */
export async function unreleaseMonthlyReportFromClient(
  reportId: string,
): Promise<ClientMonthlyReportRecord> {
  return pb.collection('client_monthly_reports').update<ClientMonthlyReportRecord>(reportId, {
    status: 'rascunho',
    released_to_client: false,
  })
}
