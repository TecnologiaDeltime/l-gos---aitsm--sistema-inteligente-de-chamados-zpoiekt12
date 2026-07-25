import pb from '@/lib/pocketbase/client'

export interface UserItem {
  id: string
  email: string
  name?: string
  role?: string
  phone?: string
  position?: string
  company?: string
  active?: boolean
  created: string
  expand?: any
}

export const getUsers = (filter?: string) =>
  pb.collection('users').getFullList<UserItem>({ filter, sort: 'name', expand: 'company' })

export const getUser = (id: string) =>
  pb.collection('users').getOne<UserItem>(id, { expand: 'company' })

export const createUser = (
  data: Partial<UserItem> & { password?: string; passwordConfirm?: string },
) => pb.collection('users').create<UserItem>(data)

export const updateUser = (id: string, data: Partial<UserItem>) =>
  pb.collection('users').update<UserItem>(id, data)
