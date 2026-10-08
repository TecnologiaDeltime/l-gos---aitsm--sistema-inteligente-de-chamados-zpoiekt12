import pb from '@/lib/pocketbase/client'

export interface TechnicianGoalRecord {
  id: string
  technician: string
  period_type: 'geral' | 'mensal'
  period_month?: string // YYYY-MM ou vazio quando geral
  response_sla_target: number
  solution_sla_target: number
  resolution_effectiveness_target: number
  notes?: string
  created: string
  updated: string
  expand?: {
    technician?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
  }
}

export const getTechnicianGoals = (filter = '', sort = '-created') =>
  pb.collection('technician_goals').getFullList<TechnicianGoalRecord>({
    filter,
    sort,
    expand: 'technician',
  })

export const getTechnicianGoalsForTech = async (techId: string, monthKey?: string) => {
  // Busca todas as metas do técnico
  const records = await pb.collection('technician_goals').getFullList<TechnicianGoalRecord>({
    filter: `technician = "${techId}"`,
    sort: '-created',
  })

  if (records.length === 0) return null

  // 1. Tenta achar meta para o mês específico se fornecido
  if (monthKey) {
    const specificMonth = records.find(
      (r) => r.period_type === 'mensal' && r.period_month === monthKey,
    )
    if (specificMonth) return specificMonth
  }

  // 2. Se não houver, tenta a vigência geral
  const general = records.find((r) => r.period_type === 'geral')
  if (general) return general

  // 3. Fallback: o primeiro registro mais recente
  return records[0] || null
}

export const createTechnicianGoal = (data: Partial<TechnicianGoalRecord>) =>
  pb.collection('technician_goals').create<TechnicianGoalRecord>(data)

export const updateTechnicianGoal = (id: string, data: Partial<TechnicianGoalRecord>) =>
  pb.collection('technician_goals').update<TechnicianGoalRecord>(id, data)

export const deleteTechnicianGoal = (id: string) => pb.collection('technician_goals').delete(id)
