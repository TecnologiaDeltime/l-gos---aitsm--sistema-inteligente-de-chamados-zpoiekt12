import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Pencil, Trash2, Star, Mail, Phone, Building2 } from 'lucide-react'
import {
  getFocalPoints,
  deleteClientContact,
  type ClientContactRecord,
  type FocalPointData,
} from '@/services/client-contacts'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { createCompanyAuditLog } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { FocalPointDialog } from '@/components/clients/FocalPointDialog'

interface Props {
  clientId?: string
  pendingFocalPoints?: FocalPointData[]
  onPendingFocalPointsChange?: (fps: FocalPointData[]) => void
}

export function FocalPointSection({
  clientId,
  pendingFocalPoints,
  onPendingFocalPointsChange,
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [focalPoints, setFocalPoints] = useState<ClientContactRecord[]>([])
  const [branches, setBranches] = useState<CompanyUnitRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClientContactRecord | null>(null)
  const [editPendingIdx, setEditPendingIdx] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [fpsRes, branchesRes] = await Promise.allSettled([
        getFocalPoints(clientId),
        getCompanyUnitsByCompany(clientId),
      ])
      if (fpsRes.status === 'fulfilled') setFocalPoints(fpsRes.value)
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('client_contacts', () => loadData(), !!clientId)
  useRealtime('company_units', () => loadData(), !!clientId)

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => {
      m[b.id] = b.name
    })
    return m
  }, [branches])

  const openAdd = () => {
    setEditing(null)
    setEditPendingIdx(null)
    setDialogOpen(true)
  }

  const openEdit = (fp: ClientContactRecord) => {
    setEditing(fp)
    setEditPendingIdx(null)
    setDialogOpen(true)
  }

  const openEditPending = (i: number) => {
    setEditing(null)
    setEditPendingIdx(i)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    loadData()
  }

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return
    try {
      const fp = focalPoints.find((f) => f.id === deleteId)
      await deleteClientContact(deleteId)
      await createCompanyAuditLog({
        user: user.id,
        action: 'deleted focal point',
        entity_type: 'client_contacts',
        entity_id: deleteId,
        description: `Ponto focal "${fp?.full_name}" excluído`,
        old_values: fp as Record<string, unknown>,
      })
      toast({ title: 'Ponto focal excluído!' })
    } catch {
      toast({ title: 'Erro ao excluir ponto focal', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  const renderRow = (
    name: string,
    email?: string,
    phone?: string,
    unitName?: string,
    onEdit?: () => void,
    onRemove?: () => void,
  ) => (
    <div className="group flex items-start justify-between gap-2 rounded-md py-1 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="space-y-0.5 text-sm min-w-0">
        <p className="font-semibold flex items-center gap-1.5 truncate">
          <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{name}</span>
        </p>
        {email && (
          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{email}</span>
          </p>
        )}
        {phone && (
          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{phone}</span>
          </p>
        )}
        <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{unitName || 'Sem filial'}</span>
        </p>
      </div>
      {(onEdit || onRemove) && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 shrink-0">
          {onEdit && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onRemove && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={onRemove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">Pontos Focais</h3>
            {pendingFocalPoints && pendingFocalPoints.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {pendingFocalPoints.length}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar Ponto Focal
          </Button>
        </div>
        {pendingFocalPoints && pendingFocalPoints.length > 0 ? (
          <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-0.5">
            {pendingFocalPoints.map((fp, i) =>
              renderRow(
                fp.full_name,
                fp.email,
                fp.phone,
                fp.unit ? branchMap[fp.unit] : undefined,
                () => openEditPending(i),
                () =>
                  onPendingFocalPointsChange?.(
                    (pendingFocalPoints || []).filter((_, j) => j !== i),
                  ),
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-1">Nenhum ponto focal cadastrado.</p>
        )}
        <FocalPointDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          branches={branches}
          contact={null}
          pendingFocalPoints={pendingFocalPoints}
          onPendingFocalPointsChange={onPendingFocalPointsChange}
          editPendingIdx={editPendingIdx}
          onSaved={handleSaved}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">Pontos Focais</h3>
          {focalPoints.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {focalPoints.length}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar Ponto Focal
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : focalPoints.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-3">Nenhum ponto focal cadastrado.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-0.5">
          {focalPoints.map((fp) =>
            renderRow(
              fp.full_name,
              fp.email,
              fp.phone,
              fp.unit ? branchMap[fp.unit] : undefined,
              () => openEdit(fp),
              () => setDeleteId(fp.id),
            ),
          )}
        </div>
      )}
      <FocalPointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        branches={branches}
        contact={editing}
        onSaved={handleSaved}
      />
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ponto Focal</AlertDialogTitle>
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
