import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock, ShieldAlert } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ForceChangePasswordDialogProps {
  open: boolean
  onSuccess?: () => void
}

export const ForceChangePasswordDialog: React.FC<ForceChangePasswordDialogProps> = ({
  open,
  onSuccess,
}) => {
  const { user, refreshUser, logout } = useAuth()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Critérios de segurança da nova senha
  const hasMinLength = newPassword.length >= 8
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === newPasswordConfirm

  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      if (!hasMinLength) {
        setError('A nova senha deve ter no mínimo 8 caracteres.')
        return
      }
      if (!hasLetter || !hasNumber) {
        setError('A nova senha deve conter letras e números.')
        return
      }
      if (!passwordsMatch) {
        setError('A confirmação da nova senha não confere.')
        return
      }
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 1. Tentar rota dedicada do backend
      let changed = false
      try {
        const res = await pb.send<{ success: boolean; message: string }>(
          '/backend/v1/auth/change-first-password',
          {
            method: 'POST',
            body: {
              currentPassword,
              newPassword,
              newPasswordConfirm,
            },
          },
        )
        if (res && res.success) {
          changed = true
        }
      } catch (backendErr: any) {
        const msg =
          backendErr?.response?.error || backendErr?.data?.error || backendErr?.message || ''
        // Se a rota retornou erro explícito (ex: senha provisória incorreta), lança para o usuário ver
        if (backendErr?.status && backendErr.status < 500 && msg) {
          throw new Error(msg)
        }
        console.warn('Rota change-first-password falhou, tentando fallback direto:', backendErr)
      }

      // 2. Fallback direto se a rota backend falhou/404
      if (!changed && user?.id) {
        const updatePayload: Record<string, any> = {
          password: newPassword,
          passwordConfirm: newPasswordConfirm,
          must_change_password: false,
        }
        if (currentPassword) {
          updatePayload.oldPassword = currentPassword
        }
        await pb.collection('users').update(user.id, updatePayload)
      }

      toast({
        title: 'Senha alterada com sucesso!',
        description:
          'Sua nova senha foi cadastrada e você já pode acessar todos os recursos do sistema.',
      })

      await refreshUser()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Falha ao alterar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-amber-950 dark:text-amber-100">
                Primeiro Acesso - Troca Obrigatória de Senha
              </DialogTitle>
              <DialogDescription className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Por motivos de segurança, você deve definir sua senha pessoal para continuar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs dark:bg-red-950/50 dark:border-red-900 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
            Olá <strong>{user?.name || user?.email}</strong>, você fez login com uma credencial
            provisória enviada por e-mail. Crie uma senha definitiva para liberar seu acesso ao
            painel ITSM.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="curr-pass" className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Senha Provisória Atual
            </Label>
            <Input
              id="curr-pass"
              type="password"
              placeholder="Digite a senha recebida por e-mail"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass" className="text-xs font-semibold flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Nova Senha Pessoal <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-pass"
              type="password"
              required
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass-confirm" className="text-xs font-semibold">
              Confirmar Nova Senha <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-pass-confirm"
              type="password"
              required
              placeholder="Repita a nova senha"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Requisitos de Senha */}
          <div className="space-y-1 p-3 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Critérios mínimos de segurança:</p>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasMinLength ? 'text-emerald-500' : 'text-slate-300'}`}
              />
              <span className={hasMinLength ? 'text-foreground' : ''}>Pelo menos 8 caracteres</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasLetter ? 'text-emerald-500' : 'text-slate-300'}`}
              />
              <span className={hasLetter ? 'text-foreground' : ''}>Pelo menos 1 letra</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasNumber ? 'text-emerald-500' : 'text-slate-300'}`}
              />
              <span className={hasNumber ? 'text-foreground' : ''}>Pelo menos 1 número</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${passwordsMatch ? 'text-emerald-500' : 'text-slate-300'}`}
              />
              <span className={passwordsMatch ? 'text-foreground' : ''}>
                As duas senhas conferem
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => logout('Troca de senha cancelada.')}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Sair do sistema
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Definir Senha e Entrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
