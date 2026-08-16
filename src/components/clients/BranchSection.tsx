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
import { Plus, Pencil, Trash2, MapPin, Phone, User, Building2 } from 'lucide-react'
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
        old_values: branch as unknown as Record<string, unknown>,
      })
      toast({ title: 'Filial excluída com sucesso!' })
    } catch {
      toast({ title: 'Erro ao excluir filial', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  const buildAddress = (b: CompanyUnitRecord) => {
    const parts: string[] = []
    if (b.address_street) {
      parts.push(`${b.address_street}, ${b.address_number || 'S/N'}`)
    }
    if (b.address_complement) parts.push(b.address_complement)
    if (b.address_neighborhood) parts.push(b.address_neighborhood)
    if (b.address_city) parts.push(`${b.address_city}/${b.address_state || ''}`)
    return parts.join(' - ')
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">Filiais</h3>
          </div>
        </div>
        <p className="text-sm text-slate-500">Salve o cliente primeiro para gerenciar filiais.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">Filiais</h3>
          {branches.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {branches.length}
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
          <Plus className="mr-1 h-4 w-4" /> Adicionar Filial
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : branches.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-3">Nenhuma filial cadastrada.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-0.5">
          {branches.map((b) => {
            const address = buildAddress(b)
            return (
              <div
                key={b.id}
                className="group flex items-start justify-between gap-2 rounded-md py-1 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="space-y-0.5 text-sm min-w-0">
                  <p className="font-semibold flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{b.name}</span>
                  </p>
                  {address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{address}</span>
                    </p>
                  )}
                  {b.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{b.phone}</span>
                    </p>
                  )}
                  {b.manager_name && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{b.manager_name}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditing(b)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-500"
                    onClick={() => setDeleteId(b.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
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
