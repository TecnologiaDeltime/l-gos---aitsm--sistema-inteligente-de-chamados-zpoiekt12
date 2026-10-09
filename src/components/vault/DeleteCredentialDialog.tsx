import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { VaultCredential, deleteVaultCredential } from '@/services/vault'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface DeleteCredentialDialogProps {
  open: boolean
  credential: VaultCredential | null
  onClose: () => void
  onSuccess: () => void
}

export function DeleteCredentialDialog({
  open,
  credential,
  onClose,
  onSuccess,
}: DeleteCredentialDialogProps) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!credential) return
    setDeleting(true)

    try {
      await deleteVaultCredential(
        credential,
        credential.expand?.company?.trade_name || credential.expand?.company?.legal_name,
      )
      toast({
        title: 'Credencial excluída',
        description: 'A credencial foi removida do cofre e a ação foi registrada em auditoria.',
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir credencial',
        description: err?.message || 'Falha ao remover item do cofre.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold text-red-600 dark:text-red-400">
            Excluir credencial do cofre?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-500 space-y-2">
            <p>
              Tem certeza de que deseja excluir a credencial{' '}
              <strong className="text-slate-800 dark:text-slate-200">{credential?.name}</strong> do
              cliente{' '}
              <strong>
                {credential?.expand?.company?.trade_name ||
                  credential?.expand?.company?.legal_name ||
                  'Geral'}
              </strong>
              ?
            </p>
            <p className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              Esta ação é irreversível. O evento de exclusão será gravado no log de auditoria com
              seu usuário, data e horário.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} onClick={onClose}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Confirmar Exclusão'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
