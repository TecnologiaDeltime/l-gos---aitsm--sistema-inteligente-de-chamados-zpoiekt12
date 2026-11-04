/**
 * SISTEMA CENTRAL DE PERMISSÕES & REGISTRO AUTOMÁTICO DE FUNCIONALIDADES
 *
 * Como funciona a regra permanente:
 * 1. Qualquer tela, rota ou item de menu adicionado ao sistema é automaticamente
 *    registrado no catálogo de permissões (Perfis de Acesso).
 * 2. Ao adicionar um item nos menus do `Layout.tsx`, a função `autoRegisterMenuItems()`
 *    detecta itens novos e os insere na matriz de permissões com concedido por padrão.
 * 3. Alternativamente, qualquer componente ou módulo pode chamar `registerFeature({ ... })`
 *    para registrar uma funcionalidade, aba ou sub-recurso específico.
 * 4. Na aba "Perfis de Acesso", qualquer funcionalidade pode ter seu acesso concedido
 *    ou retirado individualmente.
 * 5. Se retirado, o item de menu é ocultado e a rota direta é bloqueada via `ProtectedRoute`.
 */

import { ModuleKey, GranularModuleDefinition, GranularPermissionItem } from '@/types/profiles'

export interface FeatureDefinition {
  moduleKey: ModuleKey | string
  itemKey: string
  label: string
  description?: string
  path?: string
  category?: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração'
  defaultGranted?: boolean
}

