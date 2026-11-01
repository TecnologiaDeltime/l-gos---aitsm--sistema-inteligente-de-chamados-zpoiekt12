/**
 * Utilitários para a máscara de Tempo Gasto no formato "00:00" (HH:MM).
 *
 * Requisitos do chamado:
 * 1. Digitar números preenche primeiro as horas e depois os minutos:
 *    - Usuário digita '0145' -> '01:45'
 *    - Usuário digita '2' (em campo vazio) -> '02:00'
 *    - Usuário digita '14' -> '14:00'
 * 2. Apagar e redigitar funciona normalmente:
 *    - Backspace/Delete permite apagar e redigitar horas ou minutos
 *    - Permite apagar tudo e recomeçar sem precisar recarregar a página
 * 3. Dois pontos (:) ficam fixos na máscara no formato 00:00
 * 4. Minutos continuam validando até 59
 */

/**
 * Converte uma sequência de dígitos (1 a 4) em valor formatado HH:MM.
 *
 * Exemplos:
 * - "" -> ""
 * - "2" -> "02:00"
 * - "01" -> "01:00"
 * - "14" -> "14:00"
 * - "014" -> "01:40"
 * - "0145" -> "01:45"
 */
export function formatDigitsToTimeSpent(digitsOnly: string): string {
  const digits = digitsOnly.replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''

  if (digits.length <= 2) {
    const hh = digits.padStart(2, '0')
    return `${hh}:00`
  }

  // Se tem 3 dígitos digitados em sequência (ex: 014 -> 01:40)
  if (digits.length === 3) {
    const hh = digits.slice(0, 2)
    const mm = digits.slice(2).padEnd(2, '0')
    return `${hh}:${mm}`
  }

  // 4 dígitos (ex: 0145 -> 01:45)
  const hh = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  return `${hh}:${mm}`
}

/**
 * Trata evento onChange tradicional caso o usuário cole texto ou use mobile/autofill.
 */
export function handleTimeSpentMask(rawInput: string, _previousValue = ''): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 4)
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

  // Trata Backspace
  if (e.key === 'Backspace') {
    e.preventDefault()

    // Se tudo ou parte do texto está selecionado
    if (selStart !== selEnd) {
      if (selStart === 0 && selEnd >= timeSpent.length) {
        setTimeSpent('')
        setTimeError?.('')
        return true
      }
      // Se selecionou apenas uma parte, substitui os dígitos selecionados por '0'
      const chars = (timeSpent || '00:00').split('')
      for (let i = selStart; i < selEnd && i < chars.length; i++) {
        if (i !== 2 && /\d/.test(chars[i])) {
          chars[i] = '0'
        }
      }
      chars[2] = ':'
      const updated = chars.slice(0, 5).join('')
      if (updated === '00:00') {
        setTimeSpent('')
        setTimeError?.('')
      } else {
        setTimeSpent(updated)
        setTimeError?.(validator ? validator(updated) : '')
        setTimeout(() => {
          input.setSelectionRange(selStart, selStart)
        }, 0)
      }
      return true
    }

    // Sem seleção: apagar o caractere antes do cursor
    if (selStart === 0) {
      return true
    }

    let deleteIdx = selStart - 1
    // Se o cursor estiver na posição 3 (logo após ':'), pula os dois pontos e apaga o dígito da hora
    if (deleteIdx === 2) {
      deleteIdx = 1
    }

    const chars = (timeSpent || '00:00').split('')
    if (deleteIdx >= 0 && deleteIdx < chars.length) {
      chars[deleteIdx] = '0'
      chars[2] = ':'
      const updated = chars.slice(0, 5).join('')
      if (updated === '00:00') {
        setTimeSpent('')
        setTimeError?.('')
      } else {
        setTimeSpent(updated)
        setTimeError?.(validator ? validator(updated) : '')
        setTimeout(() => {
          input.setSelectionRange(deleteIdx, deleteIdx)
        }, 0)
      }
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
      const chars = (timeSpent || '00:00').split('')
      for (let i = selStart; i < selEnd && i < chars.length; i++) {
        if (i !== 2 && /\d/.test(chars[i])) {
          chars[i] = '0'
        }
      }
      chars[2] = ':'
      const updated = chars.slice(0, 5).join('')
      if (updated === '00:00') {
        setTimeSpent('')
        setTimeError?.('')
      } else {
        setTimeSpent(updated)
        setTimeError?.(validator ? validator(updated) : '')
        setTimeout(() => {
          input.setSelectionRange(selStart, selStart)
        }, 0)
      }
      return true
    }

    let deleteIdx = selStart
    if (deleteIdx === 2) {
      deleteIdx = 3
    }

    const chars = (timeSpent || '00:00').split('')
    if (deleteIdx < chars.length) {
      chars[deleteIdx] = '0'
      chars[2] = ':'
      const updated = chars.slice(0, 5).join('')
      if (updated === '00:00') {
        setTimeSpent('')
        setTimeError?.('')
      } else {
        setTimeSpent(updated)
        setTimeError?.(validator ? validator(updated) : '')
        setTimeout(() => {
          const nextCursor = deleteIdx === 1 ? 3 : deleteIdx + 1
          input.setSelectionRange(nextCursor, nextCursor)
        }, 0)
      }
    }
    return true
  }

  // Se for dígito numérico (0-9)
  if (/^\d$/.test(e.key)) {
    e.preventDefault()

    // Se o campo estiver vazio ou "00:00" e o cursor no início
    if (!timeSpent || timeSpent === '00:00') {
      const formatted = formatDigitsToTimeSpent(e.key)
      setTimeSpent(formatted)
      setTimeError?.(validator ? validator(formatted) : '')
      // Cursor após o dígito das horas digitado (posição 2, antes dos dois pontos)
      setTimeout(() => {
        input.setSelectionRange(2, 2)
      }, 0)
      return true
    }

    // Se o campo já possui valor "HH:MM", substitui na posição do cursor
    let targetIdx = selStart
    if (targetIdx === 2) {
      targetIdx = 3 // Pula ':'
    }
    if (targetIdx >= 5) {
      targetIdx = 4
    }

    const chars = timeSpent.split('')
    chars[targetIdx] = e.key
    chars[2] = ':'
    const formatted = chars.slice(0, 5).join('')
    setTimeSpent(formatted)
    setTimeError?.(validator ? validator(formatted) : '')

    // Avança cursor para o próximo caractere
    let nextCursor = targetIdx + 1
    if (nextCursor === 2) nextCursor = 3
    if (nextCursor > 5) nextCursor = 5
    setTimeout(() => {
      input.setSelectionRange(nextCursor, nextCursor)
    }, 0)
    return true
  }

  // Bloqueia qualquer outro caractere não numérico
  e.preventDefault()
  return true
}

/**
 * Validador para o formato HH:MM com minutos <= 59.
 *
 * @param val Valor string a validar (ex: "01:45")
 * @param required Se true, não aceita vazio
 */
export function validateTimeSpentValue(val: string, required = false): string {
  const trimmed = val.trim()
  if (!trimmed) {
    return required ? 'Informe o tempo gasto no acompanhamento.' : ''
  }

  const match = trimmed.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return 'Formato inválido. Use 00:00.'
  }

  const mins = parseInt(match[2], 10)
  if (mins > 59) {
    return 'Minutos inválidos (máximo 59).'
  }

  const totalMin = parseInt(match[1], 10) * 60 + mins
  if (required && totalMin <= 0) {
    return 'O tempo deve ser maior que 00:00.'
  }

  return ''
}
