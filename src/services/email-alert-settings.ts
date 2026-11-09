import pb from '@/lib/pocketbase/client'

export type EmailTemplateLayout = 'modern' | 'corporate' | 'minimal'

export interface VariableHint {
  key: string
  desc: string
  sample?: string
}

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
  default_subject_template?: string
  header_title: string
  header_subtitle: string
  body_template: string
  default_body_template?: string
  is_customized?: boolean
  footer_text: string
  show_button: boolean
  button_label: string
  button_url_template: string
  variables_hint?: VariableHint[] | string
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
    numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    descricao:
      'Solicito auxílio para instalar o pacote de telemetria na máquina virtual de produção.',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    prioridade: 'Alta',
    tipo: 'Requisição de Serviço',
    fila: 'Infraestrutura Cloud',
    data_abertura: '09/11/2026 às 14:30',
    data_hora: '09/11/2026 às 14:30',
    empresa: 'Acme Soluções Corporativas',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_status_changed: {
    chamado_numero: 'CH-2026-10482',
    numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    status: 'Em Andamento',
    status_novo: 'Em Andamento',
    status_anterior: 'Aberto',
    responsavel: 'Juliana Lima',
    operador: 'Juliana Lima',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    fila: 'Infraestrutura Avançada N2',
    data_hora: '09/11/2026 às 15:10',
    data_atualizacao: '09/11/2026 às 15:10',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_resolved: {
    chamado_numero: 'CH-2026-10482',
    numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    solucao: 'Pacote instalado e serviço validado com sucesso pela equipe N2.',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    responsavel: 'Juliana Lima',
    operador: 'Juliana Lima',
    data_hora: '09/11/2026 às 16:45',
    data_conclusao: '09/11/2026 às 16:45',
    link: 'https://app.logositsm.com.br/portal?tab=tickets&openTicketId=CH-2026-10482',
  },
  ticket_delegated: {
    chamado_numero: 'CH-2026-10482',
    numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    responsavel: 'Juliana Lima',
    operador: 'Juliana Lima',
    operador_anterior: 'Triagem Geral',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    empresa: 'Acme Soluções Corporativas',
    prioridade: 'Alta',
    fila: 'Infraestrutura Avançada N2',
    prazo_sla: '09/11/2026 às 17:30 (em 2h 20m)',
    data_hora: '09/11/2026 às 15:10',
    motivo: 'Direcionado para a fila de Infraestrutura Avançada N2',
    link: 'https://app.logositsm.com.br/tickets/CH-2026-10482',
  },
  sla_response_alert: {
    chamado_numero: 'CH-2026-10482',
    numero: 'CH-2026-10482',
    titulo: 'Instalação de software de telemetria no servidor N2',
    responsavel: 'Juliana Lima',
    operador: 'Juliana Lima',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    empresa: 'Acme Soluções Corporativas',
    prazo_sla: '15 minutos restantes',
    tempo_restante: '15 minutos',
    prazo: '09/11/2026 às 15:30',
    prioridade: 'Alta',
    fila: 'Infraestrutura Avançada N2',
    data_hora: '09/11/2026 às 15:15',
    link: 'https://app.logositsm.com.br/tickets/CH-2026-10482',
  },
  change_approval_request: {
    mudanca_numero: 'MUD-2026-94268',
    numero: 'MUD-2026-94268',
    titulo: 'Atualização do cluster de banco de dados para versão estável',
    responsavel: 'Fernanda Oliveira (Comitê)',
    aprovador: 'Fernanda Oliveira',
    cliente: 'Marcos Vinicius',
    solicitante: 'Marcos Vinicius',
    comite_tipo: 'Emergencial',
    tipo: 'Mudança Normal de Infraestrutura',
    prioridade: 'Alto Risco',
    prazo_sla: '09/11/2026 às 18:00',
    prazo_votacao: '09/11/2026 às 18:00',
    data_hora: '09/11/2026 às 14:00',
    data_expiracao: '09/11/2026 às 18:00',
    link: 'https://app.logositsm.com.br/changes/MUD-2026-94268',
  },
  change_voting_deadline: {
    mudanca_numero: 'MUD-2026-94268',
    numero: 'MUD-2026-94268',
    titulo: 'Atualização do cluster de banco de dados para versão estável',
    comite_tipo: 'Emergencial',
    status: 'Aprovada com voto do Presidente',
    responsavel: 'Equipe de Liberações',
    descricao: '3 votos favoráveis, 0 contrários. RDM escalonada e liberada para implantação.',
    data_hora: '09/11/2026 às 18:00',
    data_expiracao: '09/11/2026 às 18:00',
    resultado_escalonamento: 'Aprovada com voto do Presidente',
    resumo_votos: '3 aprovado(s), 0 recusado(s), 0 revisão',
    link: 'https://app.logositsm.com.br/changes/MUD-2026-94268',
  },
  project_deadline: {
    titulo: 'Migração Cloud 2026: Provisionamento de VMs',
    projeto_nome: 'Migração Cloud 2026',
    status: 'Vencendo Hoje',
    responsavel: 'Lucas Ribeiro',
    prazo_sla: '10/11/2026',
    data_limite: '10/11/2026',
    data_hora: '09/11/2026 às 16:00',
    link: 'https://app.logositsm.com.br/projects/migracao-cloud-2026',
  },
  portal_approval_request: {
    chamado_numero: 'CH-2026-10482',
    numero: 'CH-2026-10482',
    titulo: 'Aquisição de licença de software especializado',
    responsavel: 'Roberto Almeida (Diretoria TI)',
    aprovador: 'Roberto Almeida',
    cliente: 'Carlos Andrade',
    solicitante: 'Carlos Andrade',
    empresa: 'Acme Soluções Corporativas',
    descricao:
      'Solicitação de licença Docker Desktop Enterprise com investimento anual previsto de R$ 1.250,00.',
    justificativa: 'Necessário para ambiente de testes de novos microserviços.',
    prazo_sla: '11/11/2026 às 18:00',
    data_hora: '09/11/2026 às 14:35',
    link: 'https://app.logositsm.com.br/portal?tab=approvals',
  },
}

export function interpolateSampleText(template: string, data: Record<string, string>): string {
  if (!template) return ''
  let res = template
  const merged: Record<string, string> = { ...data }

  // Aliases universais
  if (merged.chamado_numero && !merged.numero) merged.numero = merged.chamado_numero
  if (merged.mudanca_numero && !merged.numero) merged.numero = merged.mudanca_numero
  if (merged.cliente && !merged.solicitante) merged.solicitante = merged.cliente
  if (merged.solicitante && !merged.cliente) merged.cliente = merged.solicitante
  if (merged.responsavel && !merged.operador) merged.operador = merged.responsavel
  if (merged.operador && !merged.responsavel) merged.responsavel = merged.operador
  if (merged.prazo_sla && !merged.prazo) merged.prazo = merged.prazo_sla
  if (merged.prazo && !merged.prazo_sla) merged.prazo_sla = merged.prazo
  if (merged.data_abertura && !merged.data_hora) merged.data_hora = merged.data_abertura
  if (merged.data_hora && !merged.data_abertura) merged.data_abertura = merged.data_hora
  if (merged.projeto_nome && !merged.titulo) merged.titulo = merged.projeto_nome

  Object.keys(merged).forEach((k) => {
    const rx = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi')
    res = res.replace(rx, merged[k] || '')
  })

  // Limpeza de variáveis desconhecidas ou vazias
  res = res.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')

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
