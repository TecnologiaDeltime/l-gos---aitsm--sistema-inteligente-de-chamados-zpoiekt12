import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Mail } from 'lucide-react'
import {
  getEmailDomains,
  createEmailDomain,
  updateEmailDomain,
  deleteEmailDomain,
  type ClientEmailDomainRecord,
  type PendingEmailDomain,
} from '@/services/client-email-domains'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

interface Props {
  clientId?: string
  pendingDomains?: PendingEmailDomain[]
  onPendingDomainsChange?: (domains: PendingEmailDomain[]) => void
}

export function EmailDomainSection({ clientId, pendingDomains, onPendingDomainsChange }: Props) {
  const { toast } = useToast()
  const [domains, setDomains] = useState<ClientEmailDomainRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      setDomains(await getEmailDomains(clientId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('client_email_domains', () => loadData(), !!clientId)

  const handleLocalAdd = () => {
    const domain = input.trim()
    if (!domain || !onPendingDomainsChange) return
    onPendingDomainsChange([...(pendingDomains || []), { domain, active: true }])
    setInput('')
  }

  const handleLocalRemove = (index: number) => {
    if (!onPendingDomainsChange) return
    onPendingDomainsChange((pendingDomains || []).filter((_, i) => i !== index))
  }

  const handleAdd = async () => {
    const domain = input.trim()
    if (!domain || !clientId) return
    try {
      await createEmailDomain({ client: clientId, domain, active: true })
      toast({ title: 'Domínio adicionado!' })
      setInput('')
      loadData()
    } catch {
      toast({ title: 'Erro ao adicionar domínio', variant: 'destructive' })
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateEmailDomain(id, { active })
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar domínio', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteEmailDomain(deleteId)
      toast({ title: 'Domínio excluído!' })
    } catch {
      toast({ title: 'Erro ao excluir domínio', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
        <div>
          <h3 className="text-base font-bold">Domínios de E-mail Permitidos</h3>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os domínios autorizados a abrir chamados por e-mail para este cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="@empresa.com.br"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLocalAdd())}
            className="h-9 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleLocalAdd} disabled={!input.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {pendingDomains && pendingDomains.length > 0 ? (
          <div className="space-y-2">
            {pendingDomains.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {d.domain}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => handleLocalRemove(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-2">Nenhum domínio cadastrado.</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
      <div>
        <h3 className="text-base font-bold">Domínios de E-mail Permitidos</h3>
        <p className="text-xs text-slate-500 mt-1">
          Apenas domínios ativos poderão abrir chamados por e-mail. Se nenhum domínio for
          cadastrado, todos serão aceitos.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="@empresa.com.br"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          className="h-9 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!input.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">Carregando...</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          Nenhum domínio cadastrado. Todos os domínios serão aceitos por padrão.
        </p>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {d.domain}
              </span>
              <div className="flex items-center gap-2">
                <Switch checked={d.active} onCheckedChange={(v) => handleToggle(d.id, v)} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500"
                  onClick={() => setDeleteId(d.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Domínio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
