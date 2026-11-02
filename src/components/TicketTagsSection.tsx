import { useState, useEffect } from 'react'
import { Tag, Sparkles, Plus, X, Check, RotateCw, Loader2, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { aiTicketReplyService } from '@/services/ai-ticket-reply'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface TicketTagsSectionProps {
  ticketId: string
  currentTagsString?: string
  canEdit: boolean
  canUseAiTags: boolean
  onUpdateTags: (newTagsString: string) => Promise<void>
}

export function TicketTagsSection({
  ticketId,
  currentTagsString = '',
  canEdit,
  canUseAiTags,
  onUpdateTags,
}: TicketTagsSectionProps) {
  const { toast } = useToast()
  const [tags, setTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [savingTag, setSavingTag] = useState(false)
  const [aiEnabledInSettings, setAiEnabledInSettings] = useState(true)

  // Sincronizar tags atuais
  useEffect(() => {
    if (!currentTagsString) {
      setTags([])
      return
    }
    const parsed = currentTagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    setTags(parsed)
  }, [currentTagsString])

  // Verificar se sugestão de tags está habilitada nas configurações de IA
  useEffect(() => {
    if (!canUseAiTags) return
    let active = true
    aiTicketReplyService
      .getSettings()
      .then((s) => {
        if (active) {
          setAiEnabledInSettings(Boolean(s.enabled && (s.tag_suggestions_enabled ?? true)))
        }
      })
      .catch(() => {
        if (active) {
          setAiEnabledInSettings(true)
        }
      })
    return () => {
      active = false
    }
  }, [canUseAiTags])

  const handleAddCustomTag = async () => {
    const clean = newTagInput.trim().toLowerCase().replace(/,/g, '')
    if (!clean) return
    if (tags.some((t) => t.toLowerCase() === clean)) {
      toast({ title: 'Esta tag já foi adicionada ao chamado.' })
      setNewTagInput('')
      return
    }

    const nextTags = [...tags, clean]
    setSavingTag(true)
    try {
      await onUpdateTags(nextTags.join(', '))
      setTags(nextTags)
      setNewTagInput('')
      // Se estava nas sugestões, remove dela
      setSuggestedTags((prev) => prev.filter((st) => st.toLowerCase() !== clean))
      toast({ title: `Tag "${clean}" adicionada com sucesso!` })
    } catch (err) {
      toast({
        title: 'Erro ao salvar tag',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingTag(false)
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!canEdit) return
    const nextTags = tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase())
    setSavingTag(true)
    try {
      await onUpdateTags(nextTags.join(', '))
      setTags(nextTags)
      toast({ title: `Tag "${tagToRemove}" removida.` })
    } catch (err) {
      toast({
        title: 'Erro ao remover tag',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingTag(false)
    }
  }

  const handleFetchAiSuggestions = async () => {
    if (!ticketId || !canUseAiTags) return
    setLoadingSuggestions(true)
    try {
      const res = await aiTicketReplyService.generateTags(ticketId)
      // Filtrar sugestões que já estejam nas tags atuais
      const currentLower = new Set(tags.map((t) => t.toLowerCase()))
      const filtered = (res.suggestedTags || []).filter((st) => !currentLower.has(st.toLowerCase()))
      setSuggestedTags(filtered)
      if (filtered.length > 0) {
        toast({
          title: 'Tags sugeridas pela IA!',
          description: `${filtered.length} nova(s) tag(s) identificada(s) para este chamado.`,
        })
      } else {
        toast({
          title: 'Nenhuma tag adicional sugerida',
          description: 'Todas as tags identificadas já foram aplicadas ao chamado.',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro ao sugerir tags com IA',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleAcceptSuggestedTag = async (suggested: string) => {
    if (!canEdit) return
    const clean = suggested.trim().toLowerCase()
    if (tags.some((t) => t.toLowerCase() === clean)) {
      setSuggestedTags((prev) => prev.filter((st) => st.toLowerCase() !== clean))
      return
    }

    const nextTags = [...tags, clean]
    setSavingTag(true)
    try {
      await onUpdateTags(nextTags.join(', '))
      setTags(nextTags)
      setSuggestedTags((prev) => prev.filter((st) => st.toLowerCase() !== clean))
      toast({ title: `Tag sugerida "${clean}" adicionada!` })
    } catch (err) {
      toast({
        title: 'Erro ao adicionar tag sugerida',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingTag(false)
    }
  }

  const handleAcceptAllSuggestions = async () => {
    if (!canEdit || suggestedTags.length === 0) return
    const currentLower = new Set(tags.map((t) => t.toLowerCase()))
    const toAdd = suggestedTags.filter((st) => !currentLower.has(st.toLowerCase()))
    if (toAdd.length === 0) {
      setSuggestedTags([])
      return
    }

    const nextTags = [...tags, ...toAdd]
    setSavingTag(true)
    try {
      await onUpdateTags(nextTags.join(', '))
      setTags(nextTags)
      setSuggestedTags([])
      toast({ title: `${toAdd.length} tags adicionadas ao chamado!` })
    } catch (err) {
      toast({
        title: 'Erro ao adicionar todas as tags',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingTag(false)
    }
  }

  return (
    <div className="itsm-card p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Tags do Chamado</h3>
          {tags.length > 0 && (
            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
              {tags.length}
            </Badge>
          )}
        </div>

        {canUseAiTags && aiEnabledInSettings && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleFetchAiSuggestions}
            disabled={loadingSuggestions || savingTag}
            className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
            title="Analisar chamado e sugerir tags com IA"
          >
            {loadingSuggestions ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
                Sugerir com IA
              </>
            )}
          </Button>
        )}
      </div>

      {/* Lista de tags ativas do chamado */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {tags.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            Nenhuma tag vinculada a este chamado.
          </span>
        ) : (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-secondary/80 border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              #{tag}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={savingTag}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                  title={`Remover tag #${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Input manual de tag */}
      {canEdit && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustomTag()
              }
            }}
            placeholder="Nova tag..."
            className="h-7 text-xs bg-background"
            disabled={savingTag}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddCustomTag}
            disabled={!newTagInput.trim() || savingTag}
            className="h-7 px-2 text-xs shrink-0"
            title="Adicionar tag"
          >
            <Plus className="h-3.5 w-3.5 mr-0.5" />
            Adicionar
          </Button>
        </div>
      )}

      {/* Bloco de Tags Sugeridas pela IA */}
      {canUseAiTags && aiEnabledInSettings && suggestedTags.length > 0 && (
        <div className="pt-2 border-t border-amber-500/20 rounded-lg p-2.5 bg-amber-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-primary uppercase font-mono flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Tags sugeridas pela IA ({suggestedTags.length}):
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAcceptAllSuggestions}
                disabled={savingTag}
                className="h-6 px-1.5 text-[10px] text-amber-600 dark:text-amber-400 hover:text-primary font-medium"
                title="Aceitar todas as tags sugeridas"
              >
                <CheckCheck className="h-3 w-3 mr-0.5" />
                Aceitar todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSuggestedTags([])}
                className="h-6 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                title="Ignorar sugestões"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {suggestedTags.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleAcceptSuggestedTag(st)}
                disabled={savingTag || !canEdit}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer group shadow-2xs"
                title={`Clique para aceitar a tag #${st}`}
              >
                <span>+{st}</span>
                <Check className="h-3 w-3 opacity-60 group-hover:opacity-100 text-amber-600 dark:text-amber-400" />
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Clique em cada tag sugerida para adicioná-la ao chamado, ou clique em "Aceitar todas".
          </p>
        </div>
      )}
    </div>
  )
}
