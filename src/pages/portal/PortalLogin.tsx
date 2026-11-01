import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  ShieldAlert,
  KeyRound,
  Building2,
  Sun,
  Moon,
  ArrowRight,
  Wrench,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { getCompanies, CompanyRecord } from '@/services/companies'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function PortalLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { user, login, isAuthenticated } = useAuth()
  const { theme, toggleTheme, designSettings } = useTheme()

  // Modo suporte: apenas Administrador do sistema
  const isAdmin = isAuthenticated && user?.role === 'admin'
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  // Carrega empresas caso o usuário atual já seja Administrador autenticado
  useEffect(() => {
    if (isAdmin) {
      setLoadingCompanies(true)
      getCompanies('status = "Ativo" || status = null')
        .then((list) => {
          setCompanies(list)
          if (list.length > 0) {
            setSelectedCompanyId(list[0].id)
          }
        })
        .catch((err) => {
          console.warn('Erro ao carregar empresas para login de suporte:', err)
        })
        .finally(() => {
          setLoadingCompanies(false)
        })
    }
  }, [isAdmin])

  // Se já autenticado como cliente, redireciona ao portal automaticamente
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') {
        navigate('/portal', { replace: true })
      }
      // Se for operador comum (gestor, tecnico, operador sem role admin), vai ao dashboard ou portal normal
      else if (user.role !== 'admin') {
        navigate('/portal', { replace: true })
      }
      // Se for admin, NÃO redireciona de imediato de forma cega: permite escolher a empresa ou entrar como suporte
    }
  }, [isAuthenticated, user, navigate])

  const handleSupportEnter = (targetCompanyId?: string) => {
    const compId = targetCompanyId || selectedCompanyId
    if (compId) {
      sessionStorage.setItem('itsm_portal_support_company', compId)
      navigate(`/portal?company=${compId}`)
    } else {
      navigate('/portal')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const authData = await pb.collection('users').authWithPassword(email.trim(), password)
      const role = authData.record?.role

      login(authData.token, authData.record)

      if (role === 'cliente_solicitante' || role === 'cliente_gestor') {
        navigate('/portal', { replace: true })
      } else {
        // Usuário é operador ou admin: entra no portal com visão de cliente/teste ou pode ir ao dashboard
        navigate('/portal', { replace: true })
      }
    } catch (err: any) {
      console.error('Portal login error:', err)
      const msg =
        err?.response?.message ||
        err?.message ||
        'E-mail ou senha inválidos. Caso não possua acesso, solicite ao Ponto Focal da sua empresa ou à equipe de suporte.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Background sutil com tema oficial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-80 pointer-events-none" />

      {/* Alternador de tema oficial no topo */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="border-amber-500/30 text-xs gap-1.5 bg-card/80 backdrop-blur"
          title={
            theme === 'dark'
              ? 'Mudar para Modo Claro (Marrom & Branco)'
              : 'Mudar para Modo Escuro (Amber Alert)'
          }
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-amber-700" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </>
          )}
        </Button>
      </div>

      <Card className="relative w-full max-w-md shadow-2xl border border-amber-500/30 bg-card/95 backdrop-blur-xl">
        {/* Barra superior estilo grafite oficial */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase">
              Portal do Cliente
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            Área Exclusiva
          </span>
        </div>

        <CardHeader className="space-y-1.5 text-center pt-4">
          <div className="flex justify-center mb-2">
            {designSettings?.logo_url ? (
              <div className="py-2 px-3 rounded-xl bg-background/50 border border-border/50 max-w-[220px]">
                <img
                  src={designSettings.logo_url}
                  alt="Logotipo"
                  className="max-h-12 w-auto object-contain mx-auto drop-shadow-sm"
                />
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl text-amber-500">
                <Building2 className="h-7 w-7 text-amber-500" />
              </div>
            )}
          </div>

          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Acesso ao Portal
          </CardTitle>

          <CardDescription className="text-xs text-muted-foreground">
            Abertura e acompanhamento de chamados, aprovações, visitas técnicas, ativos e saldo de
            horas
          </CardDescription>
        </CardHeader>

        <div className="px-6 space-y-3">
          {error && (
            <Alert variant="destructive" className="border-rose-500/50">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* Atalho de Modo Suporte — EXCLUSIVO para Administrador Autenticado */}
          {isAdmin && (
            <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Wrench className="h-4 w-4 flex-shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Modo Suporte — Administrador
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Você está autenticado como <strong>{user?.name}</strong> (Administrador do Sistema).
                Você pode entrar no portal sem credenciais de cliente para aferir erros e
                manutenção.
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-foreground block">
                  Escolha o Cliente / Empresa para Impersonação:
                </label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                  disabled={loadingCompanies}
                >
                  <SelectTrigger className="text-xs h-8 bg-background border-amber-500/30">
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.trade_name || c.legal_name || c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSupportEnter()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Entrar no Portal como este Cliente
                </Button>
              </div>

              <div className="text-[10px] text-muted-foreground text-center">
                ou digite credenciais de outro cliente abaixo se preferir login manual.
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="portal-email" className="text-xs font-semibold">
                E-mail Corporativo ou de Acesso
              </Label>
              <Input
                id="portal-email"
                type="email"
                placeholder="seu.nome@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="portal-password" className="text-xs font-semibold">
                  Senha
                </Label>
                <a
                  href="/recover-password"
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Esqueceu a senha?
                </a>
              </div>
              <Input
                id="portal-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Senha inicial padrão para novos cadastros: <code>Cliente@123</code>.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md shadow-amber-600/20 gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                'Autenticando...'
              ) : (
                <>
                  Entrar no Portal <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-between w-full pt-2 border-t text-xs text-muted-foreground">
              <span>É operador do suporte?</span>
              <a
                href="/login"
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" /> Login Operadores
              </a>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
