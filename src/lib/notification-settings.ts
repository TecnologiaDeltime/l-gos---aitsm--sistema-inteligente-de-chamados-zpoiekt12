const VOICE_ALERTS_KEY = 'itsm_voice_alerts_enabled'
const SLA_THRESHOLD_KEY = 'itsm_sla_threshold_minutes'
const OPERATOR_ALERTS_MUTED_KEY = 'itsm_operator_alerts_muted'

export function getOperatorAlertsMuted(): boolean {
  return localStorage.getItem(OPERATOR_ALERTS_MUTED_KEY) === 'true'
}

export function setOperatorAlertsMuted(muted: boolean): void {
  localStorage.setItem(OPERATOR_ALERTS_MUTED_KEY, String(muted))
  // Dispara evento para sincronizar componentes na mesma aba imediatamente
  window.dispatchEvent(
    new CustomEvent('itsm:alerts-muted-changed', {
      detail: { muted },
    }),
  )
}

export function getVoiceAlertsEnabled(): boolean {
  if (getOperatorAlertsMuted()) return false
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
