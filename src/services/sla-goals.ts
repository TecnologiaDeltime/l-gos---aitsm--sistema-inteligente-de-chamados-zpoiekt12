import pb from '@/lib/pocketbase/client'

export interface SlaGoalRecord {
  id: string
  technician: string
  sla_type: 'Resposta' | 'Solução'
  target_percentage: number
  created: string
  updated: string
}

export const getSlaGoals = () => pb.collection('sla_goals').getFullList<SlaGoalRecord>()

export const createSlaGoal = (data: {
  technician: string
  sla_type: string
  target_percentage: number
}) => pb.collection('sla_goals').create<SlaGoalRecord>(data)

export const updateSlaGoal = (id: string, data: Partial<{ target_percentage: number }>) =>
  pb.collection('sla_goals').update<SlaGoalRecord>(id, data)

export const deleteSlaGoal = (id: string) => pb.collection('sla_goals').delete(id)

export async function saveSlaGoals(
  techId: string,
  responsePct: number | undefined,
  solutionPct: number | undefined,
  existingGoals: SlaGoalRecord[],
) {
  const respGoal = existingGoals.find((g) => g.technician === techId && g.sla_type === 'Resposta')
  const solGoal = existingGoals.find((g) => g.technician === techId && g.sla_type === 'Solução')

  if (responsePct !== undefined && !isNaN(responsePct)) {
    if (respGoal) {
      await updateSlaGoal(respGoal.id, { target_percentage: responsePct })
    } else {
      await createSlaGoal({
        technician: techId,
        sla_type: 'Resposta',
        target_percentage: responsePct,
      })
    }
  } else if (respGoal) {
    await deleteSlaGoal(respGoal.id)
  }

  if (solutionPct !== undefined && !isNaN(solutionPct)) {
    if (solGoal) {
      await updateSlaGoal(solGoal.id, { target_percentage: solutionPct })
    } else {
      await createSlaGoal({
        technician: techId,
        sla_type: 'Solução',
        target_percentage: solutionPct,
      })
    }
  } else if (solGoal) {
    await deleteSlaGoal(solGoal.id)
  }
}

export async function deleteSlaGoals(techId: string, existingGoals: SlaGoalRecord[]) {
  const techGoals = existingGoals.filter((g) => g.technician === techId)
  for (const g of techGoals) {
    await deleteSlaGoal(g.id)
  }
}
