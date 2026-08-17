import pb from '@/lib/pocketbase/client'

export interface CommitteeMemberType {
  /** memberId -> origin label */
  [memberId: string]: 'user' | 'client_contact'
}

export interface ChangeCommitteeRecord {
  id: string
  name: string
  description?: string
  members?: string[]
  chairperson?: string
  meeting_frequency?: string
  active?: boolean
  committee_type?: 'Emergencial' | 'Padrão'
  company?: string
  max_members?: number
  voting_rule?: 'Presidente Unilateral' | 'Maioria Simples'
  member_type?: CommitteeMemberType
  created: string
  updated: string
  expand?: any
}

const EXPAND = 'members,chairperson,company'

export const getCommittees = () =>
  pb.collection('change_committee').getFullList<ChangeCommitteeRecord>({
    sort: '-created',
    expand: EXPAND,
  })

export const getCommittee = (id: string) =>
  pb.collection('change_committee').getOne<ChangeCommitteeRecord>(id, { expand: EXPAND })

export const getCommitteeByCompanyAndType = (companyId: string, type: 'Emergencial' | 'Padrão') =>
  pb
    .collection('change_committee')
    .getFirstListItem<ChangeCommitteeRecord>(
      `company = "${companyId}" && committee_type = "${type}"`,
      { expand: EXPAND },
    )

export const getCommitteesByCompany = (companyId: string) =>
  pb.collection('change_committee').getFullList<ChangeCommitteeRecord>({
    filter: `company = "${companyId}"`,
    sort: 'committee_type',
    expand: EXPAND,
  })

export const createCommittee = (data: Partial<ChangeCommitteeRecord>) =>
  pb.collection('change_committee').create<ChangeCommitteeRecord>(data)

export const updateCommittee = (id: string, data: Partial<ChangeCommitteeRecord>) =>
  pb.collection('change_committee').update<ChangeCommitteeRecord>(id, data)

export const deleteCommittee = (id: string) => pb.collection('change_committee').delete(id)

export const MAX_MEMBERS_BY_TYPE: Record<'Emergencial' | 'Padrão', number> = {
  Emergencial: 3,
  Padrão: 5,
}

export const VOTING_RULE_BY_TYPE: Record<
  'Emergencial' | 'Padrão',
  'Presidente Unilateral' | 'Maioria Simples'
> = {
  Emergencial: 'Presidente Unilateral',
  Padrão: 'Maioria Simples',
}
