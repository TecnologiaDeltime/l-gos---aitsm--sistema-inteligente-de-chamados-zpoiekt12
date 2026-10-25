import { useEffect, useState, useMemo } from 'react'
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { ProfileDialog } from '@/components/profiles/ProfileDialog'
import { getProfiles, createProfile, updateProfile, deleteProfile } from '@/services/profiles'
import { getOperators } from '@/services/operators'
import { ProfileRecord, SYSTEM_MODULES, ModuleKey } from '@/types/profiles'
import { useRealtime } from '@/hooks/use-realtime'

export default function ProfilesPage() {
  const { toast } = useToast()
  const permissions = usePermissions()
  const canManage = permissions.canManageProfiles

  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [operatorCounts, setOperatorCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ProfileRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProfileRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [pList, ops] = await Promise.all([getProfiles(), getOperators()])
      setProfiles(pList)

      // Calculate number of operators per profile
      const counts: Record<string, number> = {}
      ops.forEach((op) => {
        if (op.profile_id) {
          counts[op.profile_id] = (counts[op.profile_id] || 0) + 1
        }
      })
      setOperatorCounts(counts)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar perfis',
        description: err?.message || 'Não foi possível carregar os perfis de acesso.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Realtime subscription resiliente na coleção profiles
  useRealtime('profiles', () => {
    getProfiles()
      .then(setProfiles)
      .catch(() => {})
  })

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles
    const q = search.toLowerCase().trim()
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    )
  }, [profiles, search])

  const handleSaveProfile = async (data: {
    name: string
    description: string
    permissions: any
  }) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, data)
      toast({
        title: 'Perfil atualizado com sucesso!',
        description: `O perfil "${data.name}" foi atualizado.`,
      })
    } else {
      await createProfile({
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        is_system: false,
      })
      toast({
        title: 'Perfil criado com sucesso!',
        description: `O perfil "${data.name}" foi cadastrado no sistema.`,
      })
    }
    await loadData()
  }

  const handleDeleteProfile = async () => {
    if (!deleteTarget) return
    if (deleteTarget.is_system) {
      toast({
        title: 'Ação não permitida',
        description: 'O perfil de Administrador é protegido pelo sistema e não pode ser excluído.',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      return
    }

    try {
      setDeleting(true)
      await deleteProfile(deleteTarget.id)
      toast({
        title: 'Perfil excluído',
        description: `O perfil "${deleteTarget.name}" foi removido.`,
      })
      setDeleteTarget(null)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir perfil',
        description: err?.message || 'Não foi possível excluir o perfil.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const getPermissionSummary = (p: ProfileRecord) => {
    if (p.is_system)
      return { readCount: SYSTEM_MODULES.length, writeCount: SYSTEM_MODULES.length, hiddenCount: 0 }
    let readCount = 0
    let writeCount = 0
    let hiddenCount = 0

    SYSTEM_MODULES.forEach((m) => {
      const perm = p.permissions?.[m.key]
      if (perm?.hidden) {
        hiddenCount++
      } else {
        if (perm?.read) readCount++
        if (perm?.write) writeCount++
      }
    })

    return { readCount, writeCount, hiddenCount }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Perfis de Acesso
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gerencie perfis e configure permissões de leitura, escrita e visibilidade por módulo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 hover:border-primary/40"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            Atualizar
          </Button>

          {canManage && (
            <Button
              onClick={() => {
                setEditingProfile(null)
                setDialogOpen(true)
              }}
              className="bg-primary hover:brightness-110 text-primary-foreground font-semibold h-9 shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Perfil
            </Button>
          )}
        </div>
      </div>

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar perfil por nome ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Total: <strong>{profiles.length}</strong> perfis cadastrados
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Nenhum perfil encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search
                ? 'Nenhum perfil corresponde aos termos da busca digitada.'
                : 'Cadastre o primeiro perfil de acesso para conceder privilégios aos operadores.'}
            </p>
          </div>
          {canManage && !search && (
            <Button
              onClick={() => {
                setEditingProfile(null)
                setDialogOpen(true)
              }}
              size="sm"
              className="bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar Perfil
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Perfil</TableHead>
                  <TableHead className="font-semibold text-xs">Descrição</TableHead>
                  <TableHead className="font-semibold text-xs">Operadores</TableHead>
                  <TableHead className="font-semibold text-xs">Permissões dos Módulos</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const summary = getPermissionSummary(p)
                  const opCount = operatorCounts[p.id] || 0

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-lg ${
                              p.is_system
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {p.is_system ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {p.name}
                              </span>
                              {p.is_system && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200"
                                >
                                  Sistema
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {p.description || '—'}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{opCount}</span>
                          <span className="text-muted-foreground">
                            {opCount === 1 ? 'operador' : 'operadores'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            {summary.writeCount} escrita
                          </Badge>

                          <Badge
                            variant="outline"
                            className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900"
                          >
                            <Eye className="h-3 w-3 mr-1 text-blue-600" />
                            {summary.readCount} leitura
                          </Badge>

                          {summary.hiddenCount > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"
                            >
                              <EyeOff className="h-3 w-3 mr-1 text-red-600" />
                              {summary.hiddenCount} oculto
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Visualizar / Editar Permissões"
                            onClick={() => {
                              setEditingProfile(p)
                              setDialogOpen(true)
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          {!p.is_system && canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                              title="Excluir Perfil"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredProfiles.map((p) => {
              const summary = getPermissionSummary(p)
              const opCount = operatorCounts[p.id] || 0

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-lg ${
                          p.is_system
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {p.is_system ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground">{p.name}</h3>
                          {p.is_system && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-amber-100 text-amber-800 border-amber-200"
                            >
                              Sistema
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.description || 'Sem descrição'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      {summary.writeCount} escrita
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {summary.readCount} leitura
                    </Badge>
                    {summary.hiddenCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-red-50 text-red-700 border-red-200"
                      >
                        {summary.hiddenCount} oculto
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                      <Users className="h-3 w-3" /> {opCount} op.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        setEditingProfile(p)
                        setDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      {p.is_system ? 'Visualizar' : 'Editar'}
                    </Button>

                    {!p.is_system && canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Dialog for create/edit */}
      <ProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editingProfile}
        onSave={handleSaveProfile}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Perfil
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p>
                Tem certeza que deseja excluir o perfil <strong>{deleteTarget?.name}</strong>?
              </p>
              {operatorCounts[deleteTarget?.id || ''] > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                  Atenção: Existem <strong>{operatorCounts[deleteTarget?.id || '']}</strong>{' '}
                  operador(es) associados a este perfil. Eles precisarão de um novo perfil de
                  acesso.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProfile}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir Perfil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