// Catálogo base de módulos do sistema
const BASE_SYSTEM_MODULES: GranularModuleDefinition[] = [
  // Atendimento
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Painéis operacionais, gerenciais e de acompanhamento de chamados',
    category: 'Atendimento',
    items: [
      {
        key: 'meu_painel',
        label: 'Painel do Operador',
        description: 'Painel individual do operador com chamados, horas e indicadores',
        path: '/operator-dashboard',
      },
      {
        key: 'dashboard_gerencial',
        label: 'Dashboard Gerencial',
        description: 'Painel executivo com KPIs estratégicos',
        path: '/dashboard-gerencial',
      },
      {
        key: 'painel_tickets',
        label: 'Painel de Tickets',
        description: 'Visão consolidada da fila de atendimento',
        path: '/dashboard',
      },
    ],
  },
  {
    key: 'tickets',
    label: 'Chamados / Tickets',
    description: 'Gestão completa do ciclo de vida de tickets e atendimentos',
    category: 'Atendimento',
    items: [
      {
        key: 'tickets_fila',
        label: 'Fila de Tickets',
        description: 'Listagem e visualização de chamados abertos e em andamento',
        path: '/tickets',
      },
      {
        key: 'tickets_novo',
        label: 'Abrir Chamado',
        description: 'Formulário de abertura de novos chamados',
        path: '/chamados/novo',
      },
      {
        key: 'tickets_portal_meu_chamado',
        label: 'Atalho Meu chamado (Portal)',
        description:
          'Atalho no formulário de abertura de chamados do Portal do Cliente que preenche automaticamente setor, contato e equipamento com os dados do usuário logado',
      },
      {
        key: 'tickets_scheduled',
        label: 'Tickets Programados',
        description: 'Chamados recorrentes agendados automaticamente',
        path: '/tickets/scheduled',
      },
      {
        key: 'tickets_retained',
        label: 'Chamados Retidos',
        description: 'Triagem de e-mails em quarentena ou pendentes de liberação',
        path: '/tickets/retained',
      },
      {
        key: 'tickets_catalogo',
        label: 'Catálogo de Atividades',
        description: 'Catálogo de serviços e atividades padronizadas com SLAs',
        path: '/catalogo',
      },
      {
        key: 'tickets_aprovacoes',
        label: 'Aprovações de Chamados',
        description: 'Fila de pendências e deliberações de aprovação',
        path: '/tickets/approvals',
      },
      {
        key: 'tickets_approval_flow',
        label: 'Fluxo de Aprovação de Chamados',
        description:
          'Configuração de regras de aprovação por tipo de chamado, prioridade alta e aprovadores duplos (cliente e interno)',
        path: '/tickets/approvals',
      },
      {
        key: 'tickets_ai_reply',
        label: 'Resposta com IA em Chamados',
        description:
          'Uso do Agente Nativo de IA para gerar rascunhos de resposta e interações em chamados',
        path: '/tickets',
      },
      {
        key: 'tickets_ai_tags',
        label: 'Sugestão de Tags por IA em Chamados',
        description:
          'Uso da IA para sugerir tags e palavras-chave relevantes na visualização interna do chamado',
        path: '/tickets',
      },
    ],
  },
  {
    key: 'atendimento',
    label: 'Atendimento Omnichannel',
    description: 'Interface de chat, handoff e triagem com IA para canais digitais',
    category: 'Atendimento',
    items: [
      {
        key: 'atendimento_omnichannel',
        label: 'Console de Atendimento (/atendimento)',
        description: 'Atendimento simultâneo de conversas WhatsApp, Webchat e E-mail',
        path: '/atendimento',
      },
    ],
  },
  {
    key: 'notifications',
    label: 'Notificações',
    description: 'Alertas em tempo real de chamados, prazos e menções',
    category: 'Atendimento',
    items: [
      {
        key: 'notifications_central',
        label: 'Central de Notificações',
        description: 'Visualização e gestão do histórico de notificações',
        path: '/notifications',
      },
    ],
  },

  // Operações & Gestão
  {
    key: 'clients',
    label: 'Clientes & Contratos',
    description: 'Empresas clientes, contratos de suporte, horas e franquias',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'clients_cadastro',
        label: 'Cadastro de Clientes',
        description: 'Lista, criação e edição de empresas e filiais',
        path: '/clients',
      },
      {
        key: 'clients_import',
        label: 'Importação de Colaboradores',
        description: 'Importação em massa de colaboradores e contatos via planilha',
        path: '/clients',
      },
      {
        key: 'clients_contrato',
        label: 'Gestão de Contratos',
        description: 'Contratos vigentes, franquias de horas e regras',
        path: '/contracts',
      },
      {
        key: 'clients_horas',
        label: 'Horas Clientes',
        description: 'Histórico e conciliação de horas consumidas',
        path: '/horas-clientes',
      },
      {
        key: 'clients_consumo',
        label: 'Consumo de Contratos',
        description: 'Painel de consumo percentual e alertas de franquia',
        path: '/contracts/consumption',
      },
      {
        key: 'clients_dashboard',
        label: 'Dashboard de Contratos',
        description: 'Visão agregada de faturamento e horas contratadas',
        path: '/contracts/dashboard',
      },
    ],
  },
  {
    key: 'cmdb',
    label: 'CMDB (Ativos & Configuração)',
    description: 'Equipamentos, topologia de rede e itens de configuração',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'cmdb_assets',
        label: 'Ativos de TI',
        description: 'Inventário de hardware, estações e servidores',
        path: '/cmdb/assets',
      },
      {
        key: 'cmdb_items',
        label: 'Itens de Configuração',
        description: 'Relações lógicas, serviços e itens de infraestrutura',
        path: '/cmdb/configuration-items',
      },
      {
        key: 'cmdb_maintenance_history',
        label: 'Histórico de Manutenção de Ativos',
        description:
          'Consulta aos atendimentos técnicos e chamados vinculados aos ativos e itens de configuração',
        path: '/portal?tab=assets',
      },
      {
        key: 'cmdb_import',
        label: 'Importação de Ativos',
        description: 'Carga em lote de ativos via planilhas e inventário',
        path: '/cmdb/import',
      },
      {
        key: 'cmdb_types',
        label: 'Tipos de Ativo',
        description: 'Configuração de tipos e atributos customizados',
        path: '/cmdb/types',
      },
    ],
  },
  {
    key: 'vault',
    label: 'Cofre de Senhas',
    description: 'Armazenamento criptografado de credenciais de clientes e equipamentos',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'vault_cofre',
        label: 'Acesso ao Cofre',
        description: 'Consulta, cópia e gestão de credenciais seguras',
        path: '/vault',
      },
    ],
  },
  {
    key: 'changes',
    label: 'Gestão de Mudanças (RDM)',
    description: 'Requisições de mudança, comitê CAB e planejamento de risco',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'changes_dashboard',
        label: 'Dashboard de Mudanças',
        description: 'Visão geral de RDMs planejadas, em execução e concluídas',
        path: '/changes',
      },
      {
        key: 'changes_list',
        label: 'Lista de Mudanças',
        description: 'Listagem e detalhamento de todas as RDMs',
        path: '/changes/list',
      },
      {
        key: 'changes_my',
        label: 'Minhas Mudanças',
        description: 'Mudanças atribuídas ou solicitadas pelo usuário',
        path: '/changes/my',
      },
      {
        key: 'changes_pending',
        label: 'Mudanças Pendentes de Aprovação',
        description: 'Fila de avaliação para membros do comitê',
        path: '/changes/pending',
      },
      {
        key: 'changes_calendar',
        label: 'Calendário de Mudanças',
        description: 'Janelas de manutenção e conflitos de cronograma',
        path: '/changes/calendar',
      },
      {
        key: 'changes_committee',
        label: 'Comitê de Mudanças (CAB)',
        description: 'Configuração dos comitês e regras de votação',
        path: '/changes/committee',
      },
      {
        key: 'changes_types',
        label: 'Tipos de Mudança',
        description: 'Classificação de risco e regras de aprovação',
        path: '/changes/types',
      },
      {
        key: 'changes_templates',
        label: 'Modelos de Mudança Padrão',
        description: 'Procedimentos e checklists pré-aprovados',
        path: '/changes/templates',
      },
      {
        key: 'changes_reports',
        label: 'Relatórios de Mudança',
        description: 'Taxa de sucesso e histórico de rollbacks',
        path: '/changes/reports',
      },
      {
        key: 'changes_settings',
        label: 'Configurações de Mudança',
        description: 'Prazos de votação e regras de escalonamento',
        path: '/changes/settings',
      },
    ],
  },
  {
    key: 'problems',
    label: 'Gestão de Problemas',
    description: 'Investigação de causas-raiz, erros conhecidos e planos definitivos',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'problems_dashboard',
        label: 'Dashboard de Problemas',
        description: 'Visão executiva de problemas abertos e reincidentes',
        path: '/problems',
      },
      {
        key: 'problems_list',
        label: 'Lista de Problemas',
        description: 'Listagem completa de registros de problemas',
        path: '/problems/list',
      },
      {
        key: 'problems_new',
        label: 'Novo Problema',
        description: 'Abertura e registro de novo problema',
        path: '/problems/new',
      },
      {
        key: 'problems_my',
        label: 'Meus Problemas',
        description: 'Problemas sob responsabilidade do usuário',
        path: '/problems/my',
      },
      {
        key: 'problems_investigation',
        label: 'Problemas em Investigação',
        description: 'Casos com hipóteses e análises ativas',
        path: '/problems/investigation',
      },
      {
        key: 'problems_effectiveness',
        label: 'Análise de Efetividade',
        description: 'Avaliação pós-implantação de soluções',
        path: '/problems/effectiveness',
      },
      {
        key: 'problems_pending',
        label: 'Problemas Pendentes',
        description: 'Aguardando validação ou decisão técnica',
        path: '/problems/pending',
      },
      {
        key: 'problems_closed',
        label: 'Problemas Encerrados',
        description: 'Histórico de problemas finalizados',
        path: '/problems/closed',
      },
      {
        key: 'problems_known_errors',
        label: 'Base de Erros Conhecidos (KEDB)',
        description: 'Soluções de contorno catalogadas para a operação',
        path: '/problems/known-errors',
      },
      {
        key: 'problems_reports',
        label: 'Relatórios de Problemas',
        description: 'Indicadores de causa-raiz e tempo de resolução',
        path: '/problems/reports',
      },
      {
        key: 'problems_settings',
        label: 'Configurações de Problemas',
        description: 'Prazos de efetividade e parâmetros',
        path: '/problems/settings',
      },
    ],
  },
  {
    key: 'visits',
    label: 'Agendas & Visitas Técnicas',
    description: 'Roteirização, agendamento de técnicos em campo e ordens de serviço',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'visits_satisfaction',
        label: 'Pesquisa de Satisfação',
        description: 'Resultados de NPS e avaliação de visitas',
        path: '/satisfaction',
      },
      {
        key: 'visits_n2_dashboard',
        label: 'Gestão de Visitas N2 - Dashboard',
        description: 'Controle gerencial de atendimentos N2 presenciais',
        path: '/visitas-n2/dashboard',
      },
      {
        key: 'visits_n2_calendar',
        label: 'Gestão de Visitas N2 - Calendário',
        description: 'Grade visual de visitas técnicas agendadas',
        path: '/visitas-n2/calendar',
      },
      {
        key: 'visits_n2_list',
        label: 'Gestão de Visitas N2 - Lista',
        description: 'Tabela completa de visitas N2',
        path: '/visitas-n2/list',
      },
      {
        key: 'visits_n2_new',
        label: 'Gestão de Visitas N2 - Nova Visita',
        description: 'Agendamento de ordem de serviço presencial',
        path: '/visitas-n2/new',
      },
      {
        key: 'visits_n2_my',
        label: 'Gestão de Visitas N2 - Minhas Visitas',
        description: 'Visitas atribuídas ao técnico logado',
        path: '/visitas-n2/my',
      },
      {
        key: 'visits_n2_expenses',
        label: 'Gestão de Visitas N2 - Despesas',
        description: 'Lançamento de reembolsos, combustível e pedágios',
        path: '/visitas-n2/expenses',
      },
      {
        key: 'visits_n2_service_orders',
        label: 'Gestão de Visitas N2 - Ordens de Serviço',
        description: 'Documentos e PDFs de conclusão de visita',
        path: '/visitas-n2/service-orders',
      },
      {
        key: 'visits_n2_signatures',
        label: 'Gestão de Visitas N2 - Assinaturas',
        description: 'Assinaturas digitais de clientes na entrega',
        path: '/visitas-n2/signatures',
      },
      {
        key: 'visits_n2_checklists',
        label: 'Gestão de Visitas N2 - Checklists',
        description: 'Roteiros de checagem técnica obrigatória',
        path: '/visitas-n2/checklists',
      },
      {
        key: 'visits_n2_recurring',
        label: 'Gestão de Visitas N2 - Visitas Recorrentes',
        description: 'Visitas preventivas com periodicidade automática',
        path: '/visitas-n2/recurring',
      },
      {
        key: 'visits_n2_availability',
        label: 'Gestão de Visitas N2 - Disponibilidade',
        description: 'Escalas de plantão e folgas de técnicos',
        path: '/visitas-n2/availability',
      },
      {
        key: 'visits_n2_km_rates',
        label: 'Gestão de Visitas N2 - Taxas de KM',
        description: 'Valores de quilometragem por veículo e contrato',
        path: '/visitas-n2/km-rates',
      },
      {
        key: 'visits_n2_reports',
        label: 'Gestão de Visitas N2 - Relatórios',
        description: 'Relatórios de visitas, horas e custos de campo',
        path: '/visitas-n2/reports',
      },
    ],
  },
  {
    key: 'knowledge',
    label: 'Base de Conhecimento',
    description: 'Artigos técnicos, procedimentos de suporte, geração e cura com IA',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'knowledge_base',
        label: 'Artigos da Base de Conhecimento',
        description: 'Consulta, criação e edição de artigos técnicos',
        path: '/knowledge-base',
      },
      {
        key: 'knowledge_drafts',
        label: 'Geração de Artigos por IA (Rascunhos)',
        description:
          'Geração e revisão de rascunhos criados por IA a partir de notas de encerramento de técnicos seniores',
        path: '/knowledge-base?tab=drafts',
      },
      {
        key: 'knowledge_curation',
        label: 'Cura e Atualização de Artigos (IA)',
        description:
          'Monitoramento algorítmico e sugestões de IA para artigos desatualizados, incompletos ou ineficazes',
        path: '/knowledge-base?tab=curation',
      },
    ],
  },

  // Relatórios & Qualidade
  {
    key: 'reports',
    label: 'Relatórios',
    description: 'Relatórios gerenciais, extrações, auditorias e SLAs individuais',
    category: 'Relatórios & Qualidade',
    items: [
      {
        key: 'rep_implemented_features',
        label: 'Funcionalidades Implantadas',
        description: 'Inventário executivo de entregas e recursos do sistema',
        path: '/reports/implemented-features',
      },
      {
        key: 'rep_alert_audit',
        label: 'Auditoria de Alertas',
        description: 'Engajamento de operadores com alertas e SLAs',
        path: '/reports/alert-audit',
      },
      {
        key: 'rep_recurrent_activities',
        label: 'Atividades Recorrentes',
        description: 'Volume histórico por subatividade e demanda',
        path: '/recurrent-activities',
      },
      {
        key: 'rep_monthly_client',
        label: 'Relatório Mensal do Cliente',
        description: 'Relatório gerencial consolidado ABNT para clientes',
        path: '/reports/monthly-client',
      },
      {
        key: 'rep_client_extraction',
        label: 'Extração de Clientes',
        description: 'Extração flexível de colunas cadastrais e contratos',
        path: '/reports/clients',
      },
      {
        key: 'rep_operator_hours',
        label: 'Relatório de Horas por Operador',
        description:
          'Horas trabalhadas (play/pause) e acompanhamento (logs) por operador e período',
        path: '/reports/operator-hours',
      },
      {
        key: 'rep_tickets',
        label: 'Relatório de Chamados',
        description:
          'Chamados linha a linha com Ticket, Cliente, Filial, Setor, Datas, Atividade, Status, Horas de Acompanhamento, Ativo, Operador e Solução',
        path: '/reports/tickets',
      },
      {
        key: 'rep_ticket_interactions',
        label: 'Relatório de Interações nos Chamados',
        description:
          'Logs de acompanhamento linha a linha com tempo lançado em cada interação para auditoria e controle',
        path: '/reports/ticket-interactions',
      },
      {
        key: 'rep_worked_hours',
        label: 'Relatório de Interações Horas Trabalhadas',
        description:
          'Tempo de trabalho efetivo apurado via play/pause do cronômetro por chamado linha a linha',
        path: '/reports/worked-hours',
      },
      {
        key: 'rep_assets',
        label: 'Relatório de Ativos',
        description:
          'Inventário completo e detalhado de ativos/CMDB com filtros de Empresa, Filial e Setor e todos os campos cadastrais',
        path: '/reports/assets',
      },
      {
        key: 'rep_asset_automation_logs',
        label: 'Auditoria de Automações de Ativos',
        description:
          'Histórico e auditoria de ações de exclusão de usuários e equipamentos, mudanças automáticas de status e cancelamentos',
        path: '/reports/asset-automations',
      },
    ],
  },

  // Administração
  {
    key: 'admin',
    label: 'Administração de Usuários e Perfis',
    description: 'Gestão de operadores e matriz de permissões de acesso',
    category: 'Administração',
    items: [
      {
        key: 'admin_operators',
        label: 'Operadores',
        description: 'Gestão da equipe de atendimento, horários e fotos',
        path: '/operators',
      },
      {
        key: 'admin_profiles',
        label: 'Perfis de Acesso',
        description: 'Matriz de permissões granulares por perfil',
        path: '/profiles',
      },
    ],
  },
  {
    key: 'settings',
    label: 'Configurações do Sistema',
    description: 'Parâmetros globais, automações, e-mail IMAP, filas e segurança',
    category: 'Administração',
    items: [
      {
        key: 'settings_email',
        label: 'Caixa de E-mail & IMAP',
        description: 'Ingestão automática de tickets e testes SMTP/Graph',
        path: '/settings?tab=email',
      },
      {
        key: 'settings_sla',
        label: 'Configurações de SLA',
        description: 'Tempos de aviso e alertas de resposta/solução',
        path: '/settings/sla',
      },
      {
        key: 'settings_automations',
        label: 'Central de Automações',
        description: 'Workflows visuais e regras automáticas de triagem',
        path: '/automations',
      },
      {
        key: 'settings_queues',
        label: 'Filas de Atendimento',
        description: 'Distribuição e filas por nível e especialidade',
        path: '/queues',
      },
      {
        key: 'settings_blocking',
        label: 'Bloqueio de Clientes',
        description: 'Bloqueios contratuais e suspensão de canais',
        path: '/blocking',
      },
      {
        key: 'settings_notifications',
        label: 'Parâmetros de Notificações',
        description: 'Alertas sonoros, voz e frequência',
        path: '/notifications',
      },
      {
        key: 'settings_design',
        label: 'Design & Cores',
        description: 'Personalização visual, logotipo e temas',
        path: '/settings?tab=design',
      },
      {
        key: 'settings_portal',
        label: 'Portal do Cliente (Gestão e Parâmetros)',
        description: 'Configuração visual e regras de acesso do portal público',
        path: '/settings?tab=portal',
      },
      {
        key: 'settings_client_notif',
        label: 'Notificações de Clientes',
        description: 'E-mails automáticos de abertura e resolução para solicitantes',
        path: '/settings?tab=client_notif',
      },
      {
        key: 'settings_security',
        label: 'Segurança & Sessão',
        description: 'Tempo de expiração de sessão e bloqueio de força bruta',
        path: '/settings?tab=security',
      },
      {
        key: 'settings_ticket_templates',
        label: 'Modelos de Chamados',
        description: 'Configuração de modelos de chamados padronizados',
        path: '/settings/ticket-templates',
      },
      {
        key: 'settings_aitsm_console',
        label: 'Console AITSM (Protótipo)',
        description: 'Console interativo com agente e protótipo de IA',
        path: '/console-aitsm.html',
      },
      {
        key: 'settings_general',
        label: 'Configurações Gerais',
        description: 'Preferências gerais e perfil do usuário logado',
        path: '/settings',
      },
      {
        key: 'settings_ai_reply',
        label: 'Configurações de IA (Chamados)',
        description:
          'Gestão dos modos do Agente Nativo de IA: sugestão de rascunhos, resposta automática ou ambos',
        path: '/settings?tab=ai_reply',
      },
      {
        key: 'settings_consumption_agent',
        label: 'Agente de Consumo de Clientes',
        description:
          'Monitoramento preditivo do consumo médio de horas dos clientes e notificações automáticas para qualidade e gestores',
        path: '/settings?tab=consumption_agent',
      },
    ],
  },
]

