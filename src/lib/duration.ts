export function formatMinutes(minutes: number | undefined | null): string {
  const totalSeconds = Math.round((Number(minutes) || 0) * 60)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatHours(hours: number | undefined | null): string {
  return formatMinutes((Number(hours) || 0) * 60)
}
