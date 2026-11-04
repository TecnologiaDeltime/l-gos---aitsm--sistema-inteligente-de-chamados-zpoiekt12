import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { maskHHMMSSInput, validateHHMMSS } from '@/lib/duration'

export interface DurationInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  /** Valor no formato "HH:MM:SS", string vazia ou número */
  value: string | number | undefined | null
  /** Callback disparado quando o valor muda. Retorna string formatada (ex.: "02:00:00" ou parcial "02:00") ou vazia. */
  onChange: (value: string) => void
  /**
   * Se true, quando o campo perde o foco ele normaliza para 6 dígitos completos ("HH:MM:SS")
   * com zeros à direita (ex.: "2" -> "02:00:00", "01:30" -> "01:30:00").
   * Padrão: true.
   */
  normalizeOnBlur?: boolean
  /** Mensagem ou função de erro opcional para validação visual */
  errorMessage?: string
  /** Se true, valida obrigatoriedade (> 00:00:00) */
  requiredDuration?: boolean
  /** Callback opcional chamado quando o erro de validação muda */
  onErrorChange?: (error: string) => void
}

/**
 * Posições dos separadores ':' em "HH:MM:SS"
 * Índices:
 * 0, 1 -> HH
 * 2 -> ':'
 * 3, 4 -> MM
 * 5 -> ':'
 * 6, 7 -> SS
 */
const COLON_POSITIONS = [2, 5]

/**
 * Normaliza qualquer entrada (números soltos, valores parciais, colados) para HH:MM:SS completo.
 * Ex.:
 * - "2" -> "02:00:00"
 * - "20" -> "20:00:00"
 * - "0130" -> "01:30:00"
 * - "1:30" -> "01:30:00"
 * - "01:45:30" -> "01:45:30"
 */
