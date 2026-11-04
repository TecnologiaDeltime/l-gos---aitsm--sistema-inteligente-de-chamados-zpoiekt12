// Helper functions for duration formatting and parsing
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
 * Formata um valor em HORAS fracionadas (number) no formato HH:MM:SS.
 * Alias semântico para formatHours, usado onde o dado de origem é "horas"
 * (ex.: média histórica do Agente de Consumo, totais do relatório mensal).
 */
export function formatHoursToHHMMSS(hours: number | string | undefined | null): string {
  return formatHours(hours)
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

/**
 * Converte um valor no formato HH:MM:SS (ou compatível) para MINUTOS.
 * Usado onde o banco persiste minutos (ex.: sla_response_minutes das atividades).
 * Retorna null quando vazio ou inválido.
 */
export function parseDurationToMinutes(value: string | number | null | undefined): number | null {
  const seconds = parseDurationToSeconds(value)
  return seconds === null ? null : seconds / 60
}

/**
 * Máscara leve para inputs de duração no formato 00:00:00: aceita apenas
 * dígitos (até 6) e reconstrói com dois pontos fixos.
 */
export function maskHHMMSSInput(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  // Se já contém separadores ':' (ex.: usuário colou ou campo já formatado)
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => p.replace(/\D/g, ''))
    if (parts.length === 3) {
      const h = (parts[0] || '0').slice(0, 2).padStart(2, '0')
      const m = (parts[1] || '0').slice(0, 2).padStart(2, '0')
      const s = (parts[2] || '0').slice(0, 2).padStart(2, '0')
      return `${h}:${m}:${s}`
    }
    if (parts.length === 2) {
      const h = (parts[0] || '0').slice(0, 2).padStart(2, '0')
      const m = (parts[1] || '0').slice(0, 2).padStart(2, '0')
      return `${h}:${m}:00`
    }
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, 6)
  if (!digits) return ''

  // Não auto-expande dígitos intermediários com zeros antecipados — preserva fluxo progressivo
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
}

/**
 * Validador para o formato 00:00:00 (horas:minutos:segundos).
 * Retorna string vazia quando válido, ou a mensagem de erro.
 */
export function validateHHMMSS(value: string, required = false): string {
  const v = (value || '').trim()
  if (!v) return required ? 'Informe o valor no formato 00:00:00.' : ''

  // Aceita formatos progressivos completos ou parciais durante digitação:
  // HH:MM:SS (completo) ou formatos válidos normalizados
  if (/^\d{1,3}:\d{2}:\d{2}$/.test(v)) {
    const [h, m, s] = v.split(':').map(Number)
    if (m > 59 || s > 59) return 'Minutos e segundos inválidos (máximo 59).'
    if (required && h * 3600 + m * 60 + s <= 0) return 'O valor deve ser maior que 00:00:00.'
    return ''
  }

  // Se for valor numérico puro ou formato HH:MM parcial
  if (/^\d{1,3}:\d{1,2}$/.test(v)) {
    const [, m] = v.split(':').map(Number)
    if (m > 59) return 'Minutos inválidos (máximo 59).'
    return ''
  }

  if (/^\d{1,6}$/.test(v)) {
    return ''
  }

  return 'Formato inválido. Use 00:00:00 (horas:minutos:segundos).'
}
