const VOICE_ALERTS_KEY = 'itsm_voice_alerts_enabled'
const SLA_THRESHOLD_KEY = 'itsm_sla_threshold_minutes'

export function getVoiceAlertsEnabled(): boolean {
  const val = localStorage.getItem(VOICE_ALERTS_KEY)
  return val === null ? true : val === 'true'
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  localStorage.setItem(VOICE_ALERTS_KEY, String(enabled))
}

export function getSlaThresholdMinutes(): number {
  const val = localStorage.getItem(SLA_THRESHOLD_KEY)
  return val === null ? 30 : parseInt(val, 10) || 30
}

export function setSlaThresholdMinutes(minutes: number): void {
  localStorage.setItem(SLA_THRESHOLD_KEY, String(Math.max(1, minutes)))
}
