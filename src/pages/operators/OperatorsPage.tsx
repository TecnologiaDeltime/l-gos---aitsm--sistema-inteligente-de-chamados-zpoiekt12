import { useEffect, useState, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  Shield,
  Phone,
  Mail,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Lock as LockIcon,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import { OperatorDialog } from '@/components/operators/OperatorDialog'
import { ResetPasswordDialog } from '@/components/operators/ResetPasswordDialog'
import { securityService } from '@/services/security'
import {
  getOperators,
  createOperator,
  updateOperator,
  deleteOperator,
  resetOperatorPassword,
} from '@/services/operators'
import { getProfiles } from '@/services/profiles'
import { OperatorItem, CreateOperatorData, UpdateOperatorData } from '@/types/operators'
import { ProfileRecord } from '@/types/profiles'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const DEFAULT_TEAMS = [
  'Suporte N1',
  'Suporte N2',
  'Field Service / Campo',
  'Infraestrutura & Redes',
  'Segurança & SOC',
  'Qualidade & Governança',
  'Gestão & Supervisão',
]

export default function OperatorsPage() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const permissions = usePermissions()
  // Somente perfil Administrador pode incluir e excluir operadores
  const canManage = permissions.isAdmin

  const [operators, setOperators] = useState<OperatorItem[]>([])
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOperator, setEditingOperator] = useState<OperatorItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OperatorItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reset password
  const [resettingTarget, setResettingTarget] = useState<OperatorItem | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // Desbloqueio e Reset de 2FA
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [resetting2faId, setResetting2faId] = useState<string | null>(null)

  const handleUnlockUser = async (op: OperatorItem) => {
    try {
      setUnlockingId(op.id)
      await securityService.unlockUser(op.id)
      toast({
        title: 'Conta desbloqueada',
        description: `O acesso do usuário ${op.name || op.email} foi liberado.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao desbloquear',
        description: err.message || 'Falha ao liberar acesso.',
        variant: 'destructive',
      })
    } finally {
      setUnlockingId(null)
    }
  }

  const handleResetUser2Fa = async (op: OperatorItem) => {
    if (
      !confirm(
        `Deseja reiniciar a autenticação em 2 etapas (2FA) de ${op.name || op.email}? O usuário terá que escanear um novo QR Code no próximo login.`,
      )
    ) {
      return
    }
    try {
      setResetting2faId(op.id)
      await securityService.resetUser2Fa(op.id)
      toast({
        title: '2FA Reiniciado',
        description: `A autenticação em duas etapas de ${op.name || op.email} foi resetada.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao resetar 2FA',
        description: err.message || 'Falha ao desativar 2FA do usuário.',
        variant: 'destructive',
      })
    } finally {
      setResetting2faId(null)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [ops, profs] = await Promise.all([getOperators(), getProfiles()])
      setOperators(ops)
      setProfiles(profs)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar operadores',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Realtime subscription resiliente na coleção users
  useRealtime('users', () => {
    getOperators()
      .then(setOperators)
      .catch(() => {})
  })

  // Teams list combining default and existing
  const availableTeams = useMemo(() => {
    const set = new Set<string>(DEFAULT_TEAMS)
    operators.forEach((o) => {
      if (o.team) set.add(o.team)
    })
    return Array.from(set)
  }, [operators])

  // Filtered operators
  const filteredOperators = useMemo(() => {
    return operators.filter((op) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const fullName = (op.name || `${op.first_name || ''} ${op.last_name || ''}`).toLowerCase()
        const email = (op.email || '').toLowerCase()
        const ext = (op.extension || '').toLowerCase()
        const mob = (op.mobile || op.phone || '').toLowerCase()
        const team = (op.team || '').toLowerCase()
        if (
          !fullName.includes(q) &&
          !email.includes(q) &&
          !ext.includes(q) &&
          !mob.includes(q) &&
          !team.includes(q)
        ) {
          return false
        }
      }

      // Status
      if (statusFilter === 'active' && op.active === false) return false
      if (statusFilter === 'inactive' && op.active !== false) return false

      // Team
      if (teamFilter !== 'all' && op.team !== teamFilter) return false

      // Profile
      if (profileFilter !== 'all' && op.profile_id !== profileFilter) return false

      return true
    })
  }, [operators, search, statusFilter, teamFilter, profileFilter])

  // Pagination
  const totalPages = Math.ceil(filteredOperators.length / itemsPerPage) || 1
  const paginatedOperators = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredOperators.slice(start, start + itemsPerPage)
  }, [filteredOperators, currentPage])

  const handleSaveOperator = async (data: CreateOperatorData | UpdateOperatorData) => {
    if (editingOperator) {
      await updateOperator(editingOperator.id, data)
      toast({
        title: 'Operador atualizado com sucesso!',
        description: `Os dados de "${data.first_name || editingOperator.name}" foram salvos.`,
      })
    } else {
      const res = await createOperator(data as CreateOperatorData)
      if (res.email_sent) {
        toast({
          title: 'Operador cadastrado com sucesso!',
          description: `O operador "${data.first_name}" foi cadastrado e o e-mail com as credenciais de primeiro acesso foi enviado.`,
        })
      } else {
        toast({
          title: 'Operador cadastrado com aviso',
          description: `O operador "${data.first_name}" foi criado, mas o e-mail de primeiro acesso não pôde ser enviado (${res.email_error || 'falha no servidor de e-mail'}). Informe a senha provisória ao operador.`,
          variant: 'default',
        })
      }
    }
    await loadData()
  }

  const handleDeleteOperator = async () => {
    if (!deleteTarget) return

    if (!permissions.isAdmin) {
      toast({
        title: 'Permissão negada',
        description: 'Apenas administradores podem excluir operadores.',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      return
    }

    if (deleteTarget.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode excluir sua própria conta de administrador.',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      return
    }

    try {
      setDeleting(true)
      await deleteOperator(deleteTarget.id)
      toast({
        title: 'Operador excluído com sucesso',
        description: `A conta de "${deleteTarget.name || deleteTarget.email}" foi removida.`,
      })
      setDeleteTarget(null)
      await loadData()
    } catch (err: any) {
      const errMsg = err?.message || getErrorMessage(err) || 'Não foi possível excluir o operador.'
      toast({
        title: 'Erro ao excluir operador',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (op: OperatorItem) => {
    if (!canManage) return
    if (op.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode desativar sua própria conta.',
        variant: 'destructive',
      })
      return
    }

    const newStatus = !(op.active ?? true)
    try {
      await updateOperator(op.id, { active: newStatus })
      toast({
        title: newStatus ? 'Operador Ativado' : 'Operador Desativado',
        description: `O operador "${op.name}" agora está ${newStatus ? 'ativo' : 'inativo'}.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleResetPassword = async (op: OperatorItem) => {
    try {
      setIsResetting(true)
      const tempPass = await resetOperatorPassword(op.id)
      setResettingTarget(op)
      setGeneratedPassword(tempPass)
      setResetDialogOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao resetar senha',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsResetting(false)
    }
  }

  const getProfileName = (op: OperatorItem) => {
    if (op.expand?.profile_id?.name) return op.expand.profile_id.name
    if (op.profile_id) {
      const match = profiles.find((p) => p.id === op.profile_id)
      if (match) return match.name
    }
    // Fallback role
    if (op.role === 'admin') return 'Administrador'
    if (op.role === 'gestor') return 'Supervisor / Gestor'
    if (op.role === 'tecnico') return 'Operador'
    return op.role || 'Operador'
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Cadastro de Operadores
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie contas de acesso, equipes, ramais, perfis de permissão e senhas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canManage && (
            <Button
              onClick={() => {
                setEditingOperator(null)
                setDialogOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 shadow-sm"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Novo Operador
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, ramal, celular ou equipe..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-9 h-9 bg-card text-xs"
          />
        </div>

        <div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 bg-card text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="active">Somente Ativos</SelectItem>
              <SelectItem value="inactive">Somente Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select
            value={teamFilter}
            onValueChange={(v) => {
              setTeamFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 bg-card text-xs">
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Equipes</SelectItem>
              {availableTeams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select
            value={profileFilter}
            onValueChange={(v) => {
              setProfileFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 bg-card text-xs">
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Perfis</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats overview */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Exibindo <strong>{paginatedOperators.length}</strong> de{' '}
          <strong>{filteredOperators.length}</strong> operadores
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {operators.filter((o) => o.active !== false).length} ativos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            {operators.filter((o) => o.active === false).length} inativos
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-3 items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredOperators.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Nenhum operador encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search || statusFilter !== 'all' || teamFilter !== 'all' || profileFilter !== 'all'
                ? 'Nenhum operador corresponde aos filtros selecionados.'
                : 'Cadastre o primeiro operador para compor o time de atendimento.'}
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => {
                setEditingOperator(null)
                setDialogOpen(true)
              }}
              size="sm"
              className="bg-primary text-primary-foreground"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Cadastrar Operador
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
                  <TableHead className="font-semibold text-xs">Operador</TableHead>
                  <TableHead className="font-semibold text-xs">Perfil de Acesso</TableHead>
                  <TableHead className="font-semibold text-xs">Equipe / Cargo</TableHead>
                  <TableHead className="font-semibold text-xs">Atendimento</TableHead>
                  <TableHead className="font-semibold text-xs">Contato / Ramal</TableHead>
                  <TableHead className="font-semibold text-xs text-center">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOperators.map((op) => {
                  const profileName = getProfileName(op)
                  const isActive = op.active !== false
                  const isCurrent = op.id === currentUser?.id

                  return (
                    <TableRow key={op.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={op.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {(op.name || op.email).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {op.name ||
                                  `${op.first_name || ''} ${op.last_name || ''}`.trim() ||
                                  'Sem nome'}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-blue-100 text-blue-800"
                                >
                                  Você
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {op.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium bg-secondary text-secondary-foreground"
                        >
                          <Shield className="h-3 w-3 mr-1 text-primary" />
                          {profileName}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <p className="font-medium text-foreground">{op.team || 'Geral'}</p>
                          <p className="text-muted-foreground text-[11px]">{op.position || '—'}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[11px] font-normal ${
                            op.type === 'Externo'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {op.type || 'Interno'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {op.extension && (
                            <p className="flex items-center gap-1 font-mono">
                              <span className="font-medium text-foreground">Ramal:</span>{' '}
                              {op.extension}
                            </p>
                          )}
                          {(op.mobile || op.phone) && (
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {op.mobile || op.phone}
                            </p>
                          )}
                          {!op.extension && !op.mobile && !op.phone && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(op)}
                          disabled={!canManage || isCurrent}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                          title={canManage && !isCurrent ? 'Clique para alterar status' : undefined}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-slate-400" />
                              Inativo
                            </>
                          )}
                        </button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Indicador de Bloqueio por Força Bruta & Desbloqueio */}
                          {(op as any).locked_until &&
                            new Date((op as any).locked_until) > new Date() && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-[11px] text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                                title="Conta bloqueada por excesso de tentativas. Clique para desbloquear."
                                disabled={unlockingId === op.id || !permissions.isAdmin}
                                onClick={() => handleUnlockUser(op)}
                              >
                                <LockIcon className="h-3.5 w-3.5 mr-1" />
                                Desbloquear
                              </Button>
                            )}

                          {/* Reset de 2FA TOTP (Admin) */}
                          {permissions.isAdmin &&
                            (op.role === 'admin' || (op as any).totp_enabled) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Reiniciar 2FA do Usuário"
                                disabled={resetting2faId === op.id}
                                onClick={() => handleResetUser2Fa(op)}
                              >
                                <Smartphone className="h-4 w-4" />
                              </Button>
                            )}

                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                              title="Resetar Senha"
                              disabled={isResetting}
                              onClick={() => handleResetPassword(op)}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar Operador"
                            onClick={() => {
                              setEditingOperator(op)
                              setDialogOpen(true)
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          {canManage && !isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                              title="Excluir Operador"
                              onClick={() => setDeleteTarget(op)}
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
            {paginatedOperators.map((op) => {
              const profileName = getProfileName(op)
              const isActive = op.active !== false
              const isCurrent = op.id === currentUser?.id

              return (
                <div
                  key={op.id}
                  className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={op.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {(op.name || op.email).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm text-foreground">
                            {op.name ||
                              `${op.first_name || ''} ${op.last_name || ''}`.trim() ||
                              op.email}
                          </h3>
                          {isCurrent && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-blue-100 text-blue-800"
                            >
                              Você
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{op.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(op)}
                      disabled={!canManage || isCurrent}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Perfil:</span>
                      <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                        <Shield className="h-3 w-3 text-primary" />
                        {profileName}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px]">Equipe / Cargo:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {op.team || 'Geral'} {op.position ? `• ${op.position}` : ''}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px]">Atendimento:</span>
                      <p className="font-medium text-foreground mt-0.5">{op.type || 'Interno'}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px]">Ramal / Celular:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {op.extension ? `Ramal ${op.extension}` : op.mobile || op.phone || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    {/* Desbloqueio Mobile */}
                    {(op as any).locked_until &&
                      new Date((op as any).locked_until) > new Date() &&
                      permissions.isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 text-amber-700 border-amber-300 bg-amber-50"
                          onClick={() => handleUnlockUser(op)}
                          disabled={unlockingId === op.id}
                        >
                          <LockIcon className="h-3.5 w-3.5 mr-1" />
                          Desbloquear
                        </Button>
                      )}

                    {/* Reset 2FA Mobile */}
                    {permissions.isAdmin && (op.role === 'admin' || (op as any).totp_enabled) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleResetUser2Fa(op)}
                        disabled={resetting2faId === op.id}
                      >
                        <Smartphone className="h-3.5 w-3.5 mr-1" />
                        Resetar 2FA
                      </Button>
                    )}

                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={() => handleResetPassword(op)}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" />
                        Resetar Senha
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        setEditingOperator(op)
                        setDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>

                    {canManage && !isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(op)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-xs"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog for create / edit */}
      <OperatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        operator={editingOperator}
        profiles={profiles}
        teams={availableTeams}
        onSave={handleSaveOperator}
      />

      {/* Dialog for reset password result */}
      <ResetPasswordDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        operatorName={resettingTarget?.name || resettingTarget?.email || ''}
        operatorEmail={resettingTarget?.email || ''}
        generatedPassword={generatedPassword}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Operador
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p>
                Tem certeza que deseja excluir o operador{' '}
                <strong>{deleteTarget?.name || deleteTarget?.email}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                Esta ação removerá o acesso do operador ao sistema. Os históricos de chamados e
                apontamentos já realizados permanecerão gravados.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOperator}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir Operador'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