// Array mutável compartilhado em tempo de execução
export const GRANULAR_SYSTEM_MODULES: GranularModuleDefinition[] = JSON.parse(
  JSON.stringify(BASE_SYSTEM_MODULES),
)

/**
 * Registra ou atualiza uma funcionalidade no catálogo de permissões dinamicamente.
 * Pode ser chamado em tempo de execução por qualquer página, aba ou subcomponente.
 */
export function registerFeature(feature: FeatureDefinition): void {
  const modKey = feature.moduleKey as ModuleKey
  let mod = GRANULAR_SYSTEM_MODULES.find((m) => m.key === modKey)

  if (!mod) {
    mod = {
      key: modKey,
      label: (feature.category || 'Módulo') + ` - ${modKey}`,
      description: `Módulo do sistema: ${modKey}`,
      category: feature.category || 'Administração',
      items: [],
    }
    GRANULAR_SYSTEM_MODULES.push(mod)
  }

  const existingItemIndex = mod.items.findIndex(
    (i) => i.key === feature.itemKey || (feature.path && i.path === feature.path),
  )

  const itemPayload: GranularPermissionItem = {
    key: feature.itemKey,
    label: feature.label,
    description: feature.description || `Acesso à funcionalidade ${feature.label}`,
    path: feature.path,
    defaultGranted: feature.defaultGranted ?? true,
  }

  if (existingItemIndex >= 0) {
    mod.items[existingItemIndex] = {
      ...mod.items[existingItemIndex],
      ...itemPayload,
    }
  } else {
    mod.items.push(itemPayload)
  }
}

