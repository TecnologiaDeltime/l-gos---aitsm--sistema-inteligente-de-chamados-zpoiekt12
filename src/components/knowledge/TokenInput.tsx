import { useState, KeyboardEvent } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TokenInputProps {
  tokens: string[]
  onChange: (tokens: string[]) => void
  placeholder?: string
}

export function TokenInput({
  tokens,
  onChange,
  placeholder = 'Digite um token (ex: impressora, vpn) e pressione Enter...',
}: TokenInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAddToken = () => {
    const trimmed = inputValue.trim().toLowerCase().replace(/^#/, '')
    if (!trimmed) return

    if (!tokens.includes(trimmed)) {
      onChange([...tokens, trimmed])
    }
    setInputValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddToken()
    } else if (e.key === 'Backspace' && !inputValue && tokens.length > 0) {
      // Remove o último se o input estiver vazio
      onChange(tokens.slice(0, -1))
    }
  }

  const handleRemove = (tokenToRemove: string) => {
    onChange(tokens.filter((t) => t !== tokenToRemove))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-8 text-xs h-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddToken}
          disabled={!inputValue.trim()}
          className="h-9 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {tokens.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tokens.map((token) => (
            <Badge
              key={token}
              variant="secondary"
              className="text-xs px-2.5 py-0.5 flex items-center gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
            >
              <span>#{token}</span>
              <button
                type="button"
                onClick={() => handleRemove(token)}
                className="hover:text-red-500 rounded-full p-0.5 transition-colors"
                title={`Remover token ${token}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Nenhum token adicionado. Tokens permitem associar este artigo a palavras-chave de triagem
          e atividades.
        </p>
      )}
    </div>
  )
}
