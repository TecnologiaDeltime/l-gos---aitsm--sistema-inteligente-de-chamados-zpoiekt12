// Aba Checklists (templates) — CRUD de templates de checklist por cliente/ambiente.
// Visível somente com a permissão laudos_gerenciar.
import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  ChecklistTemplate,
  LaudoAmbientJson,
  companyLabel,
  createTemplate,
  deleteTemplate,
  listAllTemplatesForManage,
  listCompaniesMinimal,
  updateTemplate,
} from '@/services/laudos'

interface DraftAmbient {
  name: string
  items: string[]
}

export default function TemplatesTab() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChecklistTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Formulário do template
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companies, setCompanies] = useState<Array<{ id: string; label: string }>>([])
  const [ambients, setAmbients] = useState<DraftAmbient[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await listAllTemplatesForManage())
    } catch (e) {
      toast({
        title: 'Erro ao carregar checklists',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = async () => {
    setEditing(null)
    setTitle('')
    setDescription('')
    setCompanyId('')
    setAmbients([{ name: '', items: [''] }])
    setDialogOpen(true)
    listCompaniesMinimal()
      .then(setCompanies)
      .catch(() => setCompanies([]))
  }

  const openEdit = async (t: ChecklistTemplate) => {
    setEditing(t)
    setTitle(t.title)
    setDescription(t.description)
    setCompanyId(t.company)
    setAmbients(
      (t.ambients.length ? t.ambients : [{ name: '', items: [''] }]).map((a) => ({
        name: a.name,
        items: a.items.length ? [...a.items] : [''],
      })),
    )
    setDialogOpen(true)
    listCompaniesMinimal()
      .then(setCompanies)
      .catch(() => setCompanies([]))
  }

  const patchAmbient = (idx: number, patch: Partial<DraftAmbient>) =>
    setAmbients((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Informe o nome do checklist', variant: 'destructive' })
      return
    }
    if (!companyId) {
      toast({ title: 'Escolha o cliente do checklist', variant: 'destructive' })
      return
    }
    const cleaned: LaudoAmbientJson[] = ambients
      .map((a) => ({
        name: a.name.trim(),
        items: a.items.map((i) => i.trim()).filter(Boolean),
      }))
      .filter((a) => a.name)
    if (cleaned.length === 0) {
      toast({ title: 'Adicione pelo menos um ambiente', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateTemplate(editing.id, {
          title: title.trim(),
          description: description.trim(),
          company: companyId,
          ambients: cleaned,
          active: editing.active,
        })
        toast({ title: 'Checklist atualizado' })
      } else {
        await createTemplate({
          title: title.trim(),
          description: description.trim(),
          company: companyId,
          ambients: cleaned,
        })
        toast({ title: 'Checklist criado' })
      }
      setDialogOpen(false)
      load()
    } catch (e) {
      toast({
        title: 'Erro ao salvar checklist',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTemplate(deleteTarget.id)
      toast({ title: 'Checklist excluído' })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({
        title: 'Erro ao excluir checklist',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const companyNameOf = (t: ChecklistTemplate) =>
    companyLabel(t.expand?.company) || companies.find((c) => c.id === t.company)?.label || ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Checklists por cliente: definem os ambientes e os itens que o técnico executa no laudo.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo checklist
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nenhum checklist cadastrado</p>
            <p className="text-xs text-muted-foreground">
              Crie um checklist com os ambientes e itens de cada cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    {!t.active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {companyNameOf(t)}
                    {t.description ? ` · ${t.description}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.ambients.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {a.name} ({a.items.length})
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(t)}
                    aria-label={`Editar checklist ${t.title}`}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(t)}
                    aria-label={`Excluir checklist ${t.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo: criar/editar checklist */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar checklist' : 'Novo checklist'}</DialogTitle>
            <DialogDescription>
              Defina os ambientes do cliente e os itens de verificação de cada um.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-title">Nome do checklist *</Label>
                <Input
                  id="tpl-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Ex.: Preventiva mensal — Data center"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-3">
              <Label>Ambientes e itens do checklist</Label>
              {ambients.map((amb, aIdx) => (
                <div key={aIdx} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={amb.name}
                      onChange={(e) => patchAmbient(aIdx, { name: e.target.value })}
                      maxLength={150}
                      placeholder={`Nome do ambiente ${aIdx + 1} (ex.: Sala de servidores)`}
                      aria-label={`Nome do ambiente ${aIdx + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setAmbients((prev) => prev.filter((_, i) => i !== aIdx))}
                      disabled={ambients.length === 1}
                      aria-label={`Remover ambiente ${aIdx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-2">
                    {amb.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2">
                        <Checkbox
                          checked
                          disabled
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none opacity-40"
                        />
                        <Input
                          value={item}
                          onChange={(e) =>
                            patchAmbient(aIdx, {
                              items: amb.items.map((it, i) => (i === iIdx ? e.target.value : it)),
                            })
                          }
                          maxLength={300}
                          placeholder={`Item ${iIdx + 1} do checklist`}
                          aria-label={`Item ${iIdx + 1} do ambiente ${aIdx + 1}`}
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            patchAmbient(aIdx, {
                              items: amb.items.filter((_, i) => i !== iIdx),
                            })
                          }
                          disabled={amb.items.length === 1}
                          aria-label={`Remover item ${iIdx + 1} do ambiente ${aIdx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => patchAmbient(aIdx, { items: [...amb.items, ''] })}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmbients((prev) => [...prev, { name: '', items: [''] }])}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar ambiente
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar alterações' : 'Criar checklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir checklist</DialogTitle>
            <DialogDescription>
              Excluir “{deleteTarget?.title}”? Laudos já criados com ele não são afetados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
