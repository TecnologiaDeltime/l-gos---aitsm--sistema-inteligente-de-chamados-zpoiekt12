import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, TextCursorInput } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getTicketCustomFieldValues,
  listCustomFieldDefs,
  saveTicketCustomFieldValues,
  type CustomFieldDef,
  type CustomFieldValueMap,
} from '@/services/custom-fields'
import { TicketSheetCard } from '@/components/tickets/TicketSheetCard'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface TicketCustomFieldsCardProps {
  ticketId: string
  /** Quem edita o chamado preenche os campos (mesma permissão do card Categoria). */
  canEdit: boolean
}

/** Formata um valor para exibição somente-leitura. */
function formatValueForDisplay(
  def: CustomFieldDef,
  value: string | number | boolean | null,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (def.field_type === 'sim_nao') return value === true || value === 'true' ? 'Sim' : 'Não'
  if (def.field_type === 'data' && typeof value === 'string' && value) {
    // value vem "YYYY-MM-DD" — exibir dd/mm/aaaa sem depender de fuso
    const [y, m, d] = value.substring(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
  }
  return String(value)
}

/**
 * Card "Campos Customizados" da Ficha do Chamado (coluna direita, após Triagem IA).
 * Só renderiza quando existir ao menos um campo ativo. Campos inativados pelo admin
 * desaparecem da ficha; os valores já gravados permanecem na base (hook desativa, nunca apaga).
 */
export function TicketCustomFieldsCard({ ticketId, canEdit }: TicketCustomFieldsCardProps) {
  const { toast } = useToast()
  const [defs, setDefs] = useState<CustomFieldDef[] | null>(null)
  const [values, setValues] = useState<CustomFieldValueMap>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setDefs(null)
        setError(null)
      }
      try {
        const [defsList, savedValues] = await Promise.all([
          listCustomFieldDefs(),
          getTicketCustomFieldValues(ticketId),
        ])
        const active = defsList.filter((d) => d.active)
        setDefs(active)
        setValues(savedValues)
        setDirty(false)
      } catch (err) {
        console.error('Falha ao carregar campos customizados', err)
        setError('Não foi possível carregar os campos customizados.')
        setDefs([])
      }
    },
    [ticketId],
  )

  useEffect(() => {
    void load()
  }, [load])

  const setValue = (fieldId: string, value: string | number | boolean | null) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await saveTicketCustomFieldValues(ticketId, values)
      setDirty(false)
      toast({ title: 'Campos customizados salvos' })
      // Recarrega para refletir validações do backend (ex.: opção removida da lista)
      const savedValues = await getTicketCustomFieldValues(ticketId)
      setValues(savedValues)
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Falha ao salvar os campos customizados.'
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' })
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (defs === null) {
    return (
      <TicketSheetCard title="Campos Customizados" icon={<Sparkles className="h-3.5 w-3.5" />}>
        <div className="flex min-h-11 items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando campos…
        </div>
      </TicketSheetCard>
    )
  }

  // Sem campos ativos: card não aparece (requisito do produto)
  if (defs.length === 0) {
    return null
  }

  return (
    <TicketSheetCard
      title="Campos Customizados"
      icon={<Sparkles className="h-3.5 w-3.5" />}
      contentClassName="space-y-3"
    >
      {error && <p className="text-xs text-destructive">{error}</p>}

      {defs.map((def) => {
        const value = values[def.id] ?? null
        const id = `custom-field-${def.id}`
        const isFilled = value !== null && value !== undefined && value !== ''

        return (
          <div key={def.id} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {def.name}
            </Label>

            {!canEdit ? (
              <p className="min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {formatValueForDisplay(def, value)}
              </p>
            ) : def.field_type === 'texto_longo' ? (
              <Textarea
                id={id}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => setValue(def.id, e.target.value)}
                rows={3}
                className="min-h-11 text-sm"
              />
            ) : def.field_type === 'numero' ? (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(e) =>
                  setValue(def.id, e.target.value === '' ? null : Number(e.target.value))
                }
                className="h-11 text-sm lg:h-9"
              />
            ) : def.field_type === 'data' ? (
              <Input
                id={id}
                type="date"
                value={typeof value === 'string' ? value.substring(0, 10) : ''}
                onChange={(e) => setValue(def.id, e.target.value || null)}
                className="h-11 text-sm lg:h-9"
              />
            ) : def.field_type === 'sim_nao' ? (
              <div className="flex min-h-11 items-center gap-2 lg:min-h-0">
                <Switch
                  id={id}
                  checked={value === true || value === 'true'}
                  onCheckedChange={(checked) => setValue(def.id, checked)}
                />
                <span className="text-sm">
                  {value === true || value === 'true' ? 'Sim' : 'Não'}
                </span>
              </div>
            ) : def.field_type === 'selecao' ? (
              <Select
                value={typeof value === 'string' && value ? value : ''}
                onValueChange={(v) => setValue(def.id, v || null)}
              >
                <SelectTrigger id={id} className="h-11 lg:h-9">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {def.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                type="text"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => setValue(def.id, e.target.value)}
                className="h-11 text-sm lg:h-9"
              />
            )}

            {canEdit && isFilled && (
              <button
                type="button"
                onClick={() => setValue(def.id, null)}
                className="text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                limpar
              </button>
            )}
          </div>
        )
      })}

      {canEdit && (
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span
            className={cn(
              'flex items-center gap-1 text-[11px]',
              dirty ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
            )}
          >
            {dirty ? (
              <>
                <TextCursorInput className="h-3 w-3" /> alterações não salvas
              </>
            ) : (
              'sincronizado'
            )}
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="min-h-11 lg:min-h-9"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      )}
    </TicketSheetCard>
  )
}
