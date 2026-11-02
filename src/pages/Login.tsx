import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { resolvePostLoginDestination } from '@/lib/post-login-destination'
import { securityService, TwoFactorSetupResponse } from '@/services/security'
import { getDesignSettings } from '@/services/design-settings'
import { QrCodeDisplay } from '@/components/QrCodeDisplay'
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
import { useToast } from '@/hooks/use-toast'
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  ArrowLeft,
  LifeBuoy,
} from 'lucide-react'
import { LogosLogoPanel, SYSTEM_NAME } from '@/components/brand/LogosLogo'

type LoginStep = 'credentials' | 'totp' | 'totp_setup'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [step, setStep] = useState<LoginStep>('credentials')

  // Setup de 2FA
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [setupCode, setSetupCode] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>('')

  // Armazenamento temporário das credenciais validadas para completar a sessão após 2FA
  const [tempAuth, setTempAuth] = useState<{ token: string; record: any } | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, user } = useAuth()
  const { toast } = useToast()

  // Determina o destino efetivo levando em conta redirecionamentos prévios (state.from)
  // Se o usuário tentou acessar '/', ou não veio de rota específica, aplica a regra de destino por perfil.
  const getEffectiveDestination = async (authRecord?: any): Promise<string> => {
    const fromPath = (location.state as any)?.from?.pathname as string | undefined
    if (fromPath && fromPath !== '/' && fromPath !== '/login') {
      return fromPath
    }
    return await resolvePostLoginDestination(authRecord || user)
  }

  // Se já autenticado e sem etapas intermediárias pendentes, direcionar
  useEffect(() => {
    if (isAuthenticated && step === 'credentials') {
      getEffectiveDestination(user).then((target) => {
        navigate(target, { replace: true })
      })
    }
  }, [isAuthenticated, user, navigate, step, location.state])

  // Checar se há mensagem de sessão expirada e carregar logotipo dinâmico
  useEffect(() => {
    const expiredMsg = sessionStorage.getItem('itsm_session_expired_message')
    if (expiredMsg) {
      setInfoMessage(expiredMsg)
      sessionStorage.removeItem('itsm_session_expired_message')
    }

    getDesignSettings()
      .then((settings) => {
        if (settings?.logo_url) {
          setLogoUrl(settings.logo_url)
        }
      })
      .catch(() => {})
  }, [])

  // Passo 1: Validação de E-mail e Senha
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      // 1. Tentar autenticar com senha no PocketBase
      const authData = await pb.collection('users').authWithPassword(email, password)

      // 2. Checar requisitos de 2FA
      const twoFaStatus = await securityService.check2Fa(email)

      if (twoFaStatus.required) {
        // Guardar authData temporário na memória
        setTempAuth(authData)

        if (twoFaStatus.needs_setup) {
          // Primeiro acesso do Admin/Gestor: precisa configurar 2FA TOTP
          try {
            const setupRes = await securityService.setup2Fa()
            setSetupData(setupRes)
            setStep('totp_setup')
          } catch (setupErr: any) {
            setError(
              setupErr?.message ||
                'Falha ao iniciar a configuração do segundo fator (2FA). Tente novamente.',
            )
          }
        } else {
          // Usuário já possui 2FA configurado: pedir código de 6 dígitos
          setStep('totp')
        }
      } else {
        // Não requer 2FA: concluir login imediatamente
        login(authData.token, authData.record)
        const target = await getEffectiveDestination(authData.record)
        navigate(target, { replace: true })
      }
    } catch (err: any) {
      console.error('Login error:', err)
      const msg =
        err?.response?.message ||
        err?.message ||
        'E-mail ou senha incorretos. Verifique suas credenciais.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Passo 2: Validação de Código TOTP de 6 dígitos no login
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totpCode.trim()) {
      setError('Por favor, informe o código de verificação.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await securityService.verify2FaLogin(email, totpCode.trim(), isRecoveryMode)

      // Sucesso na verificação do 2FA
      if (tempAuth) {
        login(tempAuth.token, tempAuth.record)
        toast({
          title: 'Autenticação concluída',
          description: 'Login seguro realizado com sucesso.',
        })
        const target = await getEffectiveDestination(tempAuth.record)
        navigate(target, { replace: true })
      } else {
        // Fallback: refazer auth se tempAuth expirou
        const authData = await pb.collection('users').authWithPassword(email, password)
        login(authData.token, authData.record)
        const target = await getEffectiveDestination(authData.record)
        navigate(target, { replace: true })
      }
    } catch (err: any) {
      const msg =
        err?.response?.message ||
        err?.message ||
        'Código inválido ou expirado. Verifique o horário do seu dispositivo.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Passo 3: Confirmação do Primeiro Acesso / Setup de TOTP
  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setupCode.trim()) {
      setError('Digite o código de 6 dígitos gerado no seu aplicativo.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await securityService.confirm2Fa(setupCode.trim())

      toast({
        title: '2FA Ativado com sucesso!',
        description: 'Autenticação de dois fatores configurada para sua conta.',
      })

      // Concluir login
      if (tempAuth) {
        login(tempAuth.token, tempAuth.record)
        const target = await getEffectiveDestination(tempAuth.record)
        navigate(target, { replace: true })
      } else {
        const authData = await pb.collection('users').authWithPassword(email, password)
        login(authData.token, authData.record)
        const target = await getEffectiveDestination(authData.record)
        navigate(target, { replace: true })
      }
    } catch (err: any) {
      const msg =
        err?.response?.message ||
        err?.message ||
        'Código inválido ou expirado. Digite o código atual do seu aplicativo autenticador.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, type: 'secret' | 'codes') => {
    navigator.clipboard.writeText(text)
    if (type === 'secret') {
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    } else {
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Background ambiente sutil com foco âmbar */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-80 pointer-events-none" />

      <Card className="relative w-full max-w-md shadow-2xl border border-border/80 bg-card/95 backdrop-blur-xl">
        {/* Badge do sistema e status */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
            <span className="text-[11px] font-mono font-semibold tracking-wider text-muted-foreground uppercase">
              {SYSTEM_NAME}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
            v1.0 SECURE
          </span>
        </div>

        {/* CABEÇALHO COM LOGOTIPO DINÂMICO OU ÍCONE NEUTRO */}
        <CardHeader className="space-y-1.5 text-center pt-2">
          <div className="flex justify-center mb-2">
            <LogosLogoPanel className="max-h-16" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {step === 'credentials' && 'Portal de Acesso'}
            {step === 'totp' && 'Verificação em Duas Etapas'}
            {step === 'totp_setup' && 'Configurar 2FA (Obrigatório)'}
          </CardTitle>

          <CardDescription className="text-xs text-muted-foreground">
            {step === 'credentials' &&
              'Autentique-se com sua conta de operador para acessar a central'}
            {step === 'totp' &&
              (isRecoveryMode
                ? 'Insira um dos seus códigos de recuperação únicos'
                : 'Digite o código de 6 dígitos gerado pelo seu app autenticador')}
            {step === 'totp_setup' &&
              'Perfis com privilégios administrativos requerem autenticação em duas etapas'}
          </CardDescription>
        </CardHeader>

        {/* FEEDBACKS GLOBAIS */}
        <div className="px-6 space-y-3">
          {infoMessage && (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">{infoMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* ========================================================= */}
        {/* ETAPA 1: CREDENCIAIS DE E-MAIL E SENHA                    */}
        {/* ========================================================= */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <a
                    href="/recover-password"
                    className="text-xs text-primary hover:underline hover:opacity-80"
                  >
                    Esqueceu a senha?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                className="w-full font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40 active:scale-[0.99] transition-all"
                disabled={isLoading}
              >
                {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
              </Button>

              <div className="flex items-center justify-between w-full pt-2 border-t text-xs text-muted-foreground">
                <span>É cliente ou ponto focal?</span>
                <a
                  href="/portal/login"
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  Portal do Cliente &rarr;
                </a>
              </div>
            </CardFooter>
          </form>
        )}

        {/* ========================================================= */}
        {/* ETAPA 2: DIGITAR CÓDIGO TOTP / CÓDIGO DE RECUPERAÇÃO      */}
        {/* ========================================================= */}
        {step === 'totp' && (
          <form onSubmit={handleTotpSubmit}>
            <CardContent className="space-y-4 pt-4">
              <div className="p-3 bg-muted/60 rounded-lg text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Conta: <strong className="text-foreground">{email}</strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    setStep('credentials')
                    setTotpCode('')
                    setError(null)
                  }}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" /> Trocar
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totpCode">
                  {isRecoveryMode ? 'Código de Recuperação (Ex: ABCD-1234)' : 'Código de 6 Dígitos'}
                </Label>
                <Input
                  id="totpCode"
                  type="text"
                  maxLength={isRecoveryMode ? 15 : 6}
                  placeholder={isRecoveryMode ? 'XXXX-XXXX' : '000000'}
                  className="text-center font-mono text-xl tracking-widest"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setIsRecoveryMode(!isRecoveryMode)
                    setTotpCode('')
                    setError(null)
                  }}
                >
                  {isRecoveryMode
                    ? 'Voltar ao código do aplicativo autenticador'
                    : 'Perdeu o celular? Usar código de recuperação'}
                </button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Confirmar e Entrar'}
              </Button>
            </CardFooter>
          </form>
        )}

        {/* ========================================================= */}
        {/* ETAPA 3: SETUP DO 2FA (PRIMEIRO ACESSO DO ADMIN)          */}
        {/* ========================================================= */}
        {step === 'totp_setup' && setupData && (
          <form onSubmit={handleConfirmSetup}>
            <CardContent className="space-y-4 pt-2">
              <div className="text-xs text-muted-foreground">
                1. Escaneie o código abaixo com o <strong>Google Authenticator</strong>,{' '}
                <strong>Microsoft Authenticator</strong> ou seu aplicativo preferido:
              </div>

              {/* QR Code */}
              <div className="flex justify-center py-2">
                <QrCodeDisplay value={setupData.otpauth_url} size={180} />
              </div>

              {/* Chave manual se a câmera falhar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Ou insira a chave manualmente:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupData.secret, 'secret')}
                    className="flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    {copiedSecret ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedSecret ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="p-2 bg-muted rounded font-mono text-xs text-center select-all break-all">
                  {setupData.secret}
                </div>
              </div>

              {/* Códigos de Recuperação de Uso Único */}
              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <LifeBuoy className="w-3.5 h-3.5 text-amber-500" /> Códigos de recuperação:
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupData.recovery_codes.join('\n'), 'codes')}
                    className="flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    {copiedCodes ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCodes ? 'Copiados!' : 'Copiar todos'}
                  </button>
                </div>
                <div className="p-2 bg-muted/60 border rounded grid grid-cols-2 gap-1 font-mono text-xs text-center">
                  {setupData.recovery_codes.map((code, idx) => (
                    <span key={idx} className="bg-background/80 py-1 rounded">
                      {code}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Guarde estes códigos em local seguro. Eles são a única forma de recuperar seu
                  acesso se perder o autenticador.
                </p>
              </div>

              {/* Campo para o primeiro código de confirmação */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="setupCode">2. Digite o código gerado no app para ativar:</Label>
                <Input
                  id="setupCode"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center font-mono text-xl tracking-widest"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Ativando...' : 'Ativar 2FA e Concluir Login'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
