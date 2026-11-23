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
import { maskHHMMInput, normalizeHHMMInput } from '@/lib/duration'

export interface HHMMInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  /** Valor no formato "HH:MM" (ex.: "00:45" = 45 minutos), string vazia ou undefined */
  value: string | undefined | null
  /** Callback disparado a cada tecla. Retorna a string já mascarada ("05:30", "45", ou vazia). */
  onChange: (value: string) => void
  /** Se true, completa ao perder o foco: "5" -> "05:00", "45" -> "45:00", "053" -> "05:30". Padrão: true */
  normalizeOnBlur?: boolean
}

/**
 * Posições do ':' travado em "HH:MM" — índice 2.
 * 0, 1 -> HH  |  2 -> ':' (NÃO digitável, não removível)  |  3, 4 -> MM
 */
const COLON_POS = 2

/**
 * Campo de tempo em HORAS:MINUTOS (formato 00:00) com dois-pontos TRAVADOS.
 * - Aceita apenas dígitos (máx. 4); ':' é inserido automaticamente e não pode
 *   ser digitado, removido nem selecionado isoladamente.
 * - Um único campo: sem setas, sem dois inputs, sem seleção por segmento.
 * - Setas esquerda/direita pulam o ':' naturalmente (o ':' nunca fica sob o cursor).
 * - Ao perder o foco, completa com zeros: "45" -> "45:00", "053" -> "05:30".
 * - Colar "0530", "5:30", "5h30" etc. também normaliza.
 */
export const HHMMInput = forwardRef<HTMLInputElement, HHMMInputProps>(
  (
    {
      value,
      onChange,
      normalizeOnBlur = true,
      className,
      onKeyDown,
      onBlur,
      onFocus,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const [display, setDisplay] = useState(value != null ? String(value) : '')
    const [isFocused, setIsFocused] = useState(false)

    // Sincroniza com o valor externo quando o campo NÃO está em foco
    useEffect(() => {
      if (!isFocused) setDisplay(value != null ? String(value) : '')
    }, [value, isFocused])

    const commit = useCallback(
      (next: string, cursor: number) => {
        setDisplay(next)
        onChange(next)
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (el) {
            const clamped = Math.min(Math.max(cursor, 0), next.length)
            // Nunca deixa o cursor parar em cima do ':' travado
            const pos = clamped === COLON_POS ? clamped - 1 : clamped
            el.setSelectionRange(pos, pos)
          }
        })
      },
      [onChange],
    )

    const countDigits = (s: string) => s.replace(/\D/g, '').length

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e)
      if (e.defaultPrevented) return

      const el = inputRef.current
      if (!el) return

      // Teclas de controle passam sem intervenção
      if (['Tab', 'Enter', 'Escape'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return

      const selStart = el.selectionStart ?? 0
      const selEnd = el.selectionEnd ?? 0
      const cur = display

      // ':' digitado manualmente: ignora (o ':' já é desenhado pela máscara)
      if (e.key === ':') {
        e.preventDefault()
        return
      }

      // Backspace: remove o dígito à esquerda, pulando o ':' travado
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (selStart !== selEnd) {
          // apaga a seleção (o ':' pode estar dentro, mas será re-inserido pela máscara)
          const next = maskHHMMInput(cur.slice(0, selStart) + cur.slice(selEnd))
          commit(next, selStart)
          return
        }
        if (selStart === 0) return
        let removeIdx = selStart - 1
        if (cur[removeIdx] === ':') removeIdx -= 1
        if (removeIdx < 0) return
        const chars = cur.split('')
        chars.splice(removeIdx, 1)
        commit(maskHHMMInput(chars.join('')), removeIdx)
        return
      }

      // Delete: remove o dígito à direita, pulando o ':' travado
      if (e.key === 'Delete') {
        e.preventDefault()
        if (selStart !== selEnd) {
          const next = maskHHMMInput(cur.slice(0, selStart) + cur.slice(selEnd))
          commit(next, selStart)
          return
        }
        let removeIdx = selStart
        if (cur[removeIdx] === ':') removeIdx += 1
        if (removeIdx >= cur.length) return
        const chars = cur.split('')
        chars.splice(removeIdx, 1)
        commit(maskHHMMInput(chars.join('')), selStart)
        return
      }

      // Dígito 0-9
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        // Seleção total ou campo vazio: começa do zero
        if (cur === '' || (selStart === 0 && selEnd === cur.length)) {
          commit(e.key, 1)
          return
        }
        // Seleção parcial: substitui o trecho
        if (selStart !== selEnd) {
          const joined = cur.slice(0, selStart) + e.key + cur.slice(selEnd)
          const formatted = maskHHMMInput(joined)
          let cursor = selStart + 1
          if (cursor === COLON_POS) cursor += 1
          commit(formatted, cursor)
          return
        }
        // Sem seleção: insere na posição do cursor (cursor nunca está sobre o ':')
        const joined = cur.slice(0, selStart) + e.key + cur.slice(selStart)
        const digits = countDigits(joined)
        const formatted = maskHHMMInput(joined)
        let cursor = selStart + 1
        // Se o campo já estava cheio (4 dígitos), o dígito novo é descartado
        if (digits > 4) return
        // Se após inserir o cursor caiu sobre o ':', avança
        if (cursor === COLON_POS) cursor += 1
        // Se não couber (campo cheio após a inserção), não faz nada
        if (formatted.replace(/\D/g, '').length > 4) return
        commit(formatted, cursor)
        return
      }

      // Seta esquerda: pula o ':' travado para trás
      if (e.key === 'ArrowLeft') {
        if (selStart === selEnd && selStart - 1 === COLON_POS) {
          e.preventDefault()
          el.setSelectionRange(selStart - 2, selStart - 2)
        }
        return
      }

      // Seta direita: pula o ':' travado para frente
      if (e.key === 'ArrowRight') {
        if (selStart === selEnd && selStart === COLON_POS) {
          e.preventDefault()
          el.setSelectionRange(selStart + 1, selStart + 1)
        }
        return
      }

      // Bloqueia qualquer outro caractere (letras, hifen, espaço, etc.)
      e.preventDefault()
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Cobertura para colar (paste vai pelo onPaste, mas autofill/IME vêm por aqui)
      const formatted = maskHHMMInput(e.target.value)
      commit(formatted, formatted.length)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const formatted = maskHHMMInput(e.clipboardData.getData('text') || '')
      commit(formatted, formatted.length)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      if (normalizeOnBlur && display.trim()) {
        const normalized = normalizeHHMMInput(display)
        setDisplay(normalized)
        onChange(normalized)
      }
      onBlur?.(e)
    }

    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        maxLength={5}
        placeholder="00:00"
        className={cn('font-mono tracking-wider', className)}
        {...rest}
      />
    )
  },
)

HHMMInput.displayName = 'HHMMInput'
