import { useState, useCallback, useEffect } from 'react'
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
import { Plus, Pencil, Trash2, Star, Mail, Phone } from 'lucide-react'
import {
  getFocalPoints,
  createClientContact,
  updateClientContact,
  deleteClientContact,
  type ClientContactRecord,
  type FocalPointData,
} from '@/services/client-contacts'
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
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClientContactRecord | null>(null)
  const [editPendingIdx, setEditPendingIdx] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      setFocalPoints(await getFocalPoints(clientId))
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

  const handleSave = async (data: FocalPointData) => {
    if (!clientId) {
      if (!onPendingFocalPointsChange) return
      const list = pendingFocalPoints || []
      if (editPendingIdx !== null) {
        const next = [...list]
        next[editPendingIdx] = data
        onPendingFocalPointsChange(next)
      } else {
        onPendingFocalPointsChange([...list, data])
      }
      setDialogOpen(false)
      return
    }
    setSaving(true)
    try {
      const payload = { ...data, user: data.user || undefined }
      if (editing) {
        await updateClientContact(editing.id, { ...payload, is_focal_point: true })
      } else {
        await createClientContact({ ...payload, client: clientId, is_focal_point: true })
      }
      toast({ title: 'Ponto focal salvo com sucesso!' })
      setDialogOpen(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar ponto focal', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
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
    onEdit?: () => void,
    onRemove?: () => void,
  ) => (
    <div className="group flex items-center justify-between rounded-md py-1 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60">
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
          initialData={editPendingIdx !== null ? pendingFocalPoints?.[editPendingIdx] : null}
          onSave={handleSave}
          saving={saving}
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
        initialData={
          editing
            ? {
                full_name: editing.full_name,
                email: editing.email || '',
                phone: editing.phone || '',
                cell_phone: editing.cell_phone || '',
                has_whatsapp: editing.has_whatsapp || false,
                user: editing.user || '',
              }
            : null
        }
        onSave={handleSave}
        saving={saving}
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
