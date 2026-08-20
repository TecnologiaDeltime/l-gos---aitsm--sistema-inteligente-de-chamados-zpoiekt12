import { UserRecord } from '@/hooks/use-auth'
import { ProfileRecord } from '@/types/profiles'

export type OperatorType = 'Interno' | 'Externo'

export interface OperatorItem extends UserRecord {
  first_name?: string
  last_name?: string
  team?: string
  type?: OperatorType
  extension?: string
  mobile?: string
  profile_id?: string
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      trade_name?: string
      legal_name?: string
    }
    profile_id?: ProfileRecord
  }
}

export interface CreateOperatorData {
  first_name: string
  last_name?: string
  email: string
  password?: string
  passwordConfirm?: string
  team?: string
  type?: OperatorType
  extension?: string
  mobile?: string
  phone?: string
  profile_id?: string
  role?: string
  active?: boolean
  position?: string
  company?: string
}

export interface UpdateOperatorData {
  name?: string
  first_name?: string
  last_name?: string
  email?: string
  password?: string
  passwordConfirm?: string
  team?: string
  type?: OperatorType
  extension?: string
  mobile?: string
  phone?: string
  profile_id?: string
  role?: string
  active?: boolean
  position?: string
  company?: string
}
