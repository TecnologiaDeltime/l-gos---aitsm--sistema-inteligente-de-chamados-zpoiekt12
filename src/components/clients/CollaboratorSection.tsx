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
import {
  findEquipmentsByResponsible,
  setEquipmentsAvailableForUser,
  createAssetAutomationLog,
} from '@/services/asset-automation-logs'
import { AlertTriangle, Loader2 } from 'lucide-react'
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
  const [checkingEquipments, setCheckingEquipments] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [associatedEquipments, setAssociatedEquipments] = useState<
    Array<{ id: string; name: string; hostname?: string }>
  >([])
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

  const handleOpenDelete = async (c: ClientContact) => {
    setDeleteId(c.id)
    setCheckingEquipments(true)
    try {
      const eqList = await findEquipmentsByResponsible({
        contactId: c.id,
        id: c.user || undefined,
        name: c.full_name,
      })
      setAssociatedEquipments(eqList)
    } catch {
      setAssociatedEquipments([])
    } finally {
      setCheckingEquipments(false)
    }
  }

  const handleCancelDelete = async () => {
    const contact = contacts.find((c) => c.id === deleteId)
    if (contact && associatedEquipments.length > 0) {
      try {
        await createAssetAutomationLog({
          action_type: 'cancelamento_exclusao_usuario',
          target_user_id: contact.id,
          target_user_name: contact.full_name,
          description: `Exclusão do colaborador "${contact.full_name}" cancelada pelo operador.`,
          details: {
            associated_equipments_count: associatedEquipments.length,
            equipments: associatedEquipments.map((e) => ({ id: e.id, name: e.name })),
          },
        })
      } catch (logErr) {
        console.warn('Erro ao registrar cancelamento:', logErr)
      }
    }
    setDeleteId(null)
    setAssociatedEquipments([])
  }

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return
    const contact = contacts.find((c) => c.id === deleteId)
    try {
      setDeleting(true)

      // Regra 1: se o usuário possui ativo(s), muda automaticamente status para "Disponível" e registra
      if (associatedEquipments.length > 0) {
        await setEquipmentsAvailableForUser(
          associatedEquipments,
          {
            id: deleteId,
            name: contact?.full_name || 'Colaborador',
          },
          user.name || user.email,
        )
      }

      await deleteClientContact(deleteId)

      await createCompanyAuditLog({
        user: user.id,
        action: 'deleted collaborator',
        entity_type: 'client_contacts',
        entity_id: deleteId,
        description: `Colaborador "${contact?.full_name}" excluído`,
        old_values: contact as unknown as Record<string, unknown>,
      })

      await createAssetAutomationLog({
        action_type: 'exclusao_usuario',
        target_user_id: deleteId,
        target_user_name: contact?.full_name || 'Colaborador',
        description: `Cadastro do colaborador/usuário responsável "${contact?.full_name}" excluído do Sistema. ${
          associatedEquipments.length > 0
            ? `${associatedEquipments.length} equipamento(s) vinculado(s) alterado(s) para "Disponível".`
            : 'Nenhum equipamento estava vinculado.'
        }`,
        details: {
          client_id: clientId,
          associated_equipments: associatedEquipments,
        },
      })

      toast({
        title: 'Colaborador excluído com sucesso!',
        description:
          associatedEquipments.length > 0
            ? `${associatedEquipments.length} equipamento(s) tiveram o status alterado para Disponível.`
            : undefined,
      })
      await loadData()
    } catch {
      toast({ title: 'Erro ao excluir colaborador', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteId(null)
      setAssociatedEquipments([])
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
                        onClick={() => handleOpenDelete(c)}
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && handleCancelDelete()}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-foreground">
              {checkingEquipments ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verificando ativos vinculados ao colaborador...
                </div>
              ) : associatedEquipments.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                    <p className="font-semibold text-sm">
                      Atenção: este usuário possui ativo(s) cadastrado(s) em seu nome!
                    </p>
                    <p>
                      O colaborador{' '}
                      <strong>{contacts.find((c) => c.id === deleteId)?.full_name}</strong> é
                      responsável por <strong>{associatedEquipments.length} equipamento(s)</strong>.
                    </p>
                    <p className="font-medium">
                      Assim que a exclusão for confirmada, o status do(s) equipamento(s) ficará como{' '}
                      <strong>Disponível</strong>.
                    </p>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1 border rounded p-2 bg-muted/40 text-xs">
                    {associatedEquipments.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex justify-between items-center text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">{eq.name}</span>
                        <span className="font-mono text-[11px]">
                          {eq.hostname || 'Sem hostname'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="font-semibold text-sm">Deseja realmente excluir?</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="text-sm text-foreground">
                    Tem certeza que deseja excluir o colaborador{' '}
                    <strong>{contacts.find((c) => c.id === deleteId)?.full_name}</strong>?
                  </p>
                  <p>
                    Esta ação removerá o colaborador do cliente. Nenhum equipamento está vinculado
                    em seu nome.
                  </p>
                  <p className="font-semibold text-sm text-foreground pt-1">
                    Deseja realmente excluir?
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={deleting}
              onClick={handleCancelDelete}
              className="border-border hover:bg-muted font-medium"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || checkingEquipments}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
