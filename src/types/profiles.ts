export type LegacyPermissionLevel = 'read' | 'write' | 'hidden'

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
  defaultLevel?: PermissionLevel
}

export interface GranularModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  category: 'Atendimento' | 'Operações & Gestão' | 'Relatórios & Qualidade' | 'Administração'
  items: GranularPermissionItem[]
}

import { GRANULAR_SYSTEM_MODULES as REGISTRY_MODULES } from '@/lib/permissions-registry'

export const GRANULAR_SYSTEM_MODULES: GranularModuleDefinition[] = REGISTRY_MODULES
export {
  registerFeature,
  autoRegisterMenuItems,
  getGranularSystemModules,
} from '@/lib/permissions-registry'
// Mapeamento compatível legado
export const SYSTEM_MODULES = GRANULAR_SYSTEM_MODULES.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  category: m.category,
}))

export type PermissionsMap = Record<string, ModulePermission>

export interface ProfileLandingOption {
  route: string
  label: string
  description: string
  moduleKey: ModuleKey
  itemKey?: string
}

export const PROFILE_LANDING_OPTIONS: ProfileLandingOption[] = [
  {
    route: '/dashboard',
    label: 'Dashboard (Fila de Tickets)',
    description: 'Visão consolidada da fila de chamados e métricas de atendimento',
    moduleKey: 'dashboard',
    itemKey: 'painel_tickets',
  },
  {
    route: '/operator-dashboard',
    label: 'Painel do Operador',
    description: 'Painel pessoal com chamados do operador, cronômetro e indicadores',
    moduleKey: 'dashboard',
    itemKey: 'meu_painel',
  },
  {
    route: '/tickets',
    label: 'Chamados (Fila de Tickets)',
    description: 'Listagem e visualização de chamados abertos e em andamento',
    moduleKey: 'tickets',
    itemKey: 'tickets_fila',
  },
  {
    route: '/atendimento',
    label: 'Atendimento Omnichannel',
    description: 'Console de atendimento de conversas digitais e chat',
    moduleKey: 'atendimento',
    itemKey: 'atendimento_omnichannel',
  },
  {
    route: '/portal',
    label: 'Portal do Cliente',
    description: 'Visão do portal corporativo para clientes e pontos focais',
    moduleKey: 'settings',
    itemKey: 'settings_portal',
  },
  {
    route: '/dashboard-gerencial',
    label: 'Dashboard Gerencial',
    description: 'Painel executivo com KPIs estratégicos',
    moduleKey: 'dashboard',
    itemKey: 'dashboard_gerencial',
  },
  {
    route: '/chamados/novo',
    label: 'Abrir Chamado',
    description: 'Formulário de abertura de novo chamado',
    moduleKey: 'tickets',
    itemKey: 'tickets_novo',
  },
  {
    route: '/chat',
    label: 'Chat de Operadores',
    description: 'Comunicação interna em tempo real entre operadores',
    moduleKey: 'chat',
    itemKey: 'chat_operadores',
  },
  {
    route: '/clients',
    label: 'Clientes & Contratos',
    description: 'Cadastro de empresas clientes e contratos',
    moduleKey: 'clients',
    itemKey: 'clients_cadastro',
  },
  {
    route: '/cmdb/assets',
    label: 'Ativos de TI (CMDB)',
    description: 'Inventário de hardware, estações e servidores',
    moduleKey: 'cmdb',
    itemKey: 'cmdb_assets',
  },
  {
    route: '/visitas-n2/dashboard',
    label: 'Gestão de Visitas N2',
    description: 'Painel e agenda de visitas técnicas presenciais',
    moduleKey: 'visits',
    itemKey: 'visits_n2_dashboard',
  },
  {
    route: '/knowledge-base',
    label: 'Base de Conhecimento',
    description: 'Consulta e gestão de artigos técnicos',
    moduleKey: 'knowledge',
    itemKey: 'knowledge_base',
  },
  {
    route: '/knowledge-base?tab=drafts',
    label: 'Geração de Artigos por IA',
    description: 'Rascunhos de artigos gerados por IA para revisão',
    moduleKey: 'knowledge',
    itemKey: 'knowledge_drafts',
  },
  {
    route: '/knowledge-base?tab=curation',
    label: 'Cura e Atualização de Dados (IA)',
    description: 'Painel de artigos desatualizados e sugestões de IA',
    moduleKey: 'knowledge',
    itemKey: 'knowledge_curation',
  },
  {
    route: '/reports/implemented-features',
    label: 'Relatórios',
    description: 'Central de relatórios e auditorias',
    moduleKey: 'reports',
    itemKey: 'rep_implemented_features',
  },
]

export interface ProfileRecord {
  id: string
  name: string
  description?: string
  is_system?: boolean
  landing_route?: string
  permissions: PermissionsMap
  created: string
  updated: string
}

export type PermissionLevel = 'view' | 'edit' | 'configure'

export interface ProfilePermissionRecord {
  id: string
  profile: string
  module_key: string
  item_key: string
  granted: boolean
  level?: PermissionLevel | null
  created?: string
  updated?: string
}

export interface GranularPermissionValue {
  granted: boolean
  level: PermissionLevel
}

/**
 * Mapa em memória de permissões granulares:
 * chave do item -> { granted, level }
 */
export type ProfilePermissionMap = Record<string, GranularPermissionValue>
