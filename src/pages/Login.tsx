import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const [email, setEmail] = useState('inovacao@deltime.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await signIn(email, password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Falha no login',
        description: 'Verifique suas credenciais de e-mail e senha.',
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Bem-vindo ao Sistema ITSM!' })
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 animate-fade-in-up">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sistema ITSM
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gestão de Chamados e Controle de SLA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                required
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" defaultChecked />
              <label htmlFor="remember" className="text-slate-600 cursor-pointer">
                Lembrar de mim
              </label>
            </div>
            <Link to="/recuperar-senha" className="text-blue-600 hover:underline">
              Esqueceu sua senha?
            </Link>
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar no Sistema'}
          </Button>
        </form>

        <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500 border border-slate-200">
          <p className="font-semibold text-slate-700">Credenciais para teste:</p>
          <p>
            E-mail: <code className="text-blue-600">inovacao@deltime.com.br</code>
          </p>
          <p>
            Senha: <code className="text-blue-600">Skip@Pass</code>
          </p>
        </div>
      </div>
    </div>
  )
}
