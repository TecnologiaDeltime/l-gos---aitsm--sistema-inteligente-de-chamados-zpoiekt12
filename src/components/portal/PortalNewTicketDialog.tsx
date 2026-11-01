import React, { useState } from 'react'
import { PlusCircle, Paperclip, AlertCircle, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryRecord } from '@/services/categories'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import { createTicket } from '@/services/tickets'
import { useToast } from '@/hooks/use-toast'

interface PortalNewTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  companyName: string
  user: {
    id: string
    name: string
    email: string
    unit?: string
    phone?: string
  }
  categories: CategoryRecord[]
  assets: ConfigurationItemRecord[]
  onSuccess: () => void
}

export default function PortalNewTicketDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  user,
  categories,
  assets,
  onSuccess,
}: PortalNewTicketDialogProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Incidente')
  const [category, setCategory] = useState('')
  const [urgency, setUrgency] = useState('Média')
  const [selectedAsset, setSelectedAsset] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) {
      toast({
        title: 'Empresa não vinculada',
        description: 'Seu usuário precisa estar associado a uma empresa para abrir chamados.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      // Regra de prioridade padrão
      const impact = urgency === 'Alta' ? 'Alto' : urgency === 'Baixa' ? 'Baixo' : 'Médio'
      const priority = urgency === 'Alta' ? 'Alta' : urgency === 'Baixa' ? 'Baixa' : 'Média'

      await createTicket({
        number: 'PENDENTE',
        company: companyId,
        unit: user.unit || undefined,
        title: title.trim(),
        description: description.trim(),
        type,
        category: category || undefined,
        impact,
        urgency,
        priority: priority as any,
        status: 'Novo',
        requester_name: user.name || 'Solicitante do Portal',
        requester_email: user.email,
        requester_phone: user.phone || undefined,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        configuration_item: selectedAsset || undefined,
      } as any)

      toast({
        title: 'Chamado aberto com sucesso!',
        description: `Sua solicitação foi vinculada à empresa ${companyName} e já está na fila de atendimento.`,
      })

      // Limpa campos
      setTitle('')
      setDescription('')
      setType('Incidente')
      setCategory('')
      setUrgency('Média')
      setSelectedAsset('')

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir chamado',
        description: err?.message || 'Falha ao registrar chamado no sistema.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-amber-500" />
            Abrir Novo Chamado
          </DialogTitle>
          <DialogDescription>
            Sua solicitação será amarrada automaticamente à empresa{' '}
            <strong>{companyName || 'Sua Empresa'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Linha 1: Tipo e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo de Solicitação</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente (Algo parou de funcionar)</SelectItem>
                  <SelectItem value="Requisição de Serviço">
                    Requisição de Serviço (Solicitar algo novo)
                  </SelectItem>
                  <SelectItem value="Dúvida">Dúvida / Esclarecimento</SelectItem>
                  <SelectItem value="Visita Técnica">Visita Técnica Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Urgência e Ativo Relacionado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Urgência</label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta (Impacta atividade crítica)</SelectItem>
                  <SelectItem value="Média">Média (Impacto moderado)</SelectItem>
                  <SelectItem value="Baixa">Baixa (Pode aguardar fila normal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Equipamento / Ativo Envolvido (Opcional)
              </label>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Nenhum ativo específico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum ativo específico</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.serial_number ? `(${a.serial_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Título do Chamado</label>
            <Input
              required
              placeholder="Ex: Impressora do financeiro não conecta à rede"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          {/* Linha 4: Descrição detalhada */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Descrição do Problema</label>
            <Textarea
              required
              rows={4}
              placeholder="Descreva detalhadamente o ocorrido, mensagens de erro que apareceram e o que foi feito..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Informações do Solicitante fixas */}
          <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>
                Solicitante: <strong className="text-foreground">{user.name}</strong> ({user.email})
              </span>
            </div>
            <span className="font-medium text-amber-600 dark:text-amber-400">{companyName}</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? 'Registrando Chamado...' : 'Abrir Chamado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
