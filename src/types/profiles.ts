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
  | 'cmdb'
  | 'changes'
  | 'reports'
  | 'settings'
  | 'clients'
  | 'operators'
  | 'profiles'
  | 'sla_dashboard'
  | 'notifications'
  | 'time_tracking'

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  category: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração'
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  // Atendimento
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Visualização e acompanhamento de chamados e KPIs operacionais',
    category: 'Atendimento',
  },
  {
    key: 'tickets',
    label: 'Tickets',
    description: 'Listagem, criação, edição, resolução e exclusão de tickets',
    category: 'Atendimento',
  },
  {
    key: 'tickets_children',
    label: 'Tickets Filhos / Associações',
    description: 'Gestão de sub-chamados, hierarquia e associações de tickets',
    category: 'Atendimento',
  },
  {
    key: 'notifications',
    label: 'Notificações',
    description: 'Alertas em tempo real de chamados, prazos e menções',
    category: 'Atendimento',
  },
  {
    key: 'time_tracking',
    label: 'Horas / Apontamentos',
    description: 'Apontamento, cronômetro e revisão de horas em atendimentos',
    category: 'Atendimento',
  },

  // Operações & Gestão
  {
    key: 'cmdb',
    label: 'CMDB (Ativos & Itens)',
    description: 'Inventário de equipamentos, ativos de rede e itens de configuração',
    category: 'Operações & Gestão',
  },
  {
    key: 'changes',
    label: 'Mudanças (RDM)',
    description: 'Requisições de mudança, comitê CAB e aprovações de risco',
    category: 'Operações & Gestão',
  },
  {
    key: 'clients',
    label: 'Clientes & Contratos',
    description: 'Cadastro de empresas clientes, contratos, filiais e contatos',
    category: 'Operações & Gestão',
  },

  // Relatórios & Qualidade
  {
    key: 'reports',
    label: 'Relatórios',
    description: 'Relatórios gerenciais, consumo de horas, filiais e exportações',
    category: 'Relatórios & Qualidade',
  },
  {
    key: 'sla_dashboard',
    label: 'SLA Dashboard',
    description: 'Painel de cumprimento de prazos, metas de atendimento e alertas',
    category: 'Relatórios & Qualidade',
  },

  // Administração
  {
    key: 'settings',
    label: 'Configurações',
    description: 'Parâmetros de SLA, alertas, templates, filas e regras gerais',
    category: 'Administração',
  },
  {
    key: 'operators',
    label: 'Operadores',
    description: 'Cadastro, gerenciamento e controle de acesso dos operadores',
    category: 'Administração',
  },
  {
    key: 'profiles',
    label: 'Perfis de Acesso',
    description: 'Definição de perfis e matriz de permissões do sistema',
    category: 'Administração',
  },
]

export type PermissionsMap = Record<ModuleKey, ModulePermission>

export interface ProfileRecord {
  id: string
  name: string
  description?: string
  is_system?: boolean
  permissions: PermissionsMap
  created: string
  updated: string
}
