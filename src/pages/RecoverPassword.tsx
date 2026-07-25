import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RecoverPassword() {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Recuperar Senha</h1>
        </div>

        {sent ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm text-blue-800 space-y-3">
            <p>
              Se o e-mail estiver cadastrado, você receberá um link de recuperação em instantes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center text-blue-600 font-semibold hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para o Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">E-mail cadastrado</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="seu.email@empresa.com"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Enviar Link de Recuperação
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-xs text-slate-500 hover:underline">
                Voltar para o Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
