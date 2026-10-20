/**
 * Utilitários para formatação de data/hora no padrão brasileiro (dd/mm/aaaa hh:mm)
 * e exibição de idade relativa do chamado (ex.: "há 2 horas", "há 3 dias").
 */

/**
 * Formata uma data ISO para dd/mm/aaaa hh:mm no fuso horário local (Brasil).
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '-'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch (_) {
    return '-'
  }
}

/**
 * Formata apenas a data no padrão dd/mm/aaaa.
 */
export function formatDateOnly(isoString?: string | null): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '-'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch (_) {
    return '-'
  }
}

/**
 * Retorna a idade relativa em português (ex.: "agora mesmo", "há 5 min", "há 2 horas", "há 3 dias").
 */
export function formatTicketAge(isoString?: string | null, referenceTime = Date.now()): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const diffMs = referenceTime - d.getTime()
    if (diffMs < 0) return 'agora'

    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return 'agora'
    if (diffMinutes === 1) return 'há 1 min'
    if (diffMinutes < 60) return `há ${diffMinutes} min`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return 'há 1 hora'
    if (diffHours < 24) return `há ${diffHours} horas`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'há 1 dia'
    if (diffDays < 30) return `há ${diffDays} dias`

    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths === 1) return 'há 1 mês'
    if (diffMonths < 12) return `há ${diffMonths} meses`

    const diffYears = Math.floor(diffDays / 365)
    return diffYears === 1 ? 'há 1 ano' : `há ${diffYears} anos`
  } catch (_) {
    return ''
  }
}
