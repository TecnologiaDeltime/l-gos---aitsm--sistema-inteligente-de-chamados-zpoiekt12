export const PROBLEM_STATUSES = [
  'Novo',
  'Em Investigação',
  'Causa Identificada',
  'Solução de Contorno Planejada',
  'Solução de Contorno Implantada',
  'Em Análise de Efetividade',
  'Análise de Efetividade Pendente',
  'Avaliação Realizada',
  'Encerrado',
  'Reaberto',
  'Plano de Solução Definitiva',
] as const

export const PROBLEM_PRIORITIES = ['Baixa', 'Média', 'Alta', 'Crítica'] as const
export const PROBLEM_IMPACTS = ['Baixo', 'Médio', 'Alto', 'Crítico'] as const
export const PROBLEM_URGENCIES = ['Baixa', 'Média', 'Alta', 'Crítica'] as const

export const PROBLEM_ORIGINS = [
  'Incidente recorrente',
  'Incidente grave',
  'Incidente Major',
  'Análise preventiva',
  'Monitoramento',
  'Auditoria',
  'Segurança',
  'Fornecedor',
  'Capacidade',
  'Disponibilidade',
  'Tendência identificada',
  'Identificação manual',
  'Outra',
] as const

export const PROBLEM_FREQUENCIES = [
  'Única ocorrência',
  'Eventual',
  'Recorrente',
  'Frequente',
  'Contínua',
] as const

export const EFFECTIVENESS_RESULTS = ['Efetiva', 'Parcialmente efetiva', 'Não efetiva'] as const
export const ROOT_CAUSE_CONFIDENCE = ['Baixo', 'Médio', 'Alto'] as const
export const HYPOTHESIS_PROBABILITY = ['Baixa', 'Média', 'Alta'] as const
export const KNOWN_ERROR_STATUSES = ['Ativo', 'Resolvido', 'Arquivado'] as const

export const ISHIKAWA_CATEGORIES = [
  'Pessoas',
  'Processos',
  'Tecnologia',
  'Ambiente',
  'Equipamentos',
  'Fornecedores',
  'Outros',
] as const

export const REOPEN_REASONS = [
  'Recorrência do incidente',
  'Solução não efetiva',
  'Nova evidência',
  'Causa não eliminada',
  'Novo impacto',
] as const

export const STATUS_COLORS: Record<string, string> = {
  Novo: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'Em Investigação': 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'Causa Identificada': 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  'Solução de Contorno Planejada': 'bg-amber-100 text-amber-700',
  'Solução de Contorno Implantada': 'bg-orange-100 text-orange-700',
  'Em Análise de Efetividade': 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  'Análise de Efetividade Pendente': 'bg-yellow-100 text-yellow-700',
  'Avaliação Realizada': 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Encerrado: 'bg-emerald-100 text-emerald-700',
  Reaberto: 'bg-rose-100 text-rose-700',
  'Plano de Solução Definitiva':
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

export const PRIORITY_COLORS: Record<string, string> = {
  Crítica: 'bg-red-100 text-red-700',
  Alta: 'bg-orange-100 text-orange-700',
  Média: 'bg-amber-100 text-amber-700',
  Baixa: 'bg-green-100 text-green-700',
}

export const PRIORITY_MATRIX: Record<string, string> = {
  'Crítico|Alta': 'Crítica',
  'Crítico|Média': 'Alta',
  'Crítico|Baixa': 'Média',
  'Alto|Alta': 'Alta',
  'Alto|Média': 'Média',
  'Alto|Baixa': 'Baixa',
  'Médio|Alta': 'Média',
  'Médio|Média': 'Média',
  'Médio|Baixa': 'Baixa',
  'Baixo|Alta': 'Média',
  'Baixo|Média': 'Baixa',
  'Baixo|Baixa': 'Baixa',
}

export function computeProblemPriority(impact: string, urgency: string): string {
  return PRIORITY_MATRIX[`${impact}|${urgency}`] || 'Média'
}

export const PROBLEM_TIMELINE_STAGES = [
  'Abertura',
  'Investigação',
  'Causa identificada',
  'Solução de contorno',
  'Implantação',
  'Análise de efetividade',
  'Avaliação',
  'Solução definitiva',
  'Encerramento',
]
