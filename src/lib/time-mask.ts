/**
 * Utilitários para a máscara de Tempo Gasto no formato "00:00:00" (HH:MM:SS).
 *
 * Requisitos do chamado:
 * 1. Digitar números preenche primeiro as horas, depois minutos e segundos:
 *    - Usuário digita '014530' -> '01:45:30'
 *    - Usuário digita '2' (em campo vazio) -> '02:00:00'
 * 2. Apagar e redigitar funciona normalmente (Backspace/Delete).
 * 3. Os dois pontos (:) ficam fixos na máscara no formato 00:00:00.
 * 4. Minutos e segundos validam até 59.
 */

const COLON_1 = 2
const COLON_2 = 5
const LENGTH = 8

function skeleton(): string[] {
  return '00:00:00'.split('')
}

/**
 * Converte uma sequência de dígitos (1 a 6) em valor formatado HH:MM:SS.
 *
 * Exemplos:
 * - "" -> ""
 * - "2" -> "02:00:00"
 * - "014" -> "01:40:00"
 * - "0145" -> "01:45:00"
 * - "014530" -> "01:45:30"
 */
export function formatDigitsToTimeSpent(digitsOnly: string): string {
  const digits = digitsOnly.replace(/\D/g, '').slice(0, 6)
  if (!digits) return ''

  const chars = skeleton()
  // Preenche da esquerda: HH, depois MM, depois SS (zeros à direita nos grupos incompletos)
  const hh = digits.slice(0, 2).padEnd(2, '0')
  const mm = (digits.slice(2, 4) || '00').padEnd(2, '0')
  const ss = (digits.slice(4, 6) || '00').padEnd(2, '0')
  chars[0] = hh[0]
  chars[1] = hh[1]
  chars[3] = mm[0]
  chars[4] = mm[1]
  chars[6] = ss[0]
  chars[7] = ss[1]
  return chars.join('')
}

/**
 * Trata evento onChange tradicional caso o usuário cole texto ou use mobile/autofill.
 */
export function handleTimeSpentMask(rawInput: string, _previousValue = ''): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 6)
  if (!digits) return ''
  return formatDigitsToTimeSpent(digits)
}

/**
 * Trata o evento onKeyDown para navegação cirúrgica, substituição direta e deleção limpa.
 */
