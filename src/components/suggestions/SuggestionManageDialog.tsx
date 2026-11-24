// Diálogo de gestão de uma sugestão (admin/equipe de desenvolvimento):
// responder, aceitar/negar com motivo e vincular janela de mudança programada.
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Suggestion,
  SuggestionStatus,
  listChangeWindows,
  manageSuggestion,
} from '@/services/suggestions'

interface ChangeWindowOption {
  id: string
  number?: string
  title?: string
  status?: string
  planned_start?: string
}

interface Props {
  suggestion: Suggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function SuggestionManageDialog({ suggestion, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const [status, setStatus] = useState<SuggestionStatus>('pendente')
  const [adminReply, setAdminReply] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [changeWindowId, setChangeWindowId] = useState<string>('')
  const [implantationDate, setImplantationDate] = useState('')
  const [windows, setWindows] = useState<ChangeWindowOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!suggestion) return
    setStatus(suggestion.status)
    setAdminReply(suggestion.admin_reply || '')
    setRejectReason(suggestion.reject_reason || '')
    setChangeWindowId(suggestion.change_window || '')
    setImplantationDate(
      suggestion.implantation_date ? suggestion.implantation_date.slice(0, 16) : '',
    )
  }, [suggestion])

  useEffect(() => {
    if (!open) return
    listChangeWindows()
      .then(setWindows)
      .catch(() => setWindows([]))
  }, [open])

  const showReject = status === 'negada'
  const showWindow = status === 'aceita' || status === 'implantada'

  const windowLabel = useMemo(
    () => (id: string) => {
      const w = windows.find((x) => x.id === id)
      if (!w) return 'Janela selecionada'
      return `${w.number ? w.number + ' — ' : ''}${w.title || 'Mudança agendada'}`
    },
    [windows],
  )

  const handleSave = async () => {
    if (!suggestion) return
    if (status === 'negada' && !rejectReason.trim()) {
      toast({
        title: 'Informe o motivo da negativa',
        description: 'O autor da sugestão precisa entender a decisão.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await manageSuggestion(suggestion.id, {
        status,
        admin_reply: adminReply.trim(),
        reject_reason: showReject ? rejectReason.trim() : '',
        change_window: showWindow && changeWindowId ? changeWindowId : '',
        implantation_date:
          showWindow && implantationDate ? new Date(implantationDate).toISOString() : '',
      })
      toast({ title: 'Sugestão atualizada!' })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: 'Erro ao atualizar sugestão',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerir sugestão</DialogTitle>
          <DialogDescription>
            Responda ao autor, defina o status e vincule a janela de implantação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-2.5">
            <p className="text-sm font-semibold">{suggestion?.title}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {suggestion?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SuggestionStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aceita">Aceita</SelectItem>
                <SelectItem value="negada">Negada (com motivo)</SelectItem>
                <SelectItem value="implantada">Implantada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Resposta ao autor</Label>
            <Textarea
              placeholder="Mensagem visível para o autor da sugestão..."
              value={adminReply}
              onChange={(e) => setAdminReply(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>

          {showReject && (
            <div className="space-y-1.5">
              <Label className="text-red-600 dark:text-red-400">Motivo da negativa *</Label>
              <Textarea
                placeholder="Explique por que a sugestão não será implantada..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                maxLength={4000}
              />
            </div>
          )}

          {showWindow && (
            <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="space-y-1.5">
                <Label>Janela de mudança programada</Label>
                <Select value={changeWindowId || undefined} onValueChange={setChangeWindowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar mudança agendada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {windows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.number ? `${w.number} — ` : ''}
                        {w.title || 'Mudança agendada'}
                      </SelectItem>
                    ))}
                    {windows.length === 0 && (
                      <SelectItem value="none" disabled>
                        Nenhuma mudança agendada encontrada
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data prevista de implantação</Label>
                <Input
                  type="datetime-local"
                  value={implantationDate}
                  onChange={(e) => setImplantationDate(e.target.value)}
                />
              </div>
              {changeWindowId && (
                <p className="text-xs text-muted-foreground">
                  Vinculada a: {windowLabel(changeWindowId)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
