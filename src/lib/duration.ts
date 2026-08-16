export function formatMinutes(minutes: number | string | undefined | null): string {
  const totalSeconds = Math.round((Number(minutes) || 0) * 60)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatHours(hours: number | string | undefined | null): string {
  return formatMinutes((Number(hours) || 0) * 60)
}

/**
 * Formata um total de SEGUNDOS no formato HH:MM:SS.
 * Usado para exibição de saldos calculados a partir de segundos.
 */
export function formatSeconds(totalSeconds: number | undefined | null): string {
  const t = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Converte um valor no formato HH:MM:SS (ou HH:MM, ou número de horas) para
 * total de SEGUNDOS. Retorna null quando vazio ou inválido.
 *
 * Aceita também valores numéricos (interpretados como horas) para manter
 * compatibilidade com dados legados.
 */
export function parseDurationToSeconds(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.round(value * 3600)
  }
  const v = String(value).trim()
  if (v === '') return null

  const parts = v.split(':')
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const s = parseInt(parts[2], 10)
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null
    if (h < 0 || m < 0 || m > 59 || s < 0 || s > 59) return null
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    // Formato MM:SS — treat as minutos:segundos
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (Number.isNaN(m) || Number.isNaN(s)) return null
    if (m < 0 || s < 0 || s > 59) return null
    return m * 60 + s
  }
  // Valor numérico puro → interpretado como horas (compatibilidade).
  const n = Number(v)
  if (Number.isFinite(n)) return Math.round(n * 3600)
  return null
}

/**
 * Converte um valor no formato HH:MM:SS (ou compatível) para HORAS fracionadas
 * (number). É o espelho de `formatHours`. Usado para persistir no banco, que
 * armazena horas (fracionadas) como number.
 */
export function parseDurationToHours(value: string | number | null | undefined): number | null {
  const seconds = parseDurationToSeconds(value)
  return seconds === null ? null : seconds / 3600
}
