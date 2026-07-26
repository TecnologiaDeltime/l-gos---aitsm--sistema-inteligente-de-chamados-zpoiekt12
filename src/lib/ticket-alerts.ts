let audioContext: AudioContext | null = null
let soundQueue: number[] = []
let isPlaying = false

const SOUND_ENABLED_KEY = 'itsm_ticket_sound_enabled'

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false'
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled))
}

function playChime(): void {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  const ctx = audioContext
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  const now = ctx.currentTime
  const notes = [
    { freq: 880, start: 0, dur: 0.12 },
    { freq: 1174.66, start: 0.1, dur: 0.18 },
  ]
  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
    osc.start(now + start)
    osc.stop(now + start + dur)
  })
}

export function playTicketChime(): void {
  if (!isSoundEnabled()) return
  soundQueue.push(1)
  processQueue()
}

function processQueue(): void {
  if (isPlaying || soundQueue.length === 0) return
  isPlaying = true
  soundQueue.shift()
  try {
    playChime()
  } catch {
    // graceful degradation - audio failed, popup still shows
  }
  setTimeout(() => {
    isPlaying = false
    processQueue()
  }, 600)
}

const selfCreatedTickets = new Set<string>()

export function markTicketAsSelfCreated(id: string): void {
  selfCreatedTickets.add(id)
  setTimeout(() => selfCreatedTickets.delete(id), 10000)
}

export function isSelfCreatedTicket(id: string): boolean {
  return selfCreatedTickets.has(id)
}
