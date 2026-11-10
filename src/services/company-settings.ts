import pb from '@/lib/pocketbase/client'

export interface CompanyBusinessHour {
  enabled: boolean
  start: string // "09:00"
  end: string // "18:00"
}

export interface CompanySettingsRecord {
  id: string
  legal_name: string
  trade_name: string
  cnpj: string
  email: string
  phone: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
  address_zipcode: string
  business_hours: Record<string, CompanyBusinessHour> | null
  holidays: { date: string; name: string }[] | null
  timezone: string
  created: string
  updated: string
}

const COLLECTION = 'company_settings'
export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

function defaultWeek(): Record<string, CompanyBusinessHour> {
  const week: Record<string, CompanyBusinessHour> = {}
  for (let d = 0; d < 7; d++) {
    week[String(d)] = {
      // Seg-Sex padrão 09:00-18:00; fim de semana fechado
      enabled: d >= 1 && d <= 5,
      start: '09:00',
      end: '18:00',
    }
  }
  return week
}

function extract<T>(err: unknown): never {
  const anyErr = err as { response?: { message?: string }; message?: string }
  throw new Error(anyErr?.response?.message || anyErr?.message || 'Erro inesperado')
}

export async function getCompanySettings(): Promise<CompanySettingsRecord | null> {
  try {
    const rec = await pb.collection(COLLECTION).getList(1, 1)
    if (rec.items.length === 0) return null
    const item = rec.items[0] as unknown as CompanySettingsRecord
    return {
      ...item,
      business_hours:
        (item.business_hours as unknown as Record<string, CompanyBusinessHour>) || null,
      holidays: (item.holidays as unknown as { date: string; name: string }[]) || null,
    }
  } catch (err) {
    return extract(err)
  }
}

export interface CompanySettingsInput {
  legal_name: string
  trade_name: string
  cnpj: string
  email: string
  phone: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
  address_zipcode: string
  business_hours: Record<string, CompanyBusinessHour>
  holidays: { date: string; name: string }[]
  timezone: string
}

export async function saveCompanySettings(input: CompanySettingsInput) {
  const existing = await getCompanySettings()
  try {
    if (existing) {
      return await pb.collection(COLLECTION).update(existing.id, input)
    }
    return await pb.collection(COLLECTION).create(input)
  } catch (err) {
    return extract(err)
  }
}

export { defaultWeek }
