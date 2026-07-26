let audioContext: AudioContext | null = null
let soundQueue: string[] = []
let isPlaying = false

const SOUND_ENABLED_KEY = 'itsm_ticket_sound_enabled'

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false'
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled))
}

export function initAudio(): void {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      // graceful degradation
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
}

interface ToneConfig {
  freq: number
  start: number
  dur: number
  type: OscillatorType
  gain: number
}

const PRIORITY_TONES: Record<string, { tones: ToneConfig[]; totalDur: number }> = {
  Crítica: {
    tones: [
      { freq: 1046.5, start: 0, dur: 0.1, type: 'square', gain: 0.2 },
      { freq: 1046.5, start: 0.15, dur: 0.1, type: 'square', gain: 0.2 },
      { freq: 1046.5, start: 0.3, dur: 0.1, type: 'square', gain: 0.2 },
      { freq: 1568, start: 0.45, dur: 0.3, type: 'square', gain: 0.25 },
    ],
    totalDur: 0.8,
  },
  Alta: {
    tones: [
      { freq: 880, start: 0, dur: 0.15, type: 'sine', gain: 0.25 },
      { freq: 1174.66, start: 0.12, dur: 0.22, type: 'sine', gain: 0.25 },
    ],
    totalDur: 0.4,
  },
  Média: {
    tones: [
      { freq: 880, start: 0, dur: 0.12, type: 'sine', gain: 0.22 },
      { freq: 1174.66, start: 0.1, dur: 0.18, type: 'sine', gain: 0.22 },
    ],
    totalDur: 0.35,
  },
  Baixa: {
    tones: [{ freq: 587.33, start: 0, dur: 0.18, type: 'sine', gain: 0.12 }],
    totalDur: 0.25,
  },
}

function playChime(priority: string): number {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return 0
    }
  }
  const ctx = audioContext
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  const now = ctx.currentTime
  const config = PRIORITY_TONES[priority] || PRIORITY_TONES['Média']

  config.tones.forEach(({ freq, start, dur, type, gain: gainVal }) => {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = type
    gainNode.gain.setValueAtTime(0, now + start)
    gainNode.gain.linearRampToValueAtTime(gainVal, now + start + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
    osc.start(now + start)
    osc.stop(now + start + dur)
  })

  return config.totalDur
}

export function playTicketChime(priority: string = 'Média'): void {
  if (!isSoundEnabled()) return
  soundQueue.push(priority)
  processQueue()
}

function processQueue(): void {
  if (isPlaying || soundQueue.length === 0) return
  isPlaying = true
  const priority = soundQueue.shift()!
  let duration = 600
  try {
    const toneDur = playChime(priority)
    duration = Math.max(toneDur * 1000 + 200, 300)
  } catch {
    // graceful degradation - audio failed, popup still shows
  }
  setTimeout(() => {
    isPlaying = false
    processQueue()
  }, duration)
}

const selfCreatedTickets = new Set<string>()

export function markTicketAsSelfCreated(id: string): void {
  selfCreatedTickets.add(id)
  setTimeout(() => selfCreatedTickets.delete(id), 10000)
}

export function isSelfCreatedTicket(id: string): boolean {
  return selfCreatedTickets.has(id)
}
