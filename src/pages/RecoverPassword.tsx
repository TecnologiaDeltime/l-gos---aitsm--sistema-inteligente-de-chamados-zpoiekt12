import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { securityService } from '@/services/security'
import { getDesignSettings } from '@/services/design-settings'
import { LogosLogoPanel, SYSTEM_NAME } from '@/components/brand/LogosLogo'

export default function RecoverPassword() {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [isWarning, setIsWarning] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string>('')

  useEffect(() => {
    getDesignSettings()
      .then((settings) => {
        if (settings?.logo_url) {
          setLogoUrl(settings.logo_url)
        }
      })
      .catch(() => {})
  }, [])

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const res = await securityService.requestPasswordReset(email.trim())
      setFeedbackMessage(
        res.message ||
          'Se o e-mail estiver cadastrado, as orientações de recuperação foram encaminhadas.',
      )
      setIsWarning(!res.email_sent)
      setSent(true)
    } catch (_) {
      setFeedbackMessage(
        'Solicitação registrada com sucesso. Se o e-mail estiver cadastrado, as orientações foram encaminhadas ou contate o administrador.',
      )
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logotipo da Empresa"
              className="h-12 w-auto max-w-[240px] object-contain mb-1"
            />
          ) : (
            <LogosLogoPanel className="max-h-12" />
          )}
          <span className="text-[11px] font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            {SYSTEM_NAME}
          </span>
          <h1 className="text-xl font-bold">Recuperar Senha</h1>
        </div>

        {sent ? (
          <div
            className={`rounded-lg p-4 text-center text-sm space-y-3 ${
              isWarning
                ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900'
                : 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900'
            }`}
          >
            <div className="flex justify-center">
              {isWarning ? (
                <AlertCircle className="h-8 w-8 text-amber-600" />
              ) : (
                <CheckCircle className="h-8 w-8 text-blue-600" />
              )}
            </div>
            <p className="font-medium">{feedbackMessage}</p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center text-primary font-semibold hover:underline text-xs"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar para o Login
              </Link>
            </div>
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
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="seu.email@empresa.com"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Enviar Solicitação de Recuperação'
              )}
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
