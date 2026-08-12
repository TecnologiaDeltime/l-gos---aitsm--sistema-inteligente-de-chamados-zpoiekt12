import { useState, useCallback, useEffect, useMemo } from 'react'
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
import {
  Plus,
  Pencil,
  Trash2,
  MessageCircle,
  Mail,
  Phone,
  Smartphone,
  Building2,
  Star,
} from 'lucide-react'
import {
  getClientContacts,
  deleteClientContact,
  type ClientContactRecord,
} from '@/services/client-contacts'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { getCompanyDepartments, createCompanyAuditLog } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { CollaboratorDialog } from '@/components/clients/CollaboratorDialog'

interface Department {
  id: string
  name: string
}

export function CollaboratorSection({ clientId }: { clientId?: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [branches, setBranches] = useState<CompanyUnitRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClientContactRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [c, d, b] = await Promise.all([
        getClientContacts(clientId),
        getCompanyDepartments(clientId),
        getCompanyUnitsByCompany(clientId),
      ])
      setContacts(c)
      setDepartments(d as unknown as Department[])
      setBranches(b)
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

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {}
    departments.forEach((d) => {
      m[d.id] = d.name
    })
    return m
  }, [departments])

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => {
      m[b.id] = b.name
    })
    return m
  }, [branches])

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return
    try {
      const contact = contacts.find((c) => c.id === deleteId)
      await deleteClientContact(deleteId)
      await createCompanyAuditLog({
        user: user.id,
        action: 'deleted collaborator',
        entity_type: 'client_contacts',
        entity_id: deleteId,
        description: `Colaborador "${contact?.full_name}" excluído`,
        old_values: contact as Record<string, unknown>,
      })
      toast({ title: 'Colaborador excluído com sucesso!' })
    } catch {
      toast({ title: 'Erro ao excluir colaborador', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="text-base font-bold mb-2">Colaboradores</h3>
        <p className="text-sm text-slate-500">
          Salve o cliente primeiro para gerenciar colaboradores.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Colaboradores</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Adicionar Colaborador
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : contacts.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Nenhum colaborador cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-2 rounded-lg border p-3"
            >
              <div className="space-y-1 text-sm">
                <p className="font-semibold flex items-center gap-1">
                  {c.full_name}
                  {c.is_focal_point && <Star className="h-3.5 w-3.5 text-amber-500" />}
                </p>
                {c.email && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </p>
                )}
                {c.cell_phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    {c.cell_phone}
                    {c.has_whatsapp && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-green-600">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {c.unit ? branchMap[c.unit] || '—' : '—'}
                </p>
                {c.departments && c.departments.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {c.departments.map((d) => deptMap[d] || d).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditing(c)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => setDeleteId(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CollaboratorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        departments={departments}
        branches={branches}
        contact={editing}
        onSaved={loadData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Colaborador</AlertDialogTitle>
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
