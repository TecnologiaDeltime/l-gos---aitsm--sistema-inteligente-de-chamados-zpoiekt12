// Página Laudos Fotográficos — abas "Laudos" (lista + criação + execução) e
// "Checklists" (templates, só com laudos_gerenciar).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateOnly } from '@/lib/date-format'
import {
  ChecklistTemplate,
  Laudo,
  LaudoAmbiente,
  LAUDO_STATUS_LABELS,
  companyLabel,
  createAmbientesFromTemplate,
  createLaudo,
  deleteLaudo,
  laudoOverallProgress,
  listAmbientes,
  listCompaniesMinimal,
  listLaudos,
  listTemplates,
} from '@/services/laudos'
import { useAuth } from '@/hooks/use-auth'
import LaudoExecution from './LaudoExecution'
import TemplatesTab from './TemplatesTab'

const statusVariant = (s: string): 'default' | 'secondary' | 'outline' =>
  s === 'concluido' ? 'default' : s === 'em_andamento' ? 'secondary' : 'outline'

function NewLaudoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (id: string) => void
}) {
  const { toast } = useToast()
  const { model } = useAuth() as { model?: { id?: string } | null }
  const modelId = model?.id || ''
  const [companies, setCompanies] = useState<Array<{ id: string; label: string }>>([])
  const [companyId, setCompanyId] = useState('')
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCompanyId('')
    setTemplateId('')
    setVisitDate(new Date().toISOString().slice(0, 10))
    listCompaniesMinimal()
      .then(setCompanies)
      .catch(() => setCompanies([]))
  }, [open])

  useEffect(() => {
    if (!open || !companyId) {
      setTemplates([])
      setTemplateId('')
      return
    }
    listTemplates(companyId)
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [open, companyId])

  const handleCreate = async () => {
    if (!companyId || !templateId) {
      toast({ title: 'Escolha o cliente e o checklist', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const template = templates.find((t) => t.id === templateId) || null
      const created = await createLaudo({
        title: `Laudo — ${companies.find((c) => c.id === companyId)?.label || 'Cliente'} — ${visitDate.split('-').reverse().join('/')}`,
        description: template?.description || '',
        company: companyId,
        technician: modelId,
        template: templateId,
        visit_date: visitDate,
      })
      await createAmbientesFromTemplate(created.id, template, [])
      toast({ title: 'Laudo criado', description: 'Preencha os ambientes e anexe as fotos.' })
      onOpenChange(false)
      onCreated(created.id)
    } catch (e) {
      toast({
        title: 'Erro ao criar laudo',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo laudo fotográfico</DialogTitle>
          <DialogDescription>
            Escolha o cliente, o checklist e a data da visita. Os ambientes são criados a partir do
            checklist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="space-y-1.5">
            <Label>Checklist *</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={!companyId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={companyId ? 'Selecione o checklist' : 'Escolha o cliente primeiro'}
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companyId && templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Este cliente ainda não tem checklist — crie um na aba Checklists.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="laudo-visit-date">Data da visita *</Label>
            <Input
              id="laudo-visit-date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar laudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function LaudosPage() {
  const { toast } = useToast()
  const { canAccessItem } = usePermissions()
  const canManage = canAccessItem('laudos_gerenciar')
  const [laudos, setLaudos] = useState<Laudo[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLaudos(await listLaudos())
    } catch (e) {
      toast({
        title: 'Erro ao carregar laudos',
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

  const [ambientsProgress, setAmbientsProgress] = useState<
    Map<string, { done: number; total: number }>
  >(() => new Map())

  useEffect(() => {
    let cancelled = false
    // Progresso de ambientes por laudo — busca em lote os ambientes de cada laudo aberto.
    const fetchProgress = async () => {
      const entries = await Promise.all(
        laudos.map(async (l) => {
          try {
            const amb = await listAmbientes(l.id)
            return [l.id, laudoOverallProgress(amb)] as const
          } catch {
            return [l.id, { done: 0, total: 0 }] as const
          }
        }),
      )
      if (!cancelled) setAmbientsProgress(new Map(entries))
    }
    if (laudos.length) fetchProgress()
    return () => {
      cancelled = true
    }
  }, [laudos])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteLaudo(id)
      toast({ title: 'Laudo excluído' })
      setLaudos((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      toast({
        title: 'Erro ao excluir laudo',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const stats = useMemo(() => {
    const done = laudos.filter((l) => l.status === 'concluido').length
    return { total: laudos.length, done, pending: laudos.length - done }
  }, [laudos])

  if (openId) {
    const fallback = laudos.find((l) => l.id === openId) || null
    return <LaudoExecution laudoId={openId} fallback={fallback} onBack={() => setOpenId(null)} />
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Camera className="h-5 w-5" /> Laudos Fotográficos
          </h1>
          <p className="text-xs text-muted-foreground">
            Registro fotográfico de visitas preventivas com checklist por ambiente e assinatura de
            quem acompanhou.
          </p>
        </div>
      </div>

      <Tabs defaultValue="laudos">
        <TabsList>
          <TabsTrigger value="laudos">Laudos ({stats.pending} em aberto)</TabsTrigger>
          {canManage && <TabsTrigger value="templates">Checklists</TabsTrigger>}
        </TabsList>

        <TabsContent value="laudos" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {stats.total} laudo(s) · {stats.done} concluído(s)
            </p>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo laudo
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : laudos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Camera className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nenhum laudo ainda</p>
                <p className="text-xs text-muted-foreground">
                  Crie um laudo a partir do checklist do cliente e registre as fotos da visita.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {laudos.map((l) => {
                const p = ambientsProgress.get(l.id) || { done: 0, total: 0 }
                const pct = p.total > 0 ? (p.done / p.total) * 100 : 0
                return (
                  <Card key={l.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenId(l.id)}
                              className="truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            >
                              {l.title}
                            </button>
                            <Badge variant={statusVariant(l.status)}>
                              {LAUDO_STATUS_LABELS[l.status] || l.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {companyLabel(l.expand?.company)} · Visita{' '}
                            {formatDateOnly(l.visit_date)} ·{' '}
                            {l.expand?.technician?.name || 'Técnico —'} · {p.done}/{p.total} itens
                          </p>
                          <div className="mt-1.5 max-w-xs">
                            <Progress value={pct} className="h-1.5" aria-hidden="true" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setOpenId(l.id)}>
                            Abrir
                          </Button>
                          {l.status !== 'concluido' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(l.id)}
                              disabled={deletingId === l.id}
                              aria-label={`Excluir laudo ${l.title}`}
                            >
                              {deletingId === l.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="templates" className="pt-3">
            <TemplatesTab />
          </TabsContent>
        )}
      </Tabs>

      <NewLaudoDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          setOpenId(id)
          load()
        }}
      />
    </div>
  )
}
