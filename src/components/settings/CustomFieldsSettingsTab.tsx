import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  CustomFieldDef,
  CustomFieldType,
  createCustomFieldDef,
  deactivateCustomFieldDef,
  listCustomFieldDefs,
  updateCustomFieldDef,
} from '@/services/custom-fields'
import { ArrowDown, ArrowUp, Info, ListTree, Pencil, Plus, Trash2 } from 'lucide-react'

// Rótulos pt-BR dos tipos — construídos localmente (o serviço só exporta o union).
const CustomFieldTypeLabels: Record<CustomFieldType, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  numero: 'Número',
  data: 'Data',
  selecao: 'Seleção',
  sim_nao: 'Sim/Não',
}

const FIELD_TYPES = Object.keys(CustomFieldTypeLabels) as CustomFieldType[]

const definitionSchema = z
  .object({
    label: z.string().trim().min(2, 'Informe o nome/rótulo do campo (mín. 2 caracteres)'),
    field_type: z.enum(['texto_curto', 'texto_longo', 'numero', 'data', 'selecao', 'sim_nao']),
    select_options_raw: z.string().optional(),
    sort_order: z.coerce.number().int().min(0).max(9999),
    is_active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.field_type !== 'selecao') return
    const options = (value.select_options_raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (options.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['select_options_raw'],
        message: 'Informe ao menos uma opção (uma por linha)',
      })
    }
  })

type DefinitionFormInput = z.input<typeof definitionSchema>
type DefinitionForm = z.output<typeof definitionSchema>

const EMPTY_FORM: DefinitionForm = {
  label: '',
  field_type: 'texto_curto',
  select_options_raw: '',
  sort_order: 0,
  is_active: true,
}

