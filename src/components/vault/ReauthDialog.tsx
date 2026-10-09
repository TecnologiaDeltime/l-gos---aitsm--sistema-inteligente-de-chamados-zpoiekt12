import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Shield, KeyRound, Lock, Eye, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { VaultCredential, revealCredential } from '@/services/vault'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'

interface ReauthDialogProps {
  open: boolean
  credential: VaultCredential | null
  onClose: () => void
}

export function ReauthDialog({ open, credential, onClose }: ReauthDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [operatorLogin, setOperatorLogin] = useState(user?.email || '')
  const [operatorPassword, setOperatorPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Estado da revelação bem-sucedida
  const [revealedData, setRevealedData] = useState<{
    username: string
    password: string
    revealedAt: string
  } | null>(null)
  const [showPasswordText, setShowPasswordText] = useState(true)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)

  const handleReset = () => {
    setOperatorPassword('')
    setRevealedData(null)
    setErrorMessage('')
    setShowPasswordText(true)
    setCopiedField(null)
    onClose()
  }

  const handleReveal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!credential) return
    if (!operatorLogin.trim()) {
      setErrorMessage('Informe seu usuário ou e-mail de operador.')
      return
    }
    if (!operatorPassword) {
      setErrorMessage('Informe sua senha de operador para reautenticação.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const res = await revealCredential({
        credential_id: credential.id,
        operator_login: operatorLogin.trim(),
        operator_password: operatorPassword,
      })

      setRevealedData({
        username: res.username,
        password: res.password,
        revealedAt: res.revealed_at,
      })
      toast({
        title: 'Acesso autorizado',
        description: 'Credencial revelada com sucesso e auditada.',
      })
    } catch (err: any) {
      const msg =
        err?.message || 'Falha ao reautenticar operador. Verifique suas credenciais de login.'
      setErrorMessage(msg)
      toast({
        title: 'Tentativa Negada / Erro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, field: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast({ title: 'Copiado para a área de transferência!' })
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleReset()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Reautenticação de Operador — Cofre de Senhas
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Validação de segurança mandatória para acesso a credenciais
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {credential && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Item do Cofre:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {credential.name} ({credential.type})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Cliente:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {credential.expand?.company?.trade_name ||
                  credential.expand?.company?.legal_name ||
                  'Geral'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Ambiente:</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {credential.environment}
              </span>
            </div>
          </div>
        )}

        {!revealedData ? (
          <form onSubmit={handleReveal} className="space-y-4 pt-1">
            <div className="rounded-lg bg-blue-50/60 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Por política de segurança e compliance, digite as suas credenciais de acesso ao
                sistema (usuário e senha do operador). Essa visualização será gravada em log com seu
                nome, data e horário.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Seu E-mail ou Usuário de Operador
              </Label>
              <Input
                type="text"
                value={operatorLogin}
                onChange={(e) => setOperatorLogin(e.target.value)}
                placeholder="seu.email@empresa.com.br"
                className="itsm-input text-xs"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sua Senha de Login no Sistema
              </Label>
              <Input
                type="password"
                value={operatorPassword}
                onChange={(e) => setOperatorPassword(e.target.value)}
                placeholder="••••••••"
                className="itsm-input text-xs"
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Autenticar e Revelar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <Check className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Reautenticação bem-sucedida!</p>
                <p className="text-[11px] opacity-90">
                  Acesso concedido e registrado em log com data e horário em{' '}
                  {new Date(revealedData.revealedAt).toLocaleString('pt-BR')}.
                </p>
              </div>
            </div>

            {credential?.url_or_address && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  URL / Endereço / IP
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={credential.url_or_address}
                    className="itsm-input text-xs bg-slate-50 font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(credential.url_or_address || '', 'username')}
                    title="Copiar URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Usuário / Login da Credencial
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={revealedData.username}
                  className="itsm-input text-xs bg-slate-50 font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(revealedData.username, 'username')}
                  title="Copiar Usuário"
                >
                  {copiedField === 'username' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Senha da Credencial
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  {showPasswordText ? 'Ocultar' : 'Exibir'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={showPasswordText ? 'text' : 'password'}
                  readOnly
                  value={revealedData.password}
                  className="itsm-input text-xs bg-slate-50 font-mono font-semibold tracking-wider text-slate-900 dark:text-slate-100"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(revealedData.password, 'password')}
                  title="Copiar Senha"
                >
                  {copiedField === 'password' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {credential?.notes && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Observações / Instruções
                </Label>
                <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 p-2 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {credential.notes}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleReset}
                className="w-full sm:w-auto"
              >
                Concluir e Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
