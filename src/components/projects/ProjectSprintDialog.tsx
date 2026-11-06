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
import { createProjectSprint } from '@/services/projects'
import type { ProjectRecord } from '@/types/projects'
import { Calendar, Plus } from 'lucide-react'

interface SprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRecord
  onSuccess: () => void
}

export function ProjectSprintDialog({ open, onOpenChange, project, onSuccess }: SprintDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da Sprint (ex: Sprint 1).',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      await createProjectSprint({
        project: project.id,
        name: name.trim(),
        goal: goal.trim() || undefined,
        status: 'planned',
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      })

      toast({
        title: 'Sprint criada!',
        description: `A Sprint "${name}" foi cadastrada com sucesso.`,
      })

      setName('')
      setGoal('')
      setStartDate('')
      setEndDate('')
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao criar sprint:', err)
      toast({
        title: 'Erro ao criar Sprint',
        description: err.message || 'Falha ao cadastrar Sprint.',
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
            <Calendar className="h-5 w-5 text-amber-500" />
            <DialogTitle>Planejar Nova Sprint</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Ciclo ágil com meta clara e período de tempo definido para {project.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Nome da Sprint <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Sprint 1 - MVP do Portal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Meta da Sprint (Sprint Goal)</Label>
            <Textarea
              placeholder="Qual o objetivo principal a ser entregue neste ciclo?"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data de Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data de Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
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
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : 'Criar Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
