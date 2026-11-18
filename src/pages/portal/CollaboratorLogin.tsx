import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Loader2, ShieldAlert, ArrowRight, UserRound, KeyRound } from 'lucide-react'
import { useCollaboratorAuth } from '@/services/collaborator-portal'
import { readImpersonation } from '@/services/collaborator-impersonation'
import { LogosLogoPanel } from '@/components/brand/LogosLogo'

export default function CollaboratorLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useCollaboratorAuth()
  const navigate = useNavigate()

  // Sessão de suporte (impersonação do admin) ativa: segue direto para o painel.
  useEffect(() => {
    if (readImpersonation()) {
      navigate('/portal/colaborador/painel', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/portal/colaborador/painel', { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'E-mail ou senha inválidos. Solicite acesso ao administrador da sua empresa.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 py-8 overflow-hidden">
      {/* Fundo neutro em cinza — visual diferenciado do Portal do Ponto Focal (âmbar/grafite) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-300/50 via-transparent to-transparent dark:from-slate-800/40 opacity-80 pointer-events-none" />

      <Card className="relative w-full max-w-md shadow-2xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        {/* Barra superior grafite — única herança oficial do sistema */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 border-b border-slate-200 dark:border-slate-800 bg-[#17181C] rounded-t-xl">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-white" />
            <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
              Portal do Colaborador
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-500/60 bg-slate-700/60 text-slate-200">
            Área Exclusiva
          </span>
        </div>

        <CardHeader className="space-y-1.5 text-center pt-5">
          <div className="flex justify-center mb-2">
            <LogosLogoPanel className="max-h-12" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Acesso do Colaborador
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhe os chamados que você abriu e responda à pesquisa de satisfação
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-rose-400/60">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="collab-email"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                E-mail Corporativo
              </Label>
              <Input
                id="collab-email"
                type="email"
                placeholder="seu.nome@empresa.com.br"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                className="border-slate-300 dark:border-slate-700 focus-visible:ring-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="collab-password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Senha
              </Label>
              <Input
                id="collab-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="border-slate-300 dark:border-slate-700 focus-visible:ring-slate-500"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                O acesso é criado pelo administrador da sua empresa. Caso não possua, solicite ao
                Ponto Focal.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-semibold shadow-md gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Autenticando...
                </>
              ) : (
                <>
                  Entrar no Portal <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-between w-full pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span>É ponto focal ou operador?</span>
              <a
                href="/cliente"
                className="text-slate-700 dark:text-slate-300 hover:underline font-semibold flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" /> Portal do Ponto Focal
              </a>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
