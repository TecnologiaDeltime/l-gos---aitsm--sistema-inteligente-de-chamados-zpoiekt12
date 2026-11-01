export type PermissionLevel = 'read' | 'write' | 'hidden'

export interface ModulePermission {
  read: boolean
  write: boolean
  hidden: boolean
}

export type ModuleKey =
  | 'dashboard'
  | 'tickets'
  | 'tickets_children'
  | 'atendimento'
  | 'cmdb'
  | 'changes'
  | 'problems'
  | 'visits'
  | 'reports'
  | 'settings'
  | 'clients'
  | 'operators'
  | 'profiles'
  | 'sla_dashboard'
  | 'notifications'
  | 'time_tracking'
  | 'vault'
  | 'knowledge'
  | 'admin'

export interface GranularPermissionItem {
  key: string
  label: string
  description?: string
  path?: string // Rota associada para guard
  defaultGranted?: boolean
}

export interface GranularModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  category: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração'
  items: GranularPermissionItem[]
}

export const GRANULAR_SYSTEM_MODULES: GranularModuleDefinition[] = [
  // Atendimento
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Painéis operacionais, gerenciais e de acompanhamento de chamados',
    category: 'Atendimento',
    items: [
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
      {
        key: 'meu_painel',
        label: 'Meu Painel (Operador)',
        description: 'Métricas de atendimento individuais do operador',
        path: '/operator-dashboard',
      },
      {
        key: 'painel_gerencial',
        label: 'Painel Gerencial de Desempenho',
        description: 'Acompanhamento de metas e produtividade geral',
        path: '/manager-dashboard',
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
        key: 'tickets_categorias',
        label: 'Categorias de Chamados',
        description: 'Gestão da árvore de categorias e SLAs',
        path: '/categorias',
      },
      {
        key: 'tickets_catalogo',
        label: 'Catálogo de Atividades',
        description: 'Catálogo de serviços e atividades padronizadas',
        path: '/catalogo',
      },
      {
        key: 'tickets_aprovacoes',
        label: 'Aprovações de Chamados',
        description: 'Fila de pendências e deliberações de aprovação',
        path: '/tickets/approvals',
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
        key: 'visits_agenda',
        label: 'Agenda de Operadores',
        description: 'Grade horária de técnicos e alocação de chamados',
        path: '/agenda-tecnica',
      },
      {
        key: 'visits_list',
        label: 'Visitas Técnicas',
        description: 'Histórico e status de atendimentos presenciais',
        path: '/visits',
      },
      {
        key: 'visits_dashboard',
        label: 'Dashboard de Visitas',
        description: 'Métricas gerais de deslocamento e atendimento em campo',
        path: '/visits/dashboard',
      },
      {
        key: 'visits_tech_dashboard',
        label: 'Painel do Operador de Campo',
        description: 'Visão do técnico com check-in, check-out e rotas',
        path: '/visits/technician-dashboard',
      },
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
    description: 'Artigos técnicos, procedimentos de suporte e manuais',
    category: 'Operações & Gestão',
    items: [
      {
        key: 'knowledge_base',
        label: 'Artigos da Base de Conhecimento',
        description: 'Consulta, criação e edição de artigos técnicos',
        path: '/knowledge-base',
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
        key: 'rep_gerenciais',
        label: 'Relatórios Gerenciais (Horas por Cronômetro)',
        description: 'Apuração principal de horas de atendimento e exportação CSV',
        path: '/reports',
      },
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
        key: 'rep_unit',
        label: 'Relatórios por Filial',
        description: 'Métricas de atendimento segmentadas por unidade física',
        path: '/reports/unit',
      },
      {
        key: 'rep_sla_dashboard',
        label: 'Dashboard de SLA',
        description: 'Painel visual de cumprimento de prazos de resposta e solução',
        path: '/sla-dashboard',
      },
      {
        key: 'rep_sla_goals',
        label: 'Metas de SLA',
        description: 'Acompanhamento de metas contratuais e individuais',
        path: '/sla-goals',
      },
      {
        key: 'rep_recurrent_activities',
        label: 'Atividades Recorrentes',
        description: 'Volume histórico por subatividade e demanda',
        path: '/recurrent-activities',
      },
      {
        key: 'rep_scheduled_reports',
        label: 'Relatórios Agendados',
        description: 'Envio automático periódico por e-mail',
        path: '/scheduled-reports',
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
        key: 'settings_general',
        label: 'Configurações Gerais',
        description: 'Preferências gerais e perfil do usuário logado',
        path: '/settings',
      },
      {
        key: 'settings_portal',
        label: 'Portal do Cliente (Parâmetros)',
        description: 'Configuração visual e regras do portal público',
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
    ],
  },
]

// Mapeamento compatível legado
export const SYSTEM_MODULES = GRANULAR_SYSTEM_MODULES.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  category: m.category,
}))

export type PermissionsMap = Record<string, ModulePermission>

export interface ProfileRecord {
  id: string
  name: string
  description?: string
  is_system?: boolean
  permissions: PermissionsMap
  created: string
  updated: string
}

export interface ProfilePermissionRecord {
  id: string
  profile: string
  module_key: string
  item_key: string
  granted: boolean
  created?: string
  updated?: string
}
