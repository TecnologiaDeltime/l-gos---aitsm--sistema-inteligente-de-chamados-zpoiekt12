import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, Mail, Pencil, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'
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

  // Estado para Edição de Domínio existente
  const [editingDomain, setEditingDomain] = useState<ClientEmailDomainRecord | null>(null)
  const [editDomainValue, setEditDomainValue] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const normalizeDomain = (val: string): string => {
    let d = val.trim().toLowerCase()
    if (!d) return ''
    if (!d.startsWith('@')) {
      d = '@' + d
    }
    return d
  }

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
    const domain = normalizeDomain(input)
    if (!domain || !onPendingDomainsChange) return
    onPendingDomainsChange([...(pendingDomains || []), { domain, active: true }])
    setInput('')
  }

  const handleLocalRemove = (index: number) => {
    if (!onPendingDomainsChange) return
    onPendingDomainsChange((pendingDomains || []).filter((_, i) => i !== index))
  }

  const handleAdd = async () => {
    const domain = normalizeDomain(input)
    if (!domain || !clientId) return
    try {
      await createEmailDomain({ client: clientId, domain, active: true })
      toast({ title: 'Domínio de e-mail adicionado com sucesso!' })
      setInput('')
      loadData()
    } catch {
      toast({ title: 'Erro ao adicionar domínio', variant: 'destructive' })
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateEmailDomain(id, { active })
      toast({ title: active ? 'Domínio ativado' : 'Domínio desativado' })
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar domínio', variant: 'destructive' })
    }
  }

  const handleStartEdit = (d: ClientEmailDomainRecord) => {
    setEditingDomain(d)
    setEditDomainValue(d.domain)
  }

  const handleSaveEdit = async () => {
    if (!editingDomain) return
    const normalized = normalizeDomain(editDomainValue)
    if (!normalized) {
      toast({ title: 'Domínio inválido', variant: 'destructive' })
      return
    }
    setSavingEdit(true)
    try {
      await updateEmailDomain(editingDomain.id, { domain: normalized })
      toast({ title: 'Domínio atualizado com sucesso!' })
      setEditingDomain(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar domínio', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteEmailDomain(deleteId)
      toast({ title: 'Domínio excluído!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir domínio', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (!clientId) {
    return (
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Domínios de E-mail Permitidos
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre os domínios corporativos autorizados a abrir chamados por e-mail para este
              cliente (ex: @empresa.com, @filial.com.br).
            </p>
          </div>
          {pendingDomains && pendingDomains.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {pendingDomains.length} domínio(s)
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="ex: @empresa.com.br ou filial.com"
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
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-3 bg-slate-50/50 dark:bg-slate-900/50"
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="font-mono">{d.domain}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500 hover:text-red-600"
                  onClick={() => handleLocalRemove(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-2">
            Nenhum domínio cadastrado ainda.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Domínios de E-mail Permitidos
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            E-mails de remetentes pertencentes a estes domínios criarão chamados automaticamente
            vinculados a esta empresa.
          </p>
        </div>
        {domains.length > 0 && (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {domains.filter((d) => d.active).length} ativo(s) de {domains.length}
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="ex: @empresa.com.br ou @filial.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          className="h-9 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!input.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar Domínio
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">Carregando domínios...</p>
      ) : domains.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
          <Mail className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Nenhum domínio cadastrado
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre os domínios corporativos para que e-mails de solicitações sejam processados e
            convertidos em chamados.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => (
            <div
              key={d.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                d.active
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Mail className={`h-4 w-4 ${d.active ? 'text-blue-500' : 'text-slate-400'}`} />
                <div>
                  <span className="text-sm font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {d.domain}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {d.active ? '(Ativo para abertura)' : '(Inativo)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-2">
                  <span className="text-[11px] text-slate-500">
                    {d.active ? 'Habilitado' : 'Desabilitado'}
                  </span>
                  <Switch checked={d.active} onCheckedChange={(v) => handleToggle(d.id, v)} />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-500 hover:text-blue-600"
                  onClick={() => handleStartEdit(d)}
                  title="Editar Domínio"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => setDeleteId(d.id)}
                  title="Excluir Domínio"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Edição de Domínio */}
      <Dialog open={!!editingDomain} onOpenChange={(o) => !o && setEditingDomain(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Editar Domínio de E-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Domínio (ex: @empresa.com.br)
            </label>
            <Input
              value={editDomainValue}
              onChange={(e) => setEditDomainValue(e.target.value)}
              className="h-9 text-sm font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDomain(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingEdit && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Domínio Permitido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? E-mails recebidos deste domínio não serão mais autorizados
              automaticamente e serão retidos para moderação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
