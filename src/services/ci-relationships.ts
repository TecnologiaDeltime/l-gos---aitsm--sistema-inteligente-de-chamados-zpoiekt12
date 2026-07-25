import pb from '@/lib/pocketbase/client'

export interface CiRelationshipRecord {
  id: string
  source_ci: string
  target_ci: string
  relationship_type: string
  description?: string
  created: string
  updated: string
  expand?: any
}

export const RELATIONSHIP_TYPES = [
  'Conectado a',
  'Instalado em',
  'Roda em',
  'Depende de',
  'Contém',
  'Pertence a',
  'Backup de',
]

export const getRelationships = (ciId: string) =>
  pb.collection('ci_relationships').getFullList<CiRelationshipRecord>({
    filter: `source_ci = "${ciId}" || target_ci = "${ciId}"`,
    expand: 'source_ci,target_ci',
    sort: '-created',
  })

export const createRelationship = (data: Partial<CiRelationshipRecord>) =>
  pb.collection('ci_relationships').create<CiRelationshipRecord>(data)

export const deleteRelationship = (id: string) => pb.collection('ci_relationships').delete(id)
