import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { Plus, Pencil, Trash2, MapPin, Phone, User } from 'lucide-react'
import {
  getCompanyUnitsByCompany,
  deleteCompanyUnit,
  type CompanyUnitRecord,
} from '@/services/company-units'
import { createCompanyAuditLog } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { BranchDialog } from '@/components/clients/BranchDialog'

export function BranchSection({ clientId }: { clientId?: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [branches, setBranches] = useState<CompanyUnitRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyUnitRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      setBranches(await getCompanyUnitsByCompany(clientId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('company_units', () => loadData(), !!clientId)

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return
    try {
      const branch = branches.find((b) => b.id === deleteId)
      await deleteCompanyUnit(deleteId)
      await createCompanyAuditLog({
        user: user.id,
        action: 'deleted branch',
        entity_type: 'company_units',
        entity_id: deleteId,
        description: `Filial "${branch?.name}" excluída`,
        old_values: branch as Record<string, unknown>,
      })
      toast({ title: 'Filial excluída com sucesso!' })
    } catch {
      toast({ title: 'Erro ao excluir filial', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="text-base font-bold mb-2">Filiais</h3>
        <p className="text-sm text-slate-500">Salve o cliente primeiro para gerenciar filiais.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Filiais</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Adicionar Filial
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : branches.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Nenhuma filial cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-start justify-between gap-2 rounded-lg border p-3"
            >
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{b.name}</p>
                {b.address_street && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {`${b.address_street}, ${b.address_number || 'S/N'}`}
                    {b.address_neighborhood && ` - ${b.address_neighborhood}`}
                    {b.address_city && ` - ${b.address_city}/${b.address_state || ''}`}
                  </p>
                )}
                {b.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {b.phone}
                  </p>
                )}
                {b.manager_name && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {b.manager_name}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditing(b)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => setDeleteId(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BranchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        branch={editing}
        onSaved={loadData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Filial</AlertDialogTitle>
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
