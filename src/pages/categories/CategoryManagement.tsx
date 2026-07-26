import { useEffect, useState, useMemo } from 'react'
import {
  Tags,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategoryEditDialog } from '@/components/CategoryEditDialog'
import {
  getCategories,
  updateCategory,
  deleteCategory,
  CategoryRecord,
} from '@/services/categories'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function CategoryManagement() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRecord | null>(null)
  const [presetParent, setPresetParent] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deactivateTarget, setDeactivateTarget] = useState<CategoryRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null)

  const loadData = () => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('tkt_categories', () => loadData())

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent), [categories])
  const subByParent = useMemo(() => {
    const map: Record<string, CategoryRecord[]> = {}
    categories
      .filter((c) => c.parent)
      .forEach((s) => {
        const p = s.parent || ''
        if (!map[p]) map[p] = []
        map[p].push(s)
      })
    return map
  }, [categories])

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleEdit = (cat: CategoryRecord) => {
    setEditing(cat)
    setPresetParent('')
    setDialogOpen(true)
  }
  const handleAddSub = (parentId: string) => {
    setEditing(null)
    setPresetParent(parentId)
    setExpanded((prev) => new Set(prev).add(parentId))
    setDialogOpen(true)
  }
  const handleAddMain = () => {
    setEditing(null)
    setPresetParent('')
    setDialogOpen(true)
  }

  const handleToggleActive = (cat: CategoryRecord) => {
    const hasActiveSubs = (subByParent[cat.id] || []).some((s) => s.active !== false)
    if (cat.active && hasActiveSubs) {
      setDeactivateTarget(cat)
      return
    }
    doToggleActive(cat)
  }

  const doToggleActive = async (cat: CategoryRecord) => {
    try {
      await updateCategory(cat.id, { active: !cat.active })
      toast({ title: cat.active ? 'Categoria desativada' : 'Categoria reativada' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = (cat: CategoryRecord) => {
    if ((subByParent[cat.id] || []).length > 0) {
      toast({
        title: 'Não é possível excluir',
        description: 'Remova ou reatribua todas as subcategorias primeiro.',
        variant: 'destructive',
      })
      return
    }
    setDeleteTarget(cat)
  }

  const doDelete = async (cat: CategoryRecord) => {
    try {
      await deleteCategory(cat.id)
      toast({ title: 'Categoria excluída' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Categorias de Chamados</h2>
        <Button onClick={handleAddMain} className="bg-blue-600 hover:bg-blue-700" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      {mainCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Tags className="h-12 w-12 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhuma categoria cadastrada</p>
          <Button onClick={handleAddMain} className="bg-blue-600 hover:bg-blue-700" size="sm">
            <Plus className="mr-1 h-4 w-4" /> Criar primeira categoria
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {mainCategories.map((main) => {
            const subs = subByParent[main.id] || []
            const isExpanded = expanded.has(main.id)
            return (
              <div
                key={main.id}
                className="rounded-xl border bg-white shadow-sm dark:bg-slate-900 overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {subs.length > 0 && (
                      <button
                        onClick={() => toggleExpand(main.id)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600 flex-shrink-0">
                      <Tags className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {main.name}
                        </p>
                        {!main.active && (
                          <Badge variant="outline" className="text-red-600 text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {main.description || 'Sem descrição'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddSub(main.id)}
                      title="Adicionar subcategoria"
                      className="text-xs"
                    >
                      <Plus className="h-4 w-4" /> Subcategoria
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(main)}
                      title="Editar"
                    >
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(main)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                {isExpanded && subs.length > 0 && (
                  <div className="divide-y">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 pl-10 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {sub.name}
                          </span>
                          {!sub.active && (
                            <Badge variant="outline" className="text-red-600 text-[10px]">
                              Inativo
                            </Badge>
                          )}
                          {sub.description && (
                            <span className="text-slate-400 truncate">— {sub.description}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {sub.impact || '-'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {sub.urgency || '-'}
                          </Badge>
                          {sub.priority && <PriorityBadge priority={sub.priority} />}
                          <span className="text-slate-500">
                            Resp: {sub.sla_response_minutes || '-'}min
                          </span>
                          <span className="text-slate-500">
                            Sol: {sub.sla_solution_minutes || '-'}min
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDelete(sub)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isExpanded && subs.length > 0 && (
                  <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30">
                    {subs.length} subcategoria(s) — clique para expandir
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <CategoryEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadData}
        editingCategory={editing}
        allCategories={categories}
        presetParent={presetParent}
      />

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => {
          if (!o) setDeactivateTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desativação</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>
                  A categoria "{deactivateTarget?.name}" possui subcategorias ativas. Desativá-la
                  pode afetar a disponibilidade dessas subcategorias no catálogo. Deseja continuar?
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = deactivateTarget
                setDeactivateTarget(null)
                if (t) doToggleActive(t)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{deleteTarget?.name}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = deleteTarget
                if (t) doDelete(t)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
