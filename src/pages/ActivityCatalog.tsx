import { useEffect, useState, useMemo } from 'react'
import { ListTree, Plus, Pencil, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { ActivityCatalogDialog } from '@/components/ActivityCatalogDialog'
import {
  getActivityCatalog,
  checkSubcategoryHasTickets,
  CategoryRecord,
} from '@/services/activity-catalog'
import { updateCategory } from '@/services/categories'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { formatMinutes } from '@/lib/duration'

export default function ActivityCatalog() {
  const { toast } = useToast()
  const [catalog, setCatalog] = useState<{ main: CategoryRecord[]; sub: CategoryRecord[] }>({
    main: [],
    sub: [],
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRecord | null>(null)
  const [presetParent, setPresetParent] = useState<string>('')

  const loadData = () =>
    getActivityCatalog()
      .then(setCatalog)
      .catch(() => {})

  useEffect(() => {
    loadData()
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

  const handleDelete = async (cat: CategoryRecord) => {
    if (cat.parent) {
      const hasTickets = await checkSubcategoryHasTickets(cat.id)
      if (hasTickets) {
        toast({
          title: 'Não é possível excluir: existem chamados vinculados. Desative a atividade.',
          variant: 'destructive',
        })
        return
      }
    }
    try {
      const pb = (await import('@/lib/pocketbase/client')).default
      await pb.collection('tkt_categories').delete(cat.id)
      toast({ title: 'Atividade excluída' })
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
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
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggleActive(sub)}
                    >
                      {sub.active ? (
                        <PowerOff className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <Power className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </Button>
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
    </div>
  )
}
