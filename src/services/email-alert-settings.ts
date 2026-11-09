import { pb } from '@/lib/pocketbase/client'

export type EmailTemplateLayout = 'modern' | 'corporate' | 'minimal'

export interface EmailAlertSetting {
  id: string
  alert_key: string
  name: string
  description: string
  category: 'tickets' | 'sla' | 'changes' | 'projects' | 'portal'
  enabled: boolean
  recipient_types: string
  template_layout: EmailTemplateLayout
  primary_color: string
  subject_template: string
  header_title: string
  header_subtitle: string
  body_template: string
  footer_text: string
  show_button: boolean
  button_label: string
  button_url_template: string
  updated?: string
  created?: string
}

export interface EmailSentLog {
  id: string
  alert_key: string
  reference_id: string
  recipient: string
  sent_at: string
  subject: string
  meta?: Record<string, unknown>
}

export const EMAIL_ALERT_SAMPLE_DATA: Record<string, Record<string, string>> = {
  ticket_created: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    descricao:
      'Solicito auxílio para instalar o pacote de telemetria na máquina virtual de produção.',
    cliente: 'Carlos Andrade',
    prioridade: 'Alta',
    tipo: 'Requisição de Serviço',
    data_abertura: '09/11/2026 às 14:30',
    empresa: 'Acme Corporativa',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_status_changed: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    status_anterior: 'Aberto',
    status_novo: 'Em Andamento',
    operador: 'Juliana Lima',
    cliente: 'Carlos Andrade',
    data_atualizacao: '09/11/2026 às 15:10',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_resolved: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    solucao: 'Pacote instalado e serviço validado com sucesso pela equipe N2.',
    cliente: 'Carlos Andrade',
    data_conclusao: '09/11/2026 às 16:45',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_delegated: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    operador_anterior: 'Triagem Geral',
    operador_novo: 'Juliana Lima',
    motivo: 'Direcionado para a fila de Infraestrutura Avançada N2',
    link: 'https://app.logositsm.com.br/tickets/CH-2026-10482',
  },
  sla_breach_warning: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    tipo_sla: 'Primeira Resposta',
    tempo_restante: '15 minutos',
    prazo: '09/11/2026 às 15:30',
    operador: 'Juliana Lima',
    link: 'https://app.logositsm.com.br/tickets/CH-2026-10482',
  },
  change_approval_request: {
    mudanca_numero: 'MUD-2026-94268',
    titulo: 'Atualização do cluster de banco de dados para versão estável',
    solicitante: 'Marcos Vinicius',
    comite_tipo: 'Emergencial',
    data_expiracao: '09/11/2026 às 18:00',
    link: 'https://app.logositsm.com.br/changes/MUD-2026-94268',
  },
  change_voting_deadline: {
    mudanca_numero: 'MUD-2026-94268',
    titulo: 'Atualização do cluster de banco de dados para versão estável',
    comite_tipo: 'Emergencial',
    data_expiracao: '09/11/2026 às 18:00',
    resultado_escalonamento: 'Aprovada com voto do Presidente',
    resumo_votos: '3 aprovado(s), 0 recusado(s), 0 revisão',
    link: 'https://app.logositsm.com.br/changes/MUD-2026-94268',
  },
  project_deadline_alert: {
    projeto_nome: 'Migração Cloud 2026',
    tarefa_nome: 'Provisionamento de infraestrutura segura',
    responsavel: 'Lucas Ribeiro',
    data_prazo: '10/11/2026',
    situacao: 'Vencendo Hoje',
    link: 'https://app.logositsm.com.br/projects/migracao-cloud-2026',
  },
  portal_approval_needed: {
    chamado_numero: 'CH-2026-10482',
    titulo: 'Aquisição de licença de software especializado',
    solicitante: 'Carlos Andrade',
    valor_estimado: 'R$ 1.250,00',
    link: 'https://app.logositsm.com.br/portal?tab=approvals',
  },
}

export function interpolateSampleText(template: string, data: Record<string, string>): string {
  if (!template) return ''
  let res = template
  Object.keys(data).forEach((k) => {
    const rx = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g')
    res = res.replace(rx, data[k] || '')
  })
  return res
}

export async function fetchEmailAlertSettings(): Promise<EmailAlertSetting[]> {
  try {
    const records = await pb.collection('email_alert_settings').getFullList<EmailAlertSetting>({
      sort: 'category,name',
    })
    return records
  } catch (err) {
    console.error('fetchEmailAlertSettings error', err)
    return []
  }
}

export async function updateEmailAlertToggle(id: string, enabled: boolean): Promise<boolean> {
  try {
    await pb.collection('email_alert_settings').update(id, { enabled })
    return true
  } catch (err) {
    console.error('updateEmailAlertToggle error', err)
    throw err
  }
}

export async function updateEmailAlertSetting(
  id: string,
  data: Partial<EmailAlertSetting>,
): Promise<EmailAlertSetting> {
  try {
    const updated = await pb.collection('email_alert_settings').update<EmailAlertSetting>(id, data)
    return updated
  } catch (err) {
    console.error('updateEmailAlertSetting error', err)
    throw err
  }
}

export async function fetchEmailSentLogs(limit = 50): Promise<EmailSentLog[]> {
  try {
    const records = await pb.collection('email_sent_logs').getList<EmailSentLog>(1, limit, {
      sort: '-sent_at',
    })
    return records.items
  } catch (err) {
    console.error('fetchEmailSentLogs error', err)
    return []
  }
}