export function CustomFieldsSettingsTab() {
  const { toast } = useToast()
  const [definitions, setDefinitions] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<CustomFieldDef | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDef | null>(null)
  const loadSeq = useRef(0)

  const form = useForm<DefinitionFormInput, unknown, DefinitionForm>({
    resolver: zodResolver(definitionSchema),
    defaultValues: EMPTY_FORM,
  })

  const fieldType = form.watch('field_type')
  const isSelect = fieldType === 'selecao'

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const rows = await listCustomFieldDefs(true)
      if (seq === loadSeq.current) {
        setDefinitions(rows)
      }
    } catch (err) {
      toast({
        title: 'Erro ao carregar campos customizados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.reset({ ...EMPTY_FORM, sort_order: definitions.length })
    setDialogOpen(true)
  }

  const openEdit = (definition: CustomFieldDef) => {
    setEditing(definition)
    form.reset({
      label: definition.name,
      field_type: definition.field_type,
      select_options_raw: (definition.options || []).join('\n'),
      sort_order: definition.sort_order || 0,
      is_active: definition.active !== false,
    })
    setDialogOpen(true)
  }

  const submit = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const payload = {
        name: values.label.trim(),
        field_type: values.field_type,
        options:
          values.field_type === 'selecao'
            ? (values.select_options_raw || '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : [],
        sort_order: values.sort_order,
        active: values.is_active,
      }
      if (editing) {
        await updateCustomFieldDef(editing.id, payload)
        toast({ title: 'Campo customizado atualizado' })
      } else {
        await createCustomFieldDef(payload)
        toast({ title: 'Campo customizado criado' })
      }
      setDialogOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      toast({
        title: editing ? 'Erro ao atualizar campo' : 'Erro ao criar campo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  })

  const toggleActive = async (definition: CustomFieldDef) => {
    const next = definition.active === false
    try {
      await updateCustomFieldDef(definition.id, { active: next })
      setDefinitions((rows) =>
        rows.map((row) => (row.id === definition.id ? { ...row, active: next } : row)),
      )
    } catch (err) {
      toast({
        title: 'Erro ao alterar situação do campo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const move = async (definition: CustomFieldDef, direction: -1 | 1) => {
    const sorted = [...definitions].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const index = sorted.findIndex((row) => row.id === definition.id)
    const target = sorted[index + direction]
    if (!target) return
    try {
      await updateCustomFieldDef(definition.id, { sort_order: target.sort_order || 0 })
      await updateCustomFieldDef(target.id, { sort_order: definition.sort_order || 0 })
      await load()
    } catch (err) {
      toast({
        title: 'Erro ao reordenar campos',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  // "Excluir" = desativar: o campo some da ficha e os valores já gravados
  // nos chamados ficam preservados (o hook nunca apaga a definição).
  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deactivateCustomFieldDef(deleting.id)
      toast({
        title: 'Campo desativado, valores preservados',
        description: `“${deleting.name}” não aparece mais na ficha; os valores já gravados continuam guardados nos chamados.`,
      })
      setDeleting(null)
      await load()
    } catch (err) {
      toast({
        title: 'Erro ao desativar campo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const sorted = [...definitions].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <div className="space-y-6">
      <Card className="itsm-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-amber-500" />
              Campos Customizados da Ficha
            </CardTitle>
            <CardDescription>
              Campos personalizados exibidos na ficha do chamado (texto curto, texto longo, número,
              data, seleção e sim/não). O preenchimento dos valores acompanha a edição do chamado.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openCreate} className="min-h-11 lg:min-h-9">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo campo
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando campos customizados...
            </p>
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum campo customizado definido. Clique em “Novo campo” para criar o primeiro.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((definition, index) => (
                <div
                  key={definition.id}
                  className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {definition.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                      >
                        {CustomFieldTypeLabels[definition.field_type] || definition.field_type}
                      </Badge>
                      {definition.active === false && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    {definition.field_type === 'selecao' && (
                      <p className="text-xs text-muted-foreground">
                        Opções: {(definition.options || []).join(' · ') || '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 lg:h-8 lg:w-8"
                      aria-label="Mover campo para cima"
                      disabled={index === 0}
                      onClick={() => move(definition, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 lg:h-8 lg:w-8"
                      aria-label="Mover campo para baixo"
                      disabled={index === sorted.length - 1}
                      onClick={() => move(definition, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 lg:h-8 lg:w-8"
                      aria-label="Editar campo"
                      onClick={() => openEdit(definition)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 text-destructive lg:h-8 lg:w-8"
                      aria-label="Desativar campo"
                      onClick={() => setDeleting(definition)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="ml-1 flex items-center gap-2">
                      <Switch
                        checked={definition.active !== false}
                        onCheckedChange={() => toggleActive(definition)}
                        aria-label={`Campo ${definition.name} ativo`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar campo customizado' : 'Novo campo customizado'}
            </DialogTitle>
            <DialogDescription>
              O campo aparece na ficha do chamado na ordem definida aqui.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cf-label">Nome / rótulo</Label>
              <Input
                id="cf-label"
                autoComplete="off"
                placeholder="Ex.: Contrato"
                {...form.register('label')}
              />
              {form.formState.errors.label && (
                <p className="text-xs text-destructive">{form.formState.errors.label.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de campo</Label>
                <Select
                  value={form.watch('field_type')}
                  onValueChange={(value) => form.setValue('field_type', value as CustomFieldType)}
                >
                  <SelectTrigger aria-label="Tipo de campo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CustomFieldTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-order">Ordem de exibição</Label>
                <Input
                  id="cf-order"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...form.register('sort_order', { valueAsNumber: true })}
                />
                {form.formState.errors.sort_order && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sort_order.message}
                  </p>
                )}
              </div>
            </div>
            {isSelect && (
              <div className="space-y-2">
                <Label htmlFor="cf-options">Opções (uma por linha)</Label>
                <Textarea
                  id="cf-options"
                  rows={4}
                  placeholder={'Contrato A\nContrato B\nContrato C'}
                  {...form.register('select_options_raw')}
                />
                {form.formState.errors.select_options_raw && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.select_options_raw.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-500" />
                <Label htmlFor="cf-active" className="text-sm">
                  Campo ativo
                </Label>
              </div>
              <Switch
                id="cf-active"
                checked={form.watch('is_active')}
                onCheckedChange={(checked) => form.setValue('is_active', checked)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 lg:min-h-9"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="min-h-11 lg:min-h-9">
                {saving ? 'Salvando...' : 'Salvar campo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar campo customizado?</DialogTitle>
            <DialogDescription>
              O campo “{deleting?.name}” deixará de aparecer na ficha. O campo é desativado e os
              valores já gravados nos chamados ficam preservados — nada é excluído.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 lg:min-h-9"
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 lg:min-h-9"
              onClick={confirmDelete}
            >
              Desativar campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
