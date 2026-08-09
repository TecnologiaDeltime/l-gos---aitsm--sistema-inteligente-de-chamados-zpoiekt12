export const CHANGE_STATUSES = [
  'Rascunho',
  'Solicitada',
  'Em Avaliação',
  'Aguardando Aprovação',
  'Aprovada',
  'Recusada',
  'Em Planejamento',
  'Agendada',
  'Em Execução',
  'Em Validação',
  'Concluída',
  'Cancelada',
  'Reaberta',
] as const

export const CHANGE_PRIORITIES = ['Crítica', 'Alta', 'Média', 'Baixa'] as const
export const CHANGE_IMPACTS = ['Alto', 'Médio', 'Baixo'] as const
export const CHANGE_URGENCIES = ['Alta', 'Média', 'Baixa'] as const
export const RISK_LEVELS = ['Baixo', 'Médio', 'Alto', 'Crítico'] as const
export const APPROVAL_STATUSES = ['Não Requerida', 'Pendente', 'Aprovada', 'Recusada'] as const

export const STATUS_COLORS: Record<string, string> = {
  Rascunho: 'bg-slate-100 text-slate-700',
  Solicitada: 'bg-blue-100 text-blue-700',
  'Em Avaliação': 'bg-cyan-100 text-cyan-700',
  'Aguardando Aprovação': 'bg-amber-100 text-amber-700',
  Aprovada: 'bg-green-100 text-green-700',
  Recusada: 'bg-red-100 text-red-700',
  'Em Planejamento': 'bg-indigo-100 text-indigo-700',
  Agendada: 'bg-purple-100 text-purple-700',
  'Em Execução': 'bg-orange-100 text-orange-700',
  'Em Validação': 'bg-teal-100 text-teal-700',
  Concluída: 'bg-emerald-100 text-emerald-700',
  Cancelada: 'bg-slate-200 text-slate-600',
  Reaberta: 'bg-yellow-100 text-yellow-700',
}

export const RISK_COLORS: Record<string, string> = {
  Baixo: 'bg-green-100 text-green-700',
  Médio: 'bg-amber-100 text-amber-700',
  Alto: 'bg-orange-100 text-orange-700',
  Crítico: 'bg-red-100 text-red-700',
}

export const PRIORITY_COLORS: Record<string, string> = {
  Crítica: 'bg-red-100 text-red-700',
  Alta: 'bg-orange-100 text-orange-700',
  Média: 'bg-amber-100 text-amber-700',
  Baixa: 'bg-green-100 text-green-700',
}
