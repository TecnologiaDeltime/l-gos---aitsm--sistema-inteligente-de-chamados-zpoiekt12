import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Lock,
  Search,
  Plus,
  KeyRound,
  Globe,
  Server,
  Layers,
  Building2,
  Users,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import {
  VaultCredential,
  CredentialType,
  EnvironmentType,
  getVaultCredentials,
} from '@/services/vault'
import { CompanyRecord, getCompanies } from '@/services/companies'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { CredentialDialog } from '@/components/vault/CredentialDialog'
import { ReauthDialog } from '@/components/vault/ReauthDialog'
import { DeleteCredentialDialog } from '@/components/vault/DeleteCredentialDialog'
import { VaultAuditTab } from '@/components/vault/VaultAuditTab'

interface VaultPageProps {
  embeddedTab?: boolean
}

export default function VaultPage({ embeddedTab = false }: VaultPageProps) {
  const permissions = usePermissions()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'credentials' | 'audit'>('credentials')
  const [credentials, setCredentials] = useState<VaultCredential[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('all')
  const [type, setType] = useState('all')
  const [environment, setEnvironment] = useState('all')

  // Modais
  const [createEditDialogOpen, setCreateEditDialogOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<VaultCredential | null>(null)

  const [reauthDialogOpen, setReauthDialogOpen] = useState(false)
  const [reauthCredential, setReauthCredential] = useState<VaultCredential | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCredential, setDeletingCredential] = useState<VaultCredential | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [creds, comps] = await Promise.all([
        getVaultCredentials({
          companyId,
          type,
          environment,
          search,
        }),
        getCompanies(),
      ])
      setCredentials(creds)
      setCompanies(comps)
    } catch {
      toast({ title: 'Erro ao carregar dados do cofre', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [companyId, type, environment, search])

  const handleOpenCreate = () => {
    setEditingCredential(null)
    setCreateEditDialogOpen(true)
  }

  const handleOpenEdit = (cred: VaultCredential) => {
    setEditingCredential(cred)
    setCreateEditDialogOpen(true)
  }

  const handleOpenDelete = (cred: VaultCredential) => {
    setDeletingCredential(cred)
    setDeleteDialogOpen(true)
  }

  const handleOpenReauth = (cred: VaultCredential) => {
    setReauthCredential(cred)
    setReauthDialogOpen(true)
  }

  const getTypeIcon = (t: CredentialType) => {
    switch (t) {
      case 'Portal':
        return <Globe className="h-4 w-4 text-sky-600" />
      case 'Equipamento':
        return <Server className="h-4 w-4 text-emerald-600" />
      case 'Aplicação':
        return <Layers className="h-4 w-4 text-purple-600" />
      default:
        return <KeyRound className="h-4 w-4 text-slate-500" />
    }
  }

  const getEnvBadge = (env: EnvironmentType) => {
    switch (env) {
      case 'Produção':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold"
          >
            Produção
          </Badge>
        )
      case 'Homologação':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-semibold"
          >
            Homologação
          </Badge>
        )
      case 'Teste':
        return (
          <Badge
            variant="outline"
            className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] font-semibold"
          >
            Teste
          </Badge>
        )
      case 'Desenvolvimento':
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-semibold"
          >
            Dev
          </Badge>
        )
      case 'DR / Contingência':
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] font-semibold"
          >
            DR / Contingência
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {env}
          </Badge>
        )
    }
  }

  // Verifica se o operador atual possui autorização direta de perfil para este item
  const checkUserCanAccess = (cred: VaultCredential) => {
    if (permissions.isAdmin) return true
    const allowed = cred.allowed_profiles || []
    if (allowed.length === 0) return true
    const userProfileId = (permissions.profile as any)?.id
    return !!(userProfileId && allowed.includes(userProfileId))
  }

  return (
    <div className={`space-y-6 ${embeddedTab ? '' : 'max-w-7xl mx-auto'}`}>
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Cofre de Senhas Corporativo
              <Badge
                variant="outline"
                className="text-[10px] font-semibold border-primary/40 bg-primary/10 text-primary"
              >
                Auditoria Mandatória
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Armazenamento seguro de credenciais de portais, equipamentos e aplicações por cliente
              e ambiente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navegação entre Abas */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'credentials' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('credentials')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'credentials'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Credenciais ({credentials.length})
            </Button>

            <Button
              type="button"
              size="sm"
              variant={activeTab === 'audit' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('audit')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'audit'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5 text-cyan-400" />
              Auditoria & Acessos
            </Button>
          </div>

          {permissions.canManageVault && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Credencial
            </Button>
          )}
        </div>
      </div>

      {/* ABA 1: LISTAGEM DE CREDENCIAIS */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <Card className="itsm-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nome, usuário, observações..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="itsm-input pl-8 text-xs"
                  />
                </div>

                <div>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="itsm-select text-xs">
                      <SelectValue placeholder="Cliente..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.trade_name || c.legal_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="itsm-select text-xs">
                      <SelectValue placeholder="Tipo de item..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="Portal">Portal</SelectItem>
                      <SelectItem value="Equipamento">Equipamento</SelectItem>
                      <SelectItem value="Aplicação">Aplicação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger className="itsm-select text-xs">
                      <SelectValue placeholder="Ambiente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os ambientes</SelectItem>
                      <SelectItem value="Produção">Produção</SelectItem>
                      <SelectItem value="Homologação">Homologação</SelectItem>
                      <SelectItem value="Teste">Teste</SelectItem>
                      <SelectItem value="Desenvolvimento">Desenvolvimento</SelectItem>
                      <SelectItem value="DR / Contingência">DR / Contingência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards ou Tabela de Credenciais */}
          {loading ? (
            <Card className="itsm-card">
              <CardContent className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Carregando credenciais do cofre...
              </CardContent>
            </Card>
          ) : credentials.length === 0 ? (
            <Card className="itsm-card">
              <CardContent className="p-12 text-center space-y-3">
                <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 mx-auto flex items-center justify-center text-slate-400">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma credencial encontrada
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Não há senhas cadastradas para os filtros selecionados. Clique em "Nova
                  Credencial" para registrar o primeiro acesso.
                </p>
                {permissions.canManageVault && (
                  <Button size="sm" onClick={handleOpenCreate} className="text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Cadastrar Credencial
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credentials.map((cred) => {
                const canAccess = checkUserCanAccess(cred)
                const allowedProfiles = cred.expand?.allowed_profiles || []

                return (
                  <Card
                    key={cred.id}
                    className="itsm-card itsm-card-hover flex flex-col justify-between border-border/80 bg-card/90"
                  >
                    <div>
                      <CardHeader className="p-4 pb-2 border-b border-border/80 bg-secondary/15">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-secondary/80 border border-border">
                              {getTypeIcon(cred.type)}
                            </div>
                            <div>
                              <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                                {cred.name}
                              </CardTitle>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3 shrink-0" />
                                {cred.expand?.company?.trade_name ||
                                  cred.expand?.company?.legal_name ||
                                  'Cliente Geral'}
                              </p>
                            </div>
                          </div>
                          {getEnvBadge(cred.environment)}
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3 text-xs">
                        {/* URL ou endereço */}
                        {cred.url_or_address && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-muted-foreground/80 font-medium">
                              Endereço/URL:
                            </span>
                            <a
                              href={
                                cred.url_or_address.startsWith('http')
                                  ? cred.url_or_address
                                  : `http://${cred.url_or_address}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-mono truncate max-w-[170px] inline-flex items-center gap-1"
                            >
                              {cred.url_or_address}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </div>
                        )}

                        {/* Usuário de acesso */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground/80 font-medium">Usuário:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {cred.username}
                          </span>
                        </div>

                        {/* Senha (sob demanda) */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border">
                          <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-amber-400" />
                            <span className="font-mono text-muted-foreground tracking-widest text-[11px]">
                              ••••••••••••
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenReauth(cred)}
                            className="h-7 text-[11px] px-2.5 font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Revelar Senha
                          </Button>
                        </div>

                        {/* Perfis autorizados */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Perfis autorizados:
                            </span>
                            {allowedProfiles.length === 0 ? (
                              <span className="text-slate-500 font-medium">Gestão & Técnicos</span>
                            ) : (
                              <span className="text-primary font-semibold">
                                {allowedProfiles.length} perfil(is)
                              </span>
                            )}
                          </div>
                          {allowedProfiles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {allowedProfiles.slice(0, 3).map((p) => (
                                <Badge
                                  key={p.id}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  {p.name}
                                </Badge>
                              ))}
                              {allowedProfiles.length > 3 && (
                                <span className="text-[10px] text-slate-400">
                                  +{allowedProfiles.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Observações */}
                        {cred.notes && (
                          <p className="text-[11px] text-slate-500 italic line-clamp-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {cred.notes}
                          </p>
                        )}

                        {/* Indicador de permissão do usuário logado */}
                        <div className="pt-2 flex items-center gap-1 text-[10px]">
                          {canAccess ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <ShieldCheck className="h-3 w-3" />
                              Você tem autorização para visualizar
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <ShieldAlert className="h-3 w-3" />
                              Perfil não atribuído (revelação será negada)
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    {/* Ações de Administração / Edição / Exclusão */}
                    <div className="p-3 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Criado em {new Date(cred.created).toLocaleDateString('pt-BR')}
                      </span>

                      {permissions.canManageVault && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(cred)}
                            className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                            title="Editar credencial"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDelete(cred)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Excluir credencial"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: AUDITORIA COMPLETA DE ACESSOS */}
      {activeTab === 'audit' && <VaultAuditTab />}

      {/* Diálogos */}
      <CredentialDialog
        open={createEditDialogOpen}
        credential={editingCredential}
        onClose={() => setCreateEditDialogOpen(false)}
        onSuccess={loadData}
      />

      <ReauthDialog
        open={reauthDialogOpen}
        credential={reauthCredential}
        onClose={() => setReauthDialogOpen(false)}
      />

      <DeleteCredentialDialog
        open={deleteDialogOpen}
        credential={deletingCredential}
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
