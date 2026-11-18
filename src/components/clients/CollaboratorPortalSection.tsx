import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Pencil, Trash2, UserRound, Loader2, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { CollaboratorPortalDialog } from '@/components/clients/CollaboratorPortalDialog'
import { startImpersonation } from '@/services/collaborator-impersonation'
import {
  getPortalCollaborators,
  deletePortalCollaborator,
  updatePortalCollaborator,
  type PortalCollaboratorRecord,
} from '@/services/portal-collaborators-admin'

/**
 * CRUD dos acessos do Portal do Colaborador (coleção portal_collaborators),
 * exibido dentro da tela do cliente — análogo à gestão de acessos do
 * Portal do Ponto Focal (client_portal_access).
 *
 * Item do catálogo de permissões: clients / clients_collaborator_portal.
 */
export function CollaboratorPortalSection({ clientId }: { clientId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { canView, canEdit, canDelete } = usePermissions()
  const [items, setItems] = useState<PortalCollaboratorRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PortalCollaboratorRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const canImpersonate = canView('clients_collaborator_portal')

  const canManage =
    canEdit('clients_collaborator_portal') || canEdit('clients_cadastro') || canEdit('clients')
  const canRemove =
    canDelete('clients_collaborator_portal') ||
    canDelete('clients_cadastro') ||
    canDelete('clients')

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const list = await getPortalCollaborators(clientId)
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('portal_collaborators', () => loadData(), !!clientId)

  const handleToggleActive = async (rec: PortalCollaboratorRecord, active: boolean) => {
    try {
      await updatePortalCollaborator(rec.id, { active }, user?.id)
      toast({
        title: active ? 'Acesso ativado' : 'Acesso desativado',
        description: active
          ? `${rec.name} já consegue entrar no portal.`
          : `${rec.name} não conseguirá mais entrar no portal.`,
      })
      await loadData()
    } catch {
      toast({ title: 'Erro ao atualizar acesso', variant: 'destructive' })
    }
  }

  const handleImpersonate = async (rec: PortalCollaboratorRecord) => {
    if (!rec.active) return
    setImpersonatingId(rec.id)
    try {
      await startImpersonation(clientId, rec.id, rec.name, rec.email)
      navigate('/portal/colaborador/painel')
    } catch {
      toast({
        title: 'Não foi possível abrir a visão do colaborador',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
      setImpersonatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      await deletePortalCollaborator(deleteId, user?.id)
      toast({ title: 'Acesso do colaborador excluído.' })
      await loadData()
    } catch {
      toast({ title: 'Erro ao excluir acesso', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const deleteTarget = items.find((i) => i.id === deleteId)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Acessos ao Portal do Colaborador
          </h4>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {items.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-slate-300 dark:border-slate-700"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar acesso
          </Button>
        )}
      </div>
      <p className="text-[11px] text-slate-400 -mt-2">
        Credenciais que os colaboradores finais usam para entrar em /portal/colaborador e acompanhar
        os próprios chamados.
      </p>

      {loading ? (
        <Skeleton className="h-12 w-full" />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">
          Nenhum acesso do Portal do Colaborador criado para este cliente.
        </p>
      ) : (
        <div className="space-y-0.5">
          {items.map((r) => (
            <div
              key={r.id}
              className="group flex items-center justify-between gap-2 rounded-md py-1.5 px-2 hover:bg-white dark:hover:bg-slate-800/60"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {r.name}
                  {!r.active && (
                    <span className="text-[10px] font-medium text-slate-400">(inativo)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">{r.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canImpersonate && r.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 gap-1"
                    disabled={impersonatingId === r.id}
                    onClick={() => handleImpersonate(r)}
                    title={`Ver o portal como ${r.name}`}
                  >
                    {impersonatingId === r.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    Ver portal como {r.name.split(' ')[0]}
                  </Button>
                )}
                {canManage && (
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) => handleToggleActive(r, v)}
                    title="Ativar/desativar acesso"
                  />
                )}
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditing(r)
                      setDialogOpen(true)
                    }}
                    title="Editar acesso / redefinir senha"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {canRemove && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-500"
                    onClick={() => setDeleteId(r.id)}
                    title="Excluir acesso"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CollaboratorPortalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={clientId}
        collaborator={editing}
        onSaved={loadData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acesso do portal</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a credencial de <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
              O colaborador perderá imediatamente o acesso ao Portal do Colaborador. Os chamados que
              ele abriu continuam no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
