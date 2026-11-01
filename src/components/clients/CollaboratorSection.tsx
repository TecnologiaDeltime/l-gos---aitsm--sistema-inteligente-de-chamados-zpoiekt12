import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  UserCheck,
  Search,
} from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
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
  parent?: string
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
  const [search, setSearch] = useState('')
  const { canEdit, canDelete, canManageClients } = usePermissions()
  const canEditClients = canEdit('clients_cadastro') || canEdit('clients') || canManageClients
  const canDeleteClients = canDelete('clients_cadastro') || canDelete('clients')

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [contactsRes, deptsRes, branchesRes] = await Promise.allSettled([
        getClientContacts(clientId),
        getCompanyDepartments(clientId),
        getCompanyUnitsByCompany(clientId),
      ])
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value)
      if (deptsRes.status === 'fulfilled') setDepartments(deptsRes.value as unknown as Department[])
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

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => (c.full_name || '').toLowerCase().includes(q))
  }, [contacts, search])

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
        old_values: contact as unknown as Record<string, unknown>,
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
      <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
        <h3 className="text-base font-bold mb-2">Colaboradores</h3>
        <p className="text-sm text-slate-500">
          Salve o cliente primeiro para gerenciar colaboradores.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">Colaboradores</h3>
          {contacts.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {contacts.length}
            </Badge>
          )}
        </div>
        {canEditClients && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 h-8"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo Colaborador
          </Button>
        )}{' '}
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : contacts.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-3">Nenhum colaborador cadastrado.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          {filteredContacts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-3">
              Nenhum colaborador encontrado para "{search}".
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-0.5">
              {filteredContacts.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-start justify-between gap-2 rounded-md py-1 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="space-y-0.5 text-sm min-w-0">
                    <p className="font-semibold flex items-center gap-1 truncate">
                      {c.full_name}
                      {c.is_focal_point && <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      {c.user && <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                    </p>
                    {c.email && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </p>
                    )}
                    {c.cell_phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Smartphone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.cell_phone}</span>
                        {c.has_whatsapp && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-green-600 shrink-0">
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.unit ? branchMap[c.unit] || '—' : '—'}</span>
                    </p>
                    {c.departments && c.departments.length > 0 && (
                      <p className="text-xs text-slate-400 truncate">
                        {c.departments.map((d) => deptMap[d] || d).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 shrink-0">
                    {canEditClients && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditing(c)
                          setDialogOpen(true)
                        }}
                        title="Editar colaborador"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {canDeleteClients && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-red-500"
                        onClick={() => setDeleteId(c.id)}
                        title="Excluir colaborador"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
