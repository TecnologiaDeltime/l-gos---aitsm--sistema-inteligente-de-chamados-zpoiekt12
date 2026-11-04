import { useEffect, useState, useMemo } from 'react'
import { ListTree, Plus, Pencil, Power, PowerOff, Trash2, AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { ActivityCatalogDialog } from '@/components/ActivityCatalogDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getActivityCatalog,
  deleteActivitySafely,
  CategoryRecord,
} from '@/services/activity-catalog'
import { updateCategory } from '@/services/categories'
import { getQueues, QueueRecord } from '@/services/queues'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { formatMinutes } from '@/lib/duration'

export default function ActivityCatalog() {
  const { toast } = useToast()
  const { canEdit, canDelete, isAdmin, role, profile } = usePermissions()

  // Permissão para exclusão no Catálogo: Administrador tem acesso total;
  // outros perfis requerem permissão de delete/edit no item tickets_catalogo_delete
  const canDeleteCatalog = useMemo(() => {
    if (isAdmin || role === 'admin') {
      return true
    }
    const profileName = (profile?.name || '').toLowerCase()
    if (profileName.includes('admin') || profileName.includes('gestor')) {
      return true
    }
    return (
      canDelete('tickets.tickets_catalogo_delete') || canEdit('tickets.tickets_catalogo_delete')
    )
  }, [isAdmin, role, profile, canDelete, canEdit])

  const [catalog, setCatalog] = useState<{ main: CategoryRecord[]; sub: CategoryRecord[] }>({
    main: [],
    sub: [],
  })
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRecord | null>(null)
  const [presetParent, setPresetParent] = useState<string>('')

  const queuesById = useMemo(() => {
    const map = new Map<string, QueueRecord>()
    queues.forEach((q) => map.set(q.id, q))
    return map
  }, [queues])

  // Diálogo de confirmação de exclusão
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = () =>
    getActivityCatalog()
      .then(setCatalog)
      .catch(() => {})

  useEffect(() => {
    loadData()
    getQueues()
      .then(setQueues)
      .catch((e) => console.warn('Erro ao carregar filas no catálogo:', e))
  }, [])
  useRealtime('tkt_categories', () => loadData())

  const subByParent = useMemo(() => {
    const map: Record<string, CategoryRecord[]> = {}
    catalog.sub.forEach((s) => {
      const p = s.parent || ''
      if (!map[p]) map[p] = []
      map[p].push(s)
    })
    return map
  }, [catalog.sub])

  const handleEdit = (cat: CategoryRecord) => {
    setEditing(cat)
    setPresetParent('')
    setDialogOpen(true)
  }

  const handleAddSub = (parentId: string) => {
    setEditing(null)
    setPresetParent(parentId)
    setDialogOpen(true)
  }

  const handleAddMain = () => {
    setEditing(null)
    setPresetParent('')
    setDialogOpen(true)
  }

  const handleToggleActive = async (cat: CategoryRecord) => {
    await updateCategory(cat.id, { active: !cat.active })
    toast({ title: cat.active ? 'Atividade desativada' : 'Atividade reativada' })
    loadData()
  }

  const handleRequestDelete = (cat: CategoryRecord) => {
    setCategoryToDelete(cat)
    setConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return
    try {
      setDeleting(true)
      const res = await deleteActivitySafely(categoryToDelete.id)
      if (res.mode === 'soft') {
        toast({
          title: 'Atividade arquivada com sucesso',
          description: `A atividade possui ${res.ticketsCount} chamado(s) vinculados. Ela foi desativada do catálogo para preservar 100% do histórico dos chamados antigos.`,
        })
      } else {
        toast({
          title: 'Atividade excluída com sucesso',
          description:
            'A atividade foi removida permanentemente pois não possuía chamados vinculados.',
        })
      }
      setConfirmDeleteOpen(false)
      setCategoryToDelete(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir atividade',
        description: err?.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Catálogo de Atividades</h2>
          <p className="text-sm text-slate-500">
            Gerencie categorias e subatividades com prioridade ITIL e SLAs (precedência sobre o
            cliente)
          </p>
        </div>
        <Button onClick={handleAddMain} className="bg-blue-600 hover:bg-blue-700" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nova Atividade Principal
        </Button>
      </div>

      <div className="space-y-4">
        {catalog.main.map((main) => (
          <div
            key={main.id}
            className="rounded-xl border bg-white shadow-sm dark:bg-slate-900 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <ListTree className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {main.name}
                  </p>
                  <p className="text-xs text-slate-500">{main.description || 'Sem descrição'}</p>
                </div>
                {main.queue && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-[11px] border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <Users className="h-3 w-3" />
                    {queuesById.get(main.queue)?.name ||
                      main.expand?.queue?.name ||
                      'Equipe vinculada'}
                  </Badge>
                )}
                {!main.active && (
                  <Badge variant="outline" className="text-red-600">
                    Inativo
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddSub(main.id)}
                  title="Adicionar subatividade"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleEdit(main)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleActive(main)}
                  title={main.active ? 'Desativar' : 'Ativar'}
                >
                  {main.active ? (
                    <PowerOff className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Power className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                {canDeleteCatalog && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRequestDelete(main)}
                    title="Excluir atividade principal"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y">
              {(subByParent[main.id] || []).map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 pl-8 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sub.name}
                    </span>
                    {sub.type && (
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {sub.type}
                      </Badge>
                    )}
                    {(sub.queue || main.queue) && (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 text-[10px] border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        title={
                          sub.queue
                            ? 'Equipe responsável específica da subatividade'
                            : 'Equipe responsável herdada da atividade principal'
                        }
                      >
                        <Users className="h-3 w-3" />
                        {sub.queue
                          ? queuesById.get(sub.queue)?.name ||
                            sub.expand?.queue?.name ||
                            'Equipe vinculada'
                          : `${queuesById.get(main.queue || '')?.name || main.expand?.queue?.name || 'Equipe'} (herdada)`}
                      </Badge>
                    )}
                    {!sub.active && (
                      <Badge variant="outline" className="text-red-600">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {sub.impact}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {sub.urgency}
                    </Badge>
                    <PriorityBadge priority={sub.priority || ''} />
                    <span className="text-slate-500">
                      Resp: {formatMinutes(sub.sla_response_minutes)}
                    </span>
                    <span className="text-slate-500">
                      Sol: {formatMinutes(sub.sla_solution_minutes)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(sub)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggleActive(sub)}
                      title={sub.active ? 'Desativar' : 'Ativar'}
                    >
                      {sub.active ? (
                        <PowerOff className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <Power className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </Button>
                    {canDeleteCatalog && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleRequestDelete(sub)}
                        title="Excluir subatividade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!subByParent[main.id] || subByParent[main.id].length === 0) && (
                <p className="p-3 pl-8 text-xs text-slate-400">
                  Nenhuma subatividade. Clique em + para adicionar.
                </p>
              )}
            </div>
          </div>
        ))}
        {catalog.main.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            Nenhuma atividade encontrada. Clique em "Nova Atividade Principal" para começar.
          </p>
        )}
      </div>

      <ActivityCatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadData}
        editingCategory={editing}
        mainCategories={catalog.main}
        presetParent={presetParent}
      />

      {/* Diálogo de Confirmação de Exclusão com proteção de histórico */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Atividade
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              Você tem certeza de que deseja excluir a atividade{' '}
              <strong className="text-foreground">"{categoryToDelete?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-amber-500/10 border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span>🛡️ Preservação de Histórico:</span>
            </p>
            <p>
              Se existirem chamados antigos utilizando esta atividade, o sistema fará a desativação
              segura no catálogo. O nome, tipo e SLA dos chamados já registrados permanecerão 100%
              intactos em relatórios, kanban e telas de detalhes.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir atividade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
