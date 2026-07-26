export type Priority = 'Crítica' | 'Alta' | 'Média' | 'Baixa'
export type Impact = 'Alto' | 'Médio' | 'Baixo'
export type Urgency = 'Alta' | 'Média' | 'Baixa'

const MATRIX: Record<string, Priority> = {
  'Alto|Alta': 'Crítica',
  'Alto|Média': 'Alta',
  'Alto|Baixa': 'Média',
  'Médio|Alta': 'Alta',
  'Médio|Média': 'Média',
  'Médio|Baixa': 'Baixa',
  'Baixo|Alta': 'Média',
  'Baixo|Média': 'Baixa',
  'Baixo|Baixa': 'Baixa',
}

export function computePriority(impact: string, urgency: string): Priority {
  return MATRIX[`${impact}|${urgency}`] || 'Média'
}

export const PRIORITY_VALUES: Priority[] = ['Crítica', 'Alta', 'Média', 'Baixa']
export const IMPACT_VALUES: Impact[] = ['Alto', 'Médio', 'Baixo']
export const URGENCY_VALUES: Urgency[] = ['Alta', 'Média', 'Baixa']