export function normalizeDurationString(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  // Se já tiver colons, respeita os blocos
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => p.replace(/\D/g, ''))
    if (parts.length === 3) {
      const h = (parts[0] || '0').slice(0, 3).padStart(2, '0')
      const m = (parts[1] || '0').slice(0, 2).padStart(2, '0')
      const s = (parts[2] || '0').slice(0, 2).padStart(2, '0')
      return `${h}:${m}:${s}`
    }
    if (parts.length === 2) {
      const h = (parts[0] || '0').slice(0, 2).padStart(2, '0')
      const m = (parts[1] || '0').slice(0, 2).padStart(2, '0')
      return `${h}:${m}:00`
    }
    if (parts.length === 1) {
      const h = (parts[0] || '0').slice(0, 2).padStart(2, '0')
      return `${h}:00:00`
    }
  }

  // Apenas dígitos
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  const d = digits.slice(0, 6)
  if (d.length === 1) return `0${d}:00:00`
  if (d.length === 2) return `${d}:00:00`
  if (d.length === 3) return `${d.slice(0, 2)}:${d[2]}0:00`
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2, 4)}:00`
  if (d.length === 5) return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d[4]}0`
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}`
}

/**
 * Converte dígitos parciais digitados em formato amigável durante a digitação:
 * - 1 dígito: "0" -> "0"
 * - 2 dígitos: "02" -> "02:" (prepara para minutos)
 * - 3 dígitos: "02:1" -> "02:1"
 * - 4 dígitos: "02:15" -> "02:15:"
 * - 5 dígitos: "02:15:3"
 * - 6 dígitos: "02:15:30"
 */
export function formatProgressiveDuration(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
}

export const DurationInput = forwardRef<HTMLInputElement, DurationInputProps>(
  (
    {
      value,
      onChange,
      normalizeOnBlur = true,
      errorMessage,
      requiredDuration = false,
      onErrorChange,
      className,
      placeholder = '00:00:00',
      onBlur,
      onFocus,
      onKeyDown,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const stringifiedValue = value != null ? String(value) : ''

    // Estado interno do texto exibido no input enquanto o usuário digita
    const [displayValue, setDisplayValue] = useState<string>(stringifiedValue)
    const [isFocused, setIsFocused] = useState(false)
    const [internalError, setInternalError] = useState<string>('')

    // Sincroniza displayValue quando o valor externo muda (e o campo não estiver em foco)
    useEffect(() => {
      const ext = value != null ? String(value) : ''
      if (!isFocused) {
        setDisplayValue(ext)
      }
    }, [value, isFocused])

    // Dispara validação sempre que displayValue ou required muda
    useEffect(() => {
      if (!displayValue && !requiredDuration) {
        setInternalError('')
        onErrorChange?.('')
        return
      }
      const err = validateHHMMSS(displayValue, requiredDuration)
      setInternalError(err)
      onErrorChange?.(err)
    }, [displayValue, requiredDuration, onErrorChange])

    const updateValueWithCursor = useCallback(
      (newVal: string, desiredCursor: number) => {
        setDisplayValue(newVal)
        onChange(newVal)
        requestAnimationFrame(() => {
          if (inputRef.current) {
            const clamped = Math.min(desiredCursor, newVal.length)
            inputRef.current.setSelectionRange(clamped, clamped)
          }
        })
      },
      [onChange],
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e)
      if (e.defaultPrevented) return

      const input = inputRef.current
      if (!input) return

      // Teclas de controle que deixamos passar
      if (
        e.key === 'Tab' ||
        e.key === 'Enter' ||
        e.key === 'Escape' ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return
      }

      const selStart = input.selectionStart ?? 0
      const selEnd = input.selectionEnd ?? 0
      const current = displayValue

      // 1. Navegação com setas: pula ':' naturalmente
      if (e.key === 'ArrowLeft') {
        if (selStart === selEnd && COLON_POSITIONS.includes(selStart - 1)) {
          e.preventDefault()
          const newPos = Math.max(0, selStart - 2)
          input.setSelectionRange(newPos, newPos)
        }
        return
      }

      if (e.key === 'ArrowRight') {
        if (selStart === selEnd && COLON_POSITIONS.includes(selStart)) {
          e.preventDefault()
          const newPos = Math.min(current.length, selStart + 2)
          input.setSelectionRange(newPos, newPos)
        }
        return
      }

      // 2. Se o usuário digitou ':' avança para o próximo segmento
      if (e.key === ':') {
        e.preventDefault()
        if (selStart <= 2) {
          // Pula para minutos (índice 3)
          const padded =
            current.slice(0, selStart).padStart(2, '0') +
            ':' +
            current.slice(selStart).replace(/^:/, '')
          updateValueWithCursor(padded, 3)
        } else if (selStart <= 5) {
          // Pula para segundos (índice 6)
          const before = current.slice(0, selStart)
          const after = current.slice(selStart).replace(/^:/, '')
          const formatted = `${before}:${after}`
          updateValueWithCursor(formatted, 6)
        }
        return
      }

      // 3. Backspace
      if (e.key === 'Backspace') {
        // Se há seleção, apaga a seleção
        if (selStart !== selEnd) {
          e.preventDefault()
          const next = current.slice(0, selStart) + current.slice(selEnd)
          const formatted = formatProgressiveDuration(next)
          updateValueWithCursor(formatted, selStart)
          return
        }

        // Se está no início, não faz nada
        if (selStart === 0) return

        e.preventDefault()
        // Se está logo após um ':', remove o dígito antes dele
        let removeIdx = selStart - 1
        if (current[removeIdx] === ':') {
          removeIdx -= 1
        }
        if (removeIdx < 0) return

        const chars = current.split('')
        chars.splice(removeIdx, 1)
        const next = chars.join('').replace(/::+/g, ':')
        const formatted = formatProgressiveDuration(next)
        const newCursor = Math.max(0, removeIdx)
        updateValueWithCursor(formatted, newCursor)
        return
      }

      // 4. Delete
      if (e.key === 'Delete') {
        if (selStart !== selEnd) {
          e.preventDefault()
          const next = current.slice(0, selStart) + current.slice(selEnd)
          const formatted = formatProgressiveDuration(next)
          updateValueWithCursor(formatted, selStart)
          return
        }

        e.preventDefault()
        let removeIdx = selStart
        if (current[removeIdx] === ':') {
          removeIdx += 1
        }
        if (removeIdx >= current.length) return

        const chars = current.split('')
        chars.splice(removeIdx, 1)
        const next = chars.join('')
        const formatted = formatProgressiveDuration(next)
        updateValueWithCursor(formatted, selStart)
        return
      }

      // 5. Dígitos 0-9
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        const digit = e.key

        // Se estiver selecionado tudo ou campo vazio
        if (selStart === 0 && (selEnd === current.length || current.length === 0)) {
          // Começando novo valor: coloca apenas o dígito digitado (NÃO pula para o final!)
          updateValueWithCursor(digit, 1)
          return
        }

        // Se tem uma seleção parcial
        if (selStart !== selEnd) {
          const rawJoined = current.slice(0, selStart) + digit + current.slice(selEnd)
          const digits = rawJoined.replace(/\D/g, '').slice(0, 6)
          const formatted = formatProgressiveDuration(digits)
          let nextCursor = selStart + 1
          if (COLON_POSITIONS.includes(nextCursor)) nextCursor += 1
          updateValueWithCursor(formatted, nextCursor)
          return
        }

        // Se já está com formato completo "00:00:00" e o usuário está sobrescrevendo na posição do cursor
        if (/^\d{2}:\d{2}:\d{2}$/.test(current)) {
          let target = selStart
          if (target === 2) target = 3
          if (target === 5) target = 6
          if (target >= 8) target = 7

          const chars = current.split('')
          chars[target] = digit
          const updated = chars.join('')
          let nextCursor = target + 1
          if (nextCursor === 2 || nextCursor === 5) nextCursor += 1
          updateValueWithCursor(updated, nextCursor)
          return
        }

        // Digitação progressiva normal (ex.: "0" -> "02" -> "02:0" -> ...)
        const rawJoined = current.slice(0, selStart) + digit + current.slice(selStart)
        const digits = rawJoined.replace(/\D/g, '').slice(0, 6)
        const formatted = formatProgressiveDuration(digits)

        // Calcula onde o cursor deve parar
        let nextCursor = selStart + 1
        // Se ao inserir gerou um ':' logo na frente do dígito inserido, pula ele
        if (formatted[nextCursor] === ':') {
          nextCursor += 1
        }
        updateValueWithCursor(formatted, nextCursor)
        return
      }

      // Bloqueia qualquer outro caractere não numérico
      e.preventDefault()
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Trata paste (colar) ou auto-fill
      const raw = e.target.value
      if (!raw) {
        updateValueWithCursor('', 0)
        return
      }

      // Se colou formato completo ou com colons, normaliza
      if (raw.includes(':') || raw.length >= 6) {
        const normalized = normalizeDurationString(raw)
        updateValueWithCursor(normalized, normalized.length)
        return
      }

      // Dígitos colados
      const formatted = formatProgressiveDuration(raw)
      updateValueWithCursor(formatted, formatted.length)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text') || ''
      const normalized = normalizeDurationString(text)
      if (normalized) {
        updateValueWithCursor(normalized, normalized.length)
      } else {
        const digits = text.replace(/\D/g, '').slice(0, 6)
        const formatted = formatProgressiveDuration(digits)
        updateValueWithCursor(formatted, formatted.length)
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlurInternal = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      const current = displayValue.trim()
      if (normalizeOnBlur && current) {
        const normalized = normalizeDurationString(current)
        setDisplayValue(normalized)
        onChange(normalized)
      }
      onBlur?.(e)
    }

    const activeError = errorMessage || internalError

    return (
      <div className="relative inline-flex flex-col">
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlurInternal}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={8}
          className={cn(
            'font-mono tracking-wider',
            activeError && 'border-red-500 focus-visible:ring-red-400',
            className,
          )}
          {...rest}
        />
      </div>
    )
  },
)

DurationInput.displayName = 'DurationInput'
