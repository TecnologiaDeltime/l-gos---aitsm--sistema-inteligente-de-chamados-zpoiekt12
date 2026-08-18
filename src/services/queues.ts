import pb from '@/lib/pocketbase/client'

export type QueueLevel =
  | 'Nível 1'
  | 'Nível 2'
  | 'Nível 3'
  | 'Consultoria'
  | 'Backoffice'
  | 'Administrativo'

export const QUEUE_LEVELS: QueueLevel[] = [
  'Nível 1',
  'Nível 2',
  'Nível 3',
  'Consultoria',
  'Backoffice',
  'Administrativo',
]

export interface QueueRecord {
  id: string
  name: string
  description?: string
  members?: string[]
  categories?: string[]
  distribution_rule?: string
  active?: boolean
  priority?: number
  level?: QueueLevel | null
  company?: string | null
  expand?: any
}

export const getQueues = () =>
  pb
    .collection('queues')
    .getFullList<QueueRecord>({ sort: 'name', expand: 'members,categories,company' })

export const createQueue = (data: Partial<QueueRecord>) =>
  pb.collection('queues').create<QueueRecord>(data)

export const updateQueue = (id: string, data: Partial<QueueRecord>) =>
  pb.collection('queues').update<QueueRecord>(id, data)
