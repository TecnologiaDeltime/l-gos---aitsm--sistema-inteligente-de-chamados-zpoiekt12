export const KANBAN_COLUMNS = [
  'Novo',
  'Em Triagem',
  'Aguardando Atribuição',
  'Atribuído',
  'Em Atendimento',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Agendado',
  'Escalonado',
  'Resolvido',
  'Aguardando Validação',
  'Encerrado',
  'Cancelado',
  'Reaberto',
] as const

export const SLA_DOT_COLORS: Record<string, string> = {
  'Dentro do Prazo': 'bg-emerald-500',
  Atenção: 'bg-amber-500',
  Risco: 'bg-orange-500',
  Crítico: 'bg-red-500',
  Violado: 'bg-red-600',
  Pausado: 'bg-amber-400',
}
