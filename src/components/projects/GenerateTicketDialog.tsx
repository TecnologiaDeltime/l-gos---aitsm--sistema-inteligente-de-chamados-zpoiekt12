import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { createTicketFromTask, logProjectTimeAction } from '@/services/projects'
import { parseDurationToSeconds } from '@/lib/duration'
import type { ProjectRecord, ProjectTaskRecord } from '@/types/projects'
import { Ticket, Clock, CheckCircle } from 'lucide-react'

interface GenerateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRecord
  task: ProjectTaskRecord | null
  operators: any[]
  onSuccess: () => void
}

export function GenerateTicketDialog({
  open,
  onOpenChange,
  project,
  task,
  operators,
  onSuccess,
}: GenerateTicketDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [timeSpent, setTimeSpent] = useState('')
  const [actionDescription, setActionDescription] = useState('')

  // Preenche dados quando abrir a partir da tarefa
  useState(() => {
    if (task) {
      setTitle(`[Projeto: ${project.name}] ${task.title}`)
      setDescription(
        `Chamado gerado a partir da atividade de projeto:\n` +
          `• Projeto: ${project.name}\n` +
          `• Atividade: ${task.title}\n` +
          `• Metodologia: ${project.methodology.toUpperCase()}\n\n` +
          `Escopo da Atividade:\n${task.description || 'Sem descrição detalhada.'}`,
      )
      setOperatorId(task.assigned_to || user?.id || '')
    }
  })

  // Sincroniza quando task mudar
  const handleOpenInit = () => {
    if (task) {
      setTitle(`[Projeto: ${project.name}] ${task.title}`)
      setDescription(
        `Chamado operacional gerado a partir da atividade de projeto:\n` +
          `• Projeto: ${project.name}\n` +
          `• Atividade: ${task.title}\n` +
          `• Metodologia: ${project.methodology.toUpperCase()}\n\n` +
          `Escopo da Atividade:\n${task.description || 'Sem descrição detalhada.'}`,
      )
      setOperatorId(task.assigned_to || user?.id || '')
      setTimeSpent('')
      setActionDescription('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return

    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título do chamado.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const ticket = await createTicketFromTask({
        project,
        task,
        userId: operatorId || user?.id || '',
        ticketSubject: title.trim(),
        ticketDescription: description.trim(),
      })

      // Se informou tempo e ação inicial, registra o log de trabalho
      if (timeSpent.trim() && actionDescription.trim()) {
        const seconds = parseDurationToSeconds(timeSpent.trim())
        if (seconds > 0) {
          await logProjectTimeAction({
            project: project.id,
            task: task.id,
            user: operatorId || user?.id || '',
            description: actionDescription.trim(),
            duration_seconds: seconds,
            ticket: ticket.ticketId,
          })
        }
      }

      toast({
        title: 'Chamado gerado com sucesso!',
        description: `Chamado #${ticket.ticketNumber || ticket.ticketId.slice(0, 6)} vinculado ao projeto e à atividade.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao gerar chamado:', err)
      toast({
        title: 'Erro ao gerar chamado',
        description: err.message || 'Falha ao criar chamado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) handleOpenInit()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-500" />
            <DialogTitle>Gerar Chamado para Atividade</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Documente a execução técnica, permita acompanhamento pelo time e registre horas no
            projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Título do Chamado <span className="text-destructive">*</span>
            </Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Operador Responsável</Label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name || op.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição Técnica do Chamado</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Lançamento opcional de horas e ações iniciais */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span>Lançamento Opcional de Horas Iniciais (HH:MM:SS)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="col-span-1">
                <Label className="text-[11px] text-muted-foreground">Tempo gasto</Label>
                <Input
                  placeholder="01:30:00"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-[11px] text-muted-foreground">Ação realizada</Label>
                <Input
                  placeholder="Ex: Análise inicial e alinhamento..."
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O tempo lançado será computado nas horas totais do projeto e documentado no histórico.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {loading ? 'Gerando...' : 'Gerar Chamado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
