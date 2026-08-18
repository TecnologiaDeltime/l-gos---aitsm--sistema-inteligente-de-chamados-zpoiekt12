/**
 * Utilitários para cálculo do "Tempo sem Atualização" de um chamado.
 *
 * A data de referência é a mais recente entre:
 *   - a última interação registrada (ticket_interactions.created)
 *   - o campo `updated` do ticket
 *   - o campo `created` do ticket (fallback)
 *
 * Espelha a lógica do cron `stale_ticket_alerts` (PocketBase) para manter
 * consistência entre o que o usuário vê na listagem e o que dispara alertas.
 */

/** Status que representam chamados fechados — não aplicável para "sem atualização". */
export const STALE_CLOSED_STATUSES = ['Resolvido', 'Encerrado', 'Cancelado']

export function isStaleClosed(status: string): boolean {
  return STALE_CLOSED_STATUSES.includes(status)
}

/**
 * Retorna a data (ISO) da última atividade do chamado — a mais recente entre
 * `updated`, `lastInteraction` e `created` (fallback).
 */
export function computeLastActivityIso(
  updated?: string,
  created?: string,
  lastInteraction?: string,
): string {
  const candidates = [updated, lastInteraction, created].filter(Boolean) as string[]
  if (candidates.length === 0) return ''
  // Ordenação lexicográfica funciona para ISO 8601 UTC.
  return candidates.sort().pop() as string
}

/** Mesmo que `computeLastActivityIso`, mas em milissegundos (epoch). */
export function computeLastActivityMs(
  updated?: string,
  created?: string,
  lastInteraction?: string,
): number {
  const iso = computeLastActivityIso(updated, created, lastInteraction)
  if (!iso) return 0
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export type StaleLevel = 'green' | 'yellow' | 'orange' | 'red'

/**
 * Nível de cor do indicador de tempo sem atualização:
 * - Verde:   menos de 4 horas
 * - Amarelo: entre 4 e 8 horas
 * - Laranja: entre 8 e 24 horas
 * - Vermelho: mais de 24 horas
 */
export function getStaleLevel(elapsedSeconds: number): StaleLevel {
  const hours = elapsedSeconds / 3600
  if (hours < 4) return 'green'
  if (hours < 8) return 'yellow'
  if (hours < 24) return 'orange'
  return 'red'
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Formato adaptativo do tempo decorrido (em segundos):
 * - < 60s        → "X segundo(s)"
 * - < 60min      → "X minuto(s)"
 * - < 24h        → "X hora(s)"
 * - < 30 dias    → "X dia(s)"
 * - >= 30 dias   → "X mês/meses"
 */
export function formatStaleDuration(elapsedSeconds: number): string {
  const s = Math.max(0, Math.floor(elapsedSeconds))
  if (s < 60) return pluralize(s, 'segundo', 'segundos')
  const m = Math.floor(s / 60)
  if (m < 60) return pluralize(m, 'minuto', 'minutos')
  const h = Math.floor(s / 3600)
  if (h < 24) return pluralize(h, 'hora', 'horas')
  const d = Math.floor(s / 86400)
  if (d < 30) return pluralize(d, 'dia', 'dias')
  const months = Math.floor(d / 30)
  return pluralize(months, 'mês', 'meses')
}
