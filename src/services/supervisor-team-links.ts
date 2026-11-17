import pb from '@/lib/pocketbase/client'

export interface SupervisorTeamLink {
  id: string
  supervisor: string
  team: string
  active?: boolean
  created?: string
  updated?: string
  expand?: any
}

const COLL = 'supervisor_team_links'

export const getSupervisorTeamLinks = (filter?: string) =>
  pb
    .collection(COLL)
    .getFullList<SupervisorTeamLink>({ filter, sort: '-created', expand: 'supervisor,team' })

export const getSupervisorTeamLinksByTeam = (teamId: string) =>
  pb.collection(COLL).getFullList<SupervisorTeamLink>({
    filter: `team = "${teamId}"`,
    expand: 'supervisor,team',
  })

export const getSupervisorTeamLinksBySupervisor = (supervisorId: string) =>
  pb.collection(COLL).getFullList<SupervisorTeamLink>({
    filter: `supervisor = "${supervisorId}"`,
    expand: 'team',
  })

export const createSupervisorTeamLink = (data: Partial<SupervisorTeamLink>) =>
  pb.collection(COLL).create<SupervisorTeamLink>(data)

export const updateSupervisorTeamLink = (id: string, data: Partial<SupervisorTeamLink>) =>
  pb.collection(COLL).update<SupervisorTeamLink>(id, data)

export const deleteSupervisorTeamLink = (id: string) => pb.collection(COLL).delete(id)
