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

export interface EmailAlertFactoryTemplate {
  subject_template: string
  body_template: string
  header_title: string
  header_subtitle: string
  footer_text: string
  button_label: string
  button_url_template: string
  show_button: boolean
  primary_color: string
  template_layout: EmailTemplateLayout
}

export const DEFAULT_EMAIL_ALERT_FACTORY_TEMPLATES: Record<string, EmailAlertFactoryTemplate> = {
  ticket_created: {
    subject_template: 'Chamado #{{chamado_numero}} registrado com sucesso - {{titulo}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Atendimento & Central de Serviços',
    body_template:
      '<p>Olá <strong>{{cliente}}</strong>,</p>' +
      '<p>Seu chamado foi registrado com sucesso em nossa central e já se encontra na fila de atendimento.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Tipo / Prioridade:</strong> {{tipo}} • {{prioridade}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Data e Hora:</strong> {{data_hora}}</p>' +
      '<p style="margin: 0;"><strong>Descrição:</strong> {{descricao}}</p>' +
      '</div>' +
      '<p>Nossa equipe técnica já foi acionada e iniciará o suporte dentro do prazo acordado.</p>',
    footer_text: 'Lógos AITSM • Central de Serviços Inteligente',
    button_label: 'Acompanhar no Portal',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#D97706',
    template_layout: 'modern',
  },
  ticket_status_changed: {
    subject_template: 'Atualização no Chamado #{{chamado_numero}}: status alterado para {{status}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Atualização de Chamado',
    body_template:
      '<p>Olá <strong>{{cliente}}</strong>,</p>' +
      '<p>Houve uma atualização no andamento do seu chamado <strong>#{{chamado_numero}}</strong>.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #2563EB; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Novo Status:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: bold;">{{status}}</span></p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Status Anterior:</strong> {{status_anterior}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Responsável Técnico:</strong> {{responsavel}}</p>' +
      '<p style="margin: 0;"><strong>Data e Hora:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Você pode acompanhar notas de andamento ou enviar mais informações pelo Portal.</p>',
    footer_text: 'Lógos AITSM • Central de Serviços Inteligente',
    button_label: 'Ver Chamado',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#2563EB',
    template_layout: 'modern',
  },
  ticket_resolved: {
    subject_template: 'Chamado #{{chamado_numero}} foi Concluído - {{titulo}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Atendimento Concluído',
    body_template:
      '<p>Olá <strong>{{cliente}}</strong>,</p>' +
      '<p>Seu chamado <strong>#{{chamado_numero}}</strong> foi finalizado por nossa equipe técnica.</p>' +
      '<div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Responsável:</strong> {{responsavel}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Data de Conclusão:</strong> {{data_hora}}</p>' +
      '<p style="margin: 0;"><strong>Solução Aplicada:</strong> {{solucao}}</p>' +
      '</div>' +
      '<p>Caso precise de suporte complementar, basta responder este e-mail ou reabrir pelo portal.</p>',
    footer_text: 'Lógos AITSM • Central de Serviços Inteligente',
    button_label: 'Avaliar Atendimento',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#16A34A',
    template_layout: 'modern',
  },
  ticket_delegated: {
    subject_template: '[Atribuição] Chamado #{{chamado_numero}} atribuído a você - {{titulo}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Atribuição de Tarefa',
    body_template:
      '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
      '<p>O chamado <strong>#{{chamado_numero}}</strong> foi atribuído para o seu atendimento técnico.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Cliente:</strong> {{cliente}} ({{empresa}})</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Prazo SLA:</strong> {{prazo_sla}}</p>' +
      '<p style="margin: 0;"><strong>Atribuído em:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Por favor, acesse o painel técnico e registre o primeiro contato dentro do prazo estipulado.</p>',
    footer_text: 'Lógos AITSM • Gestão Operacional de Serviços',
    button_label: 'Atender Chamado',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#D97706',
    template_layout: 'corporate',
  },
  sla_response_alert: {
    subject_template: '⚠️ Alerta de SLA: Chamado #{{chamado_numero}} vence em {{prazo_sla}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Monitoramento de SLA',
    body_template:
      '<p>Atenção <strong>{{responsavel}}</strong>,</p>' +
      '<p>O chamado <strong>#{{chamado_numero}}</strong> está próximo do limite ou em risco de estouro de SLA.</p>' +
      '<div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Cliente / Empresa:</strong> {{cliente}} ({{empresa}})</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Prazo Limite / Restante:</strong> <span style="color: #DC2626; font-weight: bold;">{{prazo_sla}}</span></p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
      '<p style="margin: 0;"><strong>Alerta gerado em:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Aja prontamente no chamado para preservar o cumprimento dos acordos contratuais.</p>',
    footer_text: 'Lógos AITSM • Gestão e Controle de SLA',
    button_label: 'Acessar Chamado Imediatamente',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#DC2626',
    template_layout: 'corporate',
  },
  change_approval_request: {
    subject_template: '[RDM] Aprovação Pendente - Mudança #{{mudanca_numero}} ({{titulo}})',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Comitê de Gestão de Mudanças',
    body_template:
      '<p>Prezado(a) <strong>{{responsavel}}</strong>,</p>' +
      '<p>Uma nova Requisição de Mudança (RDM) requer sua avaliação e voto no Comitê <strong>{{comite_tipo}}</strong>.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Número da RDM:</strong> #{{mudanca_numero}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{cliente}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Tipo / Risco:</strong> {{tipo}} | Risco: {{prioridade}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Prazo Limite para Voto:</strong> {{prazo_sla}}</p>' +
      '<p style="margin: 0;"><strong>Data de Submissão:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Por favor, acesse a plataforma para analisar o plano de execução, rollback e registrar seu voto.</p>',
    footer_text: 'Lógos AITSM • Comitê de Gestão de Mudanças',
    button_label: 'Votar na Mudança',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#D97706',
    template_layout: 'modern',
  },
  change_voting_deadline: {
    subject_template: '[Comitê {{comite_tipo}}] Prazo Expirado - Mudança #{{mudanca_numero}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Comitê de Mudanças - Notificação de Prazo',
    body_template:
      '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
      '<p>O prazo de votação da Mudança <strong>#{{mudanca_numero}} - {{titulo}}</strong> expirou em {{data_hora}}.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #4B5563; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Comitê:</strong> {{comite_tipo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Resultado:</strong> {{status}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Resumo de Votos:</strong> {{descricao}}</p>' +
      '<p style="margin: 0;"><strong>Data de Registro:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>A decisão final foi consolidada e registrada no histórico de auditoria do sistema.</p>',
    footer_text: 'Lógos AITSM • Comitê de Gestão de Mudanças',
    button_label: 'Consultar RDM',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#1E293B',
    template_layout: 'corporate',
  },
  project_deadline: {
    subject_template: '[Projetos] Alerta de Prazo: {{titulo}} - {{status}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Gestão de Projetos & Prazos',
    body_template:
      '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
      '<p>Este é um aviso automático referente ao prazo de entrega do projeto ou atividade.</p>' +
      '<div style="background-color: #faf5ff; border-left: 4px solid #7C3AED; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Projeto / Atividade:</strong> {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Situação:</strong> {{status}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Data Prevista:</strong> {{prazo_sla}}</p>' +
      '<p style="margin: 0;"><strong>Notificado em:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Acesse o painel do projeto para conferir as tarefas pendentes e manter as entregas no prazo.</p>',
    footer_text: 'Lógos AITSM • Gestão Estratégica de Projetos',
    button_label: 'Acessar Projeto',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#7C3AED',
    template_layout: 'modern',
  },
  portal_approval_request: {
    subject_template: 'Solicitação de Aprovação: Chamado #{{chamado_numero}} - {{titulo}}',
    header_title: 'Lógos AITSM',
    header_subtitle: 'Portal de Serviços - Aprovação Pendente',
    body_template:
      '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
      '<p>O chamado <strong>#{{chamado_numero}}</strong> requer sua aprovação para prosseguir com o atendimento.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{cliente}} ({{empresa}})</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Justificativa / Tipo:</strong> {{descricao}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Prazo de Aprovação:</strong> {{prazo_sla}}</p>' +
      '<p style="margin: 0;"><strong>Data da Solicitação:</strong> {{data_hora}}</p>' +
      '</div>' +
      '<p>Você pode analisar e aprovar ou reprovar diretamente clicando no botão abaixo.</p>',
    footer_text: 'Lógos AITSM • Portal do Cliente',
    button_label: 'Aprovar ou Recusar',
    button_url_template: '{{link}}',
    show_button: true,
    primary_color: '#D97706',
    template_layout: 'minimal',
  },
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