export function handleTimeSpentKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  timeSpent: string,
  setTimeSpent: (val: string) => void,
  setTimeError?: (err: string) => void,
  validator?: (val: string) => string,
): boolean {
  const input = e.currentTarget
  const selStart = input.selectionStart ?? 0
  const selEnd = input.selectionEnd ?? 0
  const EMPTY = '00:00:00'

  // Permite teclas de controle e navegação
  if (
    e.key === 'Tab' ||
    e.key === 'Enter' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight' ||
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'Home' ||
    e.key === 'End' ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  ) {
    return false
  }

  const applyUpdate = (chars: string[], cursor: number, clearIfEmpty: boolean, clearCursor = 0) => {
    chars[COLON_1] = ':'
    chars[COLON_2] = ':'
    const updated = chars.slice(0, LENGTH).join('')
    if (clearIfEmpty && updated === EMPTY) {
      setTimeSpent('')
      setTimeError?.('')
    } else {
      setTimeSpent(updated)
      setTimeError?.(validator ? validator(updated) : '')
      setTimeout(() => {
        input.setSelectionRange(cursor, cursor)
      }, 0)
    }
  }

  const isDigitPos = (i: number) => i !== COLON_1 && i !== COLON_2

  // Trata Backspace
  if (e.key === 'Backspace') {
    e.preventDefault()

    if (selStart !== selEnd) {
      if (selStart === 0 && selEnd >= timeSpent.length) {
        setTimeSpent('')
        setTimeError?.('')
        return true
      }
      const chars = (timeSpent || EMPTY).split('')
      for (let i = selStart; i < selEnd && i < chars.length; i++) {
        if (isDigitPos(i)) chars[i] = '0'
      }
      applyUpdate(chars, selStart, true)
      return true
    }

    if (selStart === 0) return true

    let deleteIdx = selStart - 1
    // Pula os dois pontos para apagar o dígito anterior
    if (deleteIdx === COLON_1) deleteIdx = COLON_1 - 1
    if (deleteIdx === COLON_2) deleteIdx = COLON_2 - 1

    const chars = (timeSpent || EMPTY).split('')
    if (deleteIdx >= 0 && deleteIdx < chars.length) {
      chars[deleteIdx] = '0'
      applyUpdate(chars, deleteIdx, true)
    }
    return true
  }

  // Trata Delete
  if (e.key === 'Delete') {
    e.preventDefault()

    if (selStart !== selEnd) {
      if (selStart === 0 && selEnd >= timeSpent.length) {
        setTimeSpent('')
        setTimeError?.('')
        return true
      }
      const chars = (timeSpent || EMPTY).split('')
      for (let i = selStart; i < selEnd && i < chars.length; i++) {
        if (isDigitPos(i)) chars[i] = '0'
      }
      applyUpdate(chars, selStart, true)
      return true
    }

    let deleteIdx = selStart
    if (deleteIdx === COLON_1) deleteIdx = COLON_1 + 1
    if (deleteIdx === COLON_2) deleteIdx = COLON_2 + 1

    const chars = (timeSpent || EMPTY).split('')
    if (deleteIdx < chars.length) {
      chars[deleteIdx] = '0'
      const nextCursor = deleteIdx
      applyUpdate(chars, nextCursor, true)
    }
    return true
  }

  // Se for dígito numérico (0-9)
  if (/^\d$/.test(e.key)) {
    e.preventDefault()

    // Campo vazio: começa preenchendo as horas
    if (!timeSpent || timeSpent === EMPTY) {
      const formatted = formatDigitsToTimeSpent(e.key)
      setTimeSpent(formatted)
      setTimeError?.(validator ? validator(formatted) : '')
      setTimeout(() => {
        input.setSelectionRange(COLON_1, COLON_1)
      }, 0)
      return true
    }

    // Substitui na posição do cursor, pulando os dois pontos
    let targetIdx = selStart
    if (targetIdx === COLON_1) targetIdx = COLON_1 + 1
    if (targetIdx === COLON_2) targetIdx = COLON_2 + 1
    if (targetIdx >= LENGTH) targetIdx = LENGTH - 1

    const chars = timeSpent.split('')
    chars[targetIdx] = e.key
    let nextCursor = targetIdx + 1
    if (nextCursor === COLON_1 || nextCursor === COLON_2) nextCursor += 1
    if (nextCursor > LENGTH) nextCursor = LENGTH
    applyUpdate(chars, nextCursor, false)
    return true
  }

  // Bloqueia qualquer outro caractere não numérico
  e.preventDefault()
  return true
}

/**
 * Validador para o formato HH:MM:SS com minutos/segundos <= 59.
 *
 * @param val Valor string a validar (ex: "01:45:30")
 * @param required Se true, não aceita vazio nem 00:00:00
 */
export function validateTimeSpentValue(val: string, required = false): string {
  const trimmed = val.trim()
  if (!trimmed) {
    return required ? 'Informe o tempo gasto no formato 00:00:00.' : ''
  }

  const match = trimmed.match(/^(\d{1,3}):(\d{2}):(\d{2})$/)
  if (!match) {
    return 'Formato inválido. Use 00:00:00 (horas:minutos:segundos).'
  }

  const mins = parseInt(match[2], 10)
  const secs = parseInt(match[3], 10)
  if (mins > 59 || secs > 59) {
    return 'Minutos e segundos inválidos (máximo 59).'
  }

  const totalSeconds = parseInt(match[1], 10) * 3600 + mins * 60 + secs
  if (required && totalSeconds <= 0) {
    return 'O tempo deve ser maior que 00:00:00.'
  }

  return ''
}
