import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Building, ChevronRight, Building2, Search } from 'lucide-react'
import {
  getCompanyDepartments,
  deleteCompanyDepartment,
  createCompanyAuditLog,
  type CompanyDepartmentRecord,
} from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { SectorDialog } from '@/components/clients/SectorDialog'
import { buildSectorTree, type SectorNode } from '@/lib/sector-hierarchy'

interface Props {
  clientId?: string
  pendingSectors?: string[]
  onPendingSectorsChange?: (sectors: string[]) => void
}

export function SectorSection({ clientId, pendingSectors, onPendingSectorsChange }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sectors, setSectors] = useState<CompanyDepartmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyDepartmentRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      setSectors(await getCompanyDepartments(clientId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('company_departments', () => loadData(), !!clientId)

  const rawTree = useMemo(() => buildSectorTree(sectors), [sectors])

  // Filter tree by name (case-insensitive). A parent is kept if it matches or
  // any of its descendants match; matching descendants force-expand parents.
  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawTree

    const filterNodes = (nodes: SectorNode[]): SectorNode[] => {
      const result: SectorNode[] = []
      for (const node of nodes) {
        const selfMatch = node.name.toLowerCase().includes(q)
        const filteredChildren = filterNodes(node.children)
        if (selfMatch || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: selfMatch ? node.children : filteredChildren,
          })
        }
      }
      return result
    }

    return filterNodes(rawTree)
  }, [rawTree, search])

  // When searching, force-expand every collapsible parent so matches are visible.
  const forceExpand = search.trim().length > 0

  const handleLocalAdd = () => {
    const name = input.trim()
    if (!name || !onPendingSectorsChange) return
    onPendingSectorsChange([...(pendingSectors || []), name])
    setInput('')
  }

  const handleLocalEdit = (index: number) => {
    const name = editValue.trim()
    if (!name || !onPendingSectorsChange || editIndex === null) return
    const newList = [...(pendingSectors || [])]
    newList[index] = name
    onPendingSectorsChange(newList)
    setEditIndex(null)
  }

  const handleLocalRemove = (index: number) => {
    if (!onPendingSectorsChange) return
    onPendingSectorsChange((pendingSectors || []).filter((_, i) => i !== index))
  }

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return
    try {
      const dept = sectors.find((s) => s.id === deleteId)
      await deleteCompanyDepartment(deleteId)
      await createCompanyAuditLog({
        user: user.id,
        action: 'deleted sector',
        entity_type: 'company_departments',
        entity_id: deleteId,
        description: `Setor "${dept?.name}" excluído`,
        old_values: dept as Record<string, unknown>,
      })
      toast({ title: 'Setor excluído com sucesso!' })
    } catch {
      toast({ title: 'Erro ao excluir setor', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  // ---- Local (unsaved) mode: pending sectors as compact chips ----
  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">Setores</h3>
            {pendingSectors && pendingSectors.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {pendingSectors.length}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nome do setor"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLocalAdd())}
            className="h-9 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleLocalAdd} disabled={!input.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {pendingSectors && pendingSectors.length > 0 ? (
          <div className="max-h-48 overflow-y-auto pr-1 -mr-1">
            <div className="flex flex-wrap gap-1.5">
              {pendingSectors.map((name, i) =>
                editIndex === i ? (
                  <div key={i} className="flex gap-1.5 items-center">
                    <Input
                      className="h-7 w-40 text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLocalEdit(i)}
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2" onClick={() => handleLocalEdit(i)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="group inline-flex items-center gap-1 rounded-md border bg-slate-50 dark:bg-slate-800 py-1 pl-2 pr-1 text-sm"
                  >
                    <Building className="h-3 w-3 text-slate-400" />
                    <span className="font-medium">{name}</span>
                    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditIndex(i)
                          setEditValue(name)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-red-500"
                        onClick={() => handleLocalRemove(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-1">Nenhum setor cadastrado.</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">Setores</h3>
          {sectors.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {sectors.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Adicionar Setor
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : sectors.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-3">Nenhum setor cadastrado.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar setor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          {tree.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-3">
              Nenhum setor encontrado para "{search}".
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-0.5">
              {tree.map((node) => (
                <SectorTreeItem
                  key={node.id}
                  node={node}
                  level={0}
                  sectors={sectors}
                  forceExpand={forceExpand}
                  onEdit={(s) => {
                    setEditing(s)
                    setDialogOpen(true)
                  }}
                  onDelete={(id) => setDeleteId(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        sectors={sectors}
        sector={editing}
        onSaved={loadData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TreeItemProps {
  node: SectorNode
  level: number
  sectors: CompanyDepartmentRecord[]
  forceExpand?: boolean
  onEdit: (s: CompanyDepartmentRecord) => void
  onDelete: (id: string) => void
}

function SectorTreeItem({ node, level, sectors, forceExpand, onEdit, onDelete }: TreeItemProps) {
  const [userOpen, setUserOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const record = sectors.find((x) => x.id === node.id) || null
  const open = forceExpand ? true : userOpen

  const indent = { paddingLeft: `${8 + level * 16}px` }

  const actions = (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          if (record) onEdit(record)
        }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-red-500"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(node.id)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )

  if (!hasChildren) {
    return (
      <div
        style={indent}
        className="group flex items-center justify-between rounded-md py-1 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium truncate">
          <Building className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{node.name}</span>
        </span>
        {actions}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <div
        style={indent}
        className="group flex items-center justify-between rounded-md py-1 pl-1 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-semibold truncate text-left flex-1 min-w-0 py-0.5"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                open ? 'rotate-90' : ''
              }`}
            />
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{node.name}</span>
            <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal shrink-0">
              {node.children.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        {actions}
      </div>
      <CollapsibleContent>
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <SectorTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              sectors={sectors}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
