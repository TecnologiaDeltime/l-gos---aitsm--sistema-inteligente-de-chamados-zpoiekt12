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
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logProjectTimeAction } from '@/services/projects'
import type { ProjectRecord, ProjectTaskRecord } from '@/types/projects'
import { parseDurationToSeconds, formatSeconds } from '@/lib/duration'
import { Clock, PlusCircle } from 'lucide-react'

interface LogTimeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRecord
  task?: ProjectTaskRecord | null
  onSuccess: () => void
}

export function ProjectLogTimeDialog({
  open,
  onOpenChange,
  project,
  task,
  onSuccess,
}: LogTimeDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const [durationString, setDurationString] = useState('01:00:00')
  const [actionDescription, setActionDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionDescription.trim()) {
      toast({
        title: 'Ação obrigatória',
        description: 'Descreva a ação realizada durante o período trabalhado.',
        variant: 'destructive',
      })
      return
    }

    const seconds = parseDurationToSeconds(durationString)
    if (!seconds || seconds <= 0) {
      toast({
        title: 'Duração inválida',
        description: 'Informe o tempo no formato HH:MM:SS (ex: 01:30:00).',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      await logProjectTimeAction({
        project: project.id,
        task: task?.id,
        user: user?.id || 'system',
        duration_seconds: seconds,
        description: actionDescription.trim(),
      })

      toast({
        title: 'Horas e ação lançadas!',
        description: `${formatSeconds(seconds)} adicionados ao projeto com sucesso.`,
      })

      setActionDescription('')
      setDurationString('01:00:00')
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao lançar horas:', err)
      toast({
        title: 'Erro ao registrar horas',
        description: err.message || 'Falha ao registrar ação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <DialogTitle>Lançar Horas & Ação no Projeto</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {task ? (
              <>
                Atividade: <span className="font-semibold text-foreground">{task.title}</span>
              </>
            ) : (
              <>
                Lançamento direto no projeto:{' '}
                <span className="font-semibold text-foreground">{project.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Tempo Trabalhado (HH:MM:SS) <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="01:30:00"
              value={durationString}
              onChange={(e) => setDurationString(e.target.value)}
              className="font-mono"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Formato padrão do Lógos AITSM (ex: 00:45:00 ou 02:15:00).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Ação Realizada / Descrição da Entrega <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Descreva as atividades executadas, decisões técnicas ou entregas..."
              rows={3}
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              required
            />
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
              <PlusCircle className="h-4 w-4 mr-2" />
              {loading ? 'Lançando...' : 'Lançar Horas'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