/**
 * Converte um caminho (rota/URL) em uma chave de item padronizada única.
 */
function pathToKey(moduleKey: string, path: string, label: string): string {
  const clean = path
    .replace(/[?&=]/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
  if (clean) return clean
  const cleanLabel = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
  return `${moduleKey}_${cleanLabel}`
}

/**
 * AUTO-REGISTRO DE ITENS DE MENU:
 * Percorre qualquer lista de itens de menu (ex: chamadosSubmenuItems, configuracoesSubmenuItems)
 * e garante que todos os itens estejam registrados no catálogo de permissões com sua rota e chave.
 *
 * Ao adicionar uma nova rota/item no Layout.tsx, essa função a registra automaticamente na matriz!
 */
export function autoRegisterMenuItems(
  moduleKey: ModuleKey | string,
  category: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração',
  items: Array<{
    label: string
    path: string
    description?: string
  }>,
): void {
  if (!items || !Array.isArray(items)) return

  items.forEach((item) => {
    if (!item.path) return

    // Verificar se já existe algum item registrado com este exato path
    let found = false
    for (const m of GRANULAR_SYSTEM_MODULES) {
      if (m.items.some((i) => i.path === item.path)) {
        found = true
        break
      }
    }

    if (!found) {
      const generatedKey = pathToKey(String(moduleKey), item.path, item.label)
      registerFeature({
        moduleKey: moduleKey as ModuleKey,
        itemKey: generatedKey,
        label: item.label,
        description: item.description || `Acesso à tela ${item.label} (${item.path})`,
        path: item.path,
        category,
        defaultGranted: true,
      })
    }
  })
}

/**
 * Retorna todos os módulos e seus itens em tempo real.
 */
export function getGranularSystemModules(): GranularModuleDefinition[] {
  return GRANULAR_SYSTEM_MODULES
}
