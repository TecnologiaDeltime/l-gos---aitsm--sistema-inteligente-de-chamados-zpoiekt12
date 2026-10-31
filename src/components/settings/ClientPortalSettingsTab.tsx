import { useState, useEffect } from 'react'
import {
  Shield,
  KeyRound,
  UserPlus,
  RefreshCw,
  Search,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getClientPortalAccessManagement,
  generatePortalUser,
  resetPortalUserPassword,
  ClientPortalAccessItem,
} from '@/services/client-portal'

export default function ClientPortalSettingsTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ClientPortalAccessItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Modal para gerar/atribuir acesso
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientPortalAccessItem | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState<'cliente_gestor' | 'cliente_solicitante'>(
    'cliente_gestor',
  )
  const [initialPassword, setInitialPassword] = useState('Cliente@123')
  const [submitting, setSubmitting] = useState(false)

  // Modal para resetar senha
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState('')
  const [resetUserName, setResetUserName] = useState('')
  const [newPassword, setNewPassword] = useState('Cliente@123')

  const loadData = async () => {
    try {
      setLoading(true)
      const clients = await getClientPortalAccessManagement()
      setData(clients)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados do portal',
        description: err?.message || 'Falha na comunicação com o backend.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredClients = data.filter(
    (c) =>
      c.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company.cnpj?.includes(searchTerm) ||
      c.portalUsers.some((u) => u.email.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleOpenCreateModal = (client: ClientPortalAccessItem) => {
    setSelectedClient(client)
    // Se tiver contato focal point, pré-preenche
    const focal = client.contacts.find((ct) => ct.isFocalPoint) || client.contacts[0]
    if (focal) {
      setUserName(focal.name)
      setUserEmail(focal.email)
    } else {
      setUserName(`${client.company.name} (Gestor)`)
      setUserEmail(client.company.email || '')
    }
    setUserRole('cliente_gestor')
    setInitialPassword('Cliente@123')
    setCreateModalOpen(true)
  }

  const handleGenerateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    try {
      setSubmitting(true)
      const res = await generatePortalUser({
        companyId: selectedClient.company.id,
        name: userName,
        email: userEmail,
        role: userRole,
        password: initialPassword,
      })
      toast({
        title: 'Acesso provisionado com sucesso!',
        description: res.message,
      })
      setCreateModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: err?.message || 'Falha ao processar solicitação.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetUserId) return
    try {
      setSubmitting(true)
      const res = await resetPortalUserPassword(resetUserId, newPassword)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: res.message,
      })
      setResetModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao redefinir senha',
        description: err?.message || 'Falha ao redefinir senha.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} copiado!`, description: text })
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Gestão do Portal do Cliente
              </CardTitle>
              <CardDescription>
                Controle de acessos, provisionamento automático e pontos focais do Portal do
                Cliente.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                onClick={() => window.open('/portal', '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Acessar Portal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Regra de Provisionamento Imediato</p>
              <p>
                Todo cliente cadastrado em <strong>Empresas/Clientes</strong> recebe imediatamente
                um usuário gestor do portal com a senha padrão <code>Cliente@123</code>. Aqui você
                visualiza todos os acessos gerados, cria usuários adicionais para solicitantes ou
                pontos focais, e redefine senhas de forma segura.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por empresa, CNPJ ou e-mail de acesso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
              Carregando clientes e acessos do portal...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClients.map((client) => {
                const hasUsers = client.portalUsers.length > 0
                return (
                  <div
                    key={client.company.id}
                    className="border rounded-lg p-4 bg-card hover:border-amber-500/40 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-amber-500" />
                          <span className="font-bold text-base">{client.company.name}</span>
                          {hasUsers ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs"
                            >
                              Acesso Ativo ({client.portalUsers.length})
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-xs"
                            >
                              Sem Acesso
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {client.company.cnpj
                            ? `CNPJ: ${client.company.cnpj}`
                            : 'CNPJ não informado'}
                          {client.company.email ? ` • E-mail: ${client.company.email}` : ''}
                          {` • Horas contratadas: ${client.company.hours_contracted || 0}h`}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1.5 self-start sm:self-auto"
                        onClick={() => handleOpenCreateModal(client)}
                      >
                        <UserPlus className="h-4 w-4" />
                        Criar/Liberar Usuário
                      </Button>
                    </div>

                    {/* Lista de usuários de acesso ao portal */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Usuários com Acesso ao Portal:
                      </p>
                      {client.portalUsers.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground pl-2">
                          Nenhum usuário de portal gerado ainda. Clique em "Criar/Liberar Usuário"
                          acima.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {client.portalUsers.map((usr) => (
                            <div
                              key={usr.id}
                              className="border rounded-md p-2.5 bg-muted/30 text-xs flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold truncate">{usr.name}</span>
                                  <Badge
                                    className={
                                      usr.role === 'cliente_gestor'
                                        ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]'
                                        : 'bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]'
                                    }
                                  >
                                    {usr.role === 'cliente_gestor' ? 'Ponto Focal' : 'Solicitante'}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground truncate select-all">
                                  {usr.email}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyToClipboard(usr.email, 'E-mail de acesso')}
                                >
                                  <Copy className="h-3 w-3" />
                                  Copiar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 gap-1 text-amber-600 hover:text-amber-700"
                                  onClick={() => {
                                    setResetUserId(usr.id)
                                    setResetUserName(usr.name)
                                    setNewPassword('Cliente@123')
                                    setResetModalOpen(true)
                                  }}
                                >
                                  <KeyRound className="h-3 w-3" />
                                  Resetar Senha
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Contatos / Pontos Focais Cadastrados */}
                    {client.contacts.length > 0 && (
                      <div className="pt-2 text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
                        <span className="font-semibold">Pontos Focais da Empresa:</span>
                        {client.contacts.map((ct) => (
                          <Badge
                            key={ct.id}
                            variant="secondary"
                            className={
                              ct.isFocalPoint
                                ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                                : ''
                            }
                          >
                            {ct.name} ({ct.email}) {ct.isFocalPoint && '★'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar/Liberar Usuário */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar Acesso ao Portal</DialogTitle>
            <DialogDescription>
              {selectedClient?.company.name} — Crie ou atualize credenciais para um ponto focal ou
              solicitante.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Nome Completo</label>
              <Input
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">E-mail de Login</label>
              <Input
                type="email"
                required
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Ex: joao@cliente.com.br"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Perfil de Acesso no Portal</label>
              <Select value={userRole} onValueChange={(v: any) => setUserRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente_gestor">
                    Ponto Focal / Gestor (Aprova/Reprova chamados e vê métricas)
                  </SelectItem>
                  <SelectItem value="cliente_solicitante">
                    Solicitante Padrão (Abre chamados e acompanha andamento)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Senha Inicial de Acesso</label>
              <Input
                required
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Cliente@123"
              />
              <p className="text-[11px] text-muted-foreground">
                Padrão recomendado: <code>Cliente@123</code>.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? 'Salvando...' : 'Liberar Acesso Imediato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Resetar Senha */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha do Portal</DialogTitle>
            <DialogDescription>
              Defina a nova senha de acesso para o usuário <strong>{resetUserName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Nova Senha</label>
              <Input
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Cliente@123"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? 'Salvando...' : 'Salvar Nova Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
