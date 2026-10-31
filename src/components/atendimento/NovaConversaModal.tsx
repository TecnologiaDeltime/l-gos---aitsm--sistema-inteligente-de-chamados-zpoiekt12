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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquarePlus } from 'lucide-react'
import { CanalAtendimento, AtendimentoConversa } from '@/types/atendimento'
import { criarNovaConversa } from '@/services/atendimento'
import { useToast } from '@/hooks/use-toast'

interface NovaConversaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (conversa: AtendimentoConversa) => void
}

export function NovaConversaModal({ open, onOpenChange, onSuccess }: NovaConversaModalProps) {
  const { toast } = useToast()
  const [canal, setCanal] = useState<CanalAtendimento>('whatsapp')
  const [nome, setNome] = useState('')
  const [handle, setHandle] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [vip, setVip] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !mensagem.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome do contato e a mensagem inicial.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const nova = await criarNovaConversa({
        canal,
        contato_nome: nome.trim(),
        contato_handle: handle.trim() || undefined,
        mensagem_inicial: mensagem.trim(),
        contato_vip: vip,
      })

      toast({
        title: 'Conversa criada com sucesso!',
        description: `Classificada como ${nova.prioridade} no canal ${nova.canal.toUpperCase()}`,
      })

      setNome('')
      setHandle('')
      setMensagem('')
      setVip(false)
      onSuccess(nova)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar conversa',
        description: err.message || 'Falha ao salvar no banco',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-base font-bold">Nova Conversa Omnichannel</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Inicie um atendimento via WhatsApp, Webchat ou E-mail com classificação ITIL
              automática e SLA ao vivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Canal de Entrada</Label>
              <Select value={canal} onValueChange={(val: any) => setCanal(val)}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp (Operável na tela)</SelectItem>
                  <SelectItem value="webchat">Webchat (Operável na tela)</SelectItem>
                  <SelectItem value="email">E-mail (Integrado / Caixa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome do Contato / Solicitante *</Label>
              <Input
                placeholder="Ex: Mariana Costa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="text-xs h-8"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Identificador / Telefone / E-mail</Label>
              <Input
                placeholder="Ex: +55 11 99999-8888 ou usuario@empresa.com"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="check-vip"
                checked={vip}
                onChange={(e) => setVip(e.target.checked)}
                className="rounded border-border accent-amber-500"
              />
              <Label htmlFor="check-vip" className="text-xs cursor-pointer font-normal">
                Contato VIP (Diretoria / Alta Prioridade)
              </Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mensagem Inicial do Cliente *</Label>
              <Textarea
                placeholder="Digite o texto inicial da demanda (ex: VPN caindo, reset de senha, acesso ao financeiro...)"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="text-xs min-h-[90px] resize-none"
                required
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Iniciar Conversa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
