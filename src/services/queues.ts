import pb from '@/lib/pocketbase/client'

export interface QueueRecord {
  id: string
  name: string
  description?: string
  members?: string[]
  categories?: string[]
  distribution_rule?: string
  active?: boolean
  priority?: number
  expand?: any
}

export const getQueues = () =>
  pb.collection('queues').getFullList<QueueRecord>({ sort: 'name', expand: 'members,categories' })

export const createQueue = (data: Partial<QueueRecord>) =>
  pb.collection('queues').create<QueueRecord>(data)

export const updateQueue = (id: string, data: Partial<QueueRecord>) =>
  pb.collection('queues').update<QueueRecord>(id, data)
