import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Pencil, Trash2, Building } from 'lucide-react'
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
import { buildSectorTree, flattenSectorTree } from '@/lib/sector-hierarchy'

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

  const flatSectors = useMemo(() => flattenSectorTree(buildSectorTree(sectors)), [sectors])

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

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
        <h3 className="text-base font-bold">Setores</h3>
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
          <div className="space-y-2">
            {pendingSectors.map((name, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                {editIndex === i ? (
                  <div className="flex gap-2 flex-1">
                    <Input
                      className="h-7 text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLocalEdit(i)}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleLocalEdit(i)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {name}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditIndex(i)
                          setEditValue(name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500"
                        onClick={() => handleLocalRemove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-2">Nenhum setor cadastrado.</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Setores</h3>
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
        <p className="text-sm text-slate-500 text-center py-4">Nenhum setor cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {flatSectors.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border p-3"
              style={{ paddingLeft: `${12 + s.level * 20}px` }}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                {s.level === 0 ? (
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <span className="text-slate-400 text-xs">↳</span>
                )}
                {s.name}
              </span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditing(sectors.find((x) => x.id === s.id) || null)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => setDeleteId(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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
