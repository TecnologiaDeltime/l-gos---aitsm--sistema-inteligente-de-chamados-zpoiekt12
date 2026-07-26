import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { getActiveTemplates, TicketTemplateRecord } from '@/services/ticket-templates'
import { updateTicket } from '@/services/tickets'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ResolveTicketDialogProps {
  ticketId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved: () => void
}

export function ResolveTicketDialog({
  ticketId,
  open,
  onOpenChange,
  onResolved,
}: ResolveTicketDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [solution, setSolution] = useState('')
  const [templates, setTemplates] = useState<TicketTemplateRecord[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TicketTemplateRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setSolution('')
      setSelectedTemplate(null)
      setError('')
      getActiveTemplates('Resolução')
        .then(setTemplates)
        .catch(() => setTemplates([]))
    }
  }, [open])

  const handleTemplateSelect = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId)
    if (tmpl) {
      setSelectedTemplate(tmpl)
      setSolution(tmpl.content)
      setError('')
    }
  }

  const handleConfirm = async () => {
    if (solution.trim().length < 10) {
      setError('A solução deve ter no mínimo 10 caracteres.')
      return
    }
    setLoading(true)
    try {
      await updateTicket(ticketId, {
        status: 'Resolvido',
        solution: solution.trim(),
        resolution_date: new Date().toISOString(),
      })

      const truncated =
        solution.trim().length > 200 ? solution.trim().substring(0, 200) + '...' : solution.trim()
      const templateInfo = selectedTemplate ? ` (usou modelo: ${selectedTemplate.name})` : ''

      await pb.collection('ticket_history').create({
        ticket: ticketId,
        user: user?.id || '',
        action: 'Resolvido',
        field: 'solution',
        old_value: '',
        new_value: truncated + templateInfo,
      })

      toast({ title: 'Chamado resolvido com sucesso!' })
      onOpenChange(false)
      onResolved()
    } catch (err) {
      toast({
        title: 'Erro ao resolver chamado',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Registrar Solução
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {templates.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Modelos</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um modelo para preencher..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Nenhum modelo disponível. Crie um em Configurações de Modelos.
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Solução <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={solution}
              onChange={(e) => {
                setSolution(e.target.value)
                setError('')
              }}
              rows={6}
              placeholder="Descreva a solução aplicada ao chamado (mínimo 10 caracteres)..."
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-xs text-slate-400">{solution.trim().length} caracteres</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || solution.trim().length < 10}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Confirmar Resolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
