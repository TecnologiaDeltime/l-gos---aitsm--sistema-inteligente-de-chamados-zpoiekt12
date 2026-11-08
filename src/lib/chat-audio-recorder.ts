/**
 * Gravação de áudio do chat interno via MediaRecorder.
 * Retorna um File (Blob nomeado) pronto para o campo `file` da mensagem.
 */
export interface AudioRecorderState {
  recording: boolean
  seconds: number
  error: string | null
}

export interface AudioRecorderControls {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
}

/**
 * MIME preferido pelo MediaRecorder deste navegador (com fallback amplo).
 * A ordem cobre Chrome/Edge (webm+opus), Firefox (ogg+opus) e Safari (mp4/aac).
 * Se nenhum MIME específico for suportado, usamos o MediaRecorder SEM mimeType:
 * o navegador grava no seu formato padrão — a allowlist do campo file (0138)
 * aceita todas as detecções de conteúdo reais desses formatos.
 */
function pickAudioMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
  ]
  const supported = candidates.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t)
    } catch (_) {
      return false
    }
  })
  if (supported) return supported
  // Último recurso: alguns navegadores aceitam gravar mas não anunciam suporte.
  try {
    return new MediaRecorder(new MediaStream()).mimeType || undefined
  } catch (_) {
    return undefined
  }
}

/** Extensão coerente com o MIME gravado (o PocketBase preserva a extensão do nome). */
function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

export function createAudioRecorder(
  onStateChange: (state: AudioRecorderState) => void,
  onFinished: (file: File) => void,
): AudioRecorderControls {
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: BlobPart[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  let seconds = 0
  let cancelled = false
  let mimeType: string | undefined

  const emit = (error: string | null = null) => {
    onStateChange({ recording: !!recorder && recorder.state === 'recording', seconds, error })
  }

  const cleanup = () => {
    if (timer) clearInterval(timer)
    timer = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    recorder = null
  }

  return {
    async start() {
      try {
        cancelled = false
        chunks = []
        seconds = 0
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mimeType = pickAudioMime()
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }
        recorder.onstop = () => {
          const wasCancelled = cancelled
          cleanup()
          if (wasCancelled) {
            emit(null)
            return
          }
          // recorder já foi limpo em cleanup() — usar a variável mimeType capturada no start.
          const type = mimeType || 'audio/webm'
          const blob = new Blob(chunks, { type })
          const ext = extensionForMime(type)
          onFinished(
            new File([blob], `audio-chat-${Date.now()}.${ext}`, { type: blob.type || type }),
          )
          seconds = 0
          emit(null)
        }
        recorder.start()
        timer = setInterval(() => {
          seconds += 1
          emit(null)
        }, 1000)
        emit(null)
      } catch (err: any) {
        cleanup()
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Permissão de microfone negada pelo navegador.'
            : err?.name === 'NotFoundError'
              ? 'Nenhum microfone encontrado neste dispositivo.'
              : 'Não foi possível iniciar a gravação de áudio.'
        onStateChange({ recording: false, seconds: 0, error: msg })
      }
    },
    stop() {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      } else {
        cleanup()
        emit(null)
      }
    },
    cancel() {
      cancelled = true
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      } else {
        cleanup()
        emit(null)
      }
    },
  }
}
