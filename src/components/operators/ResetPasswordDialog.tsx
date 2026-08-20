import { useState } from 'react'
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
import { KeyRound, Copy, Check, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operatorName: string
  operatorEmail: string
  generatedPassword: string | null
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  operatorName,
  operatorEmail,
  generatedPassword,
}: ResetPasswordDialogProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!generatedPassword) return
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    toast({
      title: 'Senha copiada!',
      description: 'A nova senha foi copiada para a área de transferência.',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <KeyRound className="h-6 w-6" />
            <DialogTitle className="text-lg font-bold">Senha Redefinida com Sucesso</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Uma nova senha temporária foi gerada para o operador <strong>{operatorName}</strong> (
            {operatorEmail}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Copie e envie esta senha com segurança para o operador. Ela não será exibida novamente
              após fechar esta janela.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Nova Senha Temporária</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={generatedPassword || ''}
                className="font-mono font-bold text-sm bg-muted text-foreground"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Entendido e Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
