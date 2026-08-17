import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, GitBranch } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTicket, TicketRecord } from '@/services/tickets'
import { getActiveContracts, ContractRecord } from '@/services/contracts'
import { getCompanyDepartments, CompanyDepartmentRecord } from '@/services/companies'
import { calculateSlaFromMinutes } from '@/lib/sla-utils'
import { computePriority } from '@/lib/itil-matrix'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { PriorityBadge } from '@/components/PriorityBadge'

interface SlaDeadlines {
  sla_response_deadline?: string
  sla_solution_deadline?: string
}

const TICKET_TYPES = [
  'Incidente',
  'Requisição de Serviço',
  'Problema',
  'Mudança',
  'Projeto',
  'Tarefa Interna',
  'Visita Técnica',
  'Dúvida',
]

const PRIORITIES = ['Crítica', 'Alta', 'Média', 'Baixa']

const IMPACTS = ['Alto', 'Médio', 'Baixo']
const URGENCIES = ['Alta', 'Média', 'Baixa']

interface ChildTicketDialogProps {
  parent: TicketRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function ChildTicketDialog({
  parent,
  open,
  onOpenChange,
  onCreated,
}: ChildTicketDialogProps) {
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState(parent.type || 'Incidente')
  const [priority, setPriority] = useState(parent.priority || 'Média')
  const [impact, setImpact] = useState(parent.impact || 'Médio')
  const [urgency, setUrgency] = useState(parent.urgency || 'Média')
  const [department, setDepartment] = useState(parent.department || '')
  const [contract, setContract] = useState(parent.contract || '')
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [departments, setDepartments] = useState<CompanyDepartmentRecord[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Recalcula prioridade automaticamente quando impacto/urgência mudam
  const autoPriority = useMemo(() => computePriority(impact, urgency), [impact, urgency])

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setType(parent.type || 'Incidente')
    setPriority(parent.priority || 'Média')
    setImpact(parent.impact || 'Médio')
    setUrgency(parent.urgency || 'Média')
    setDepartment(parent.department || '')
    setContract(parent.contract || '')
    getActiveContracts()
      .then(setContracts)
      .catch(() => setContracts([]))
    if (parent.company) {
      getCompanyDepartments(parent.company)
        .then(setDepartments)
        .catch(() => setDepartments([]))
    }
  }, [open, parent])

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Preencha título e descrição', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const selectedContract = contracts.find((c) => c.id === contract)
      const sla: SlaDeadlines = selectedContract
        ? calculateSlaFromMinutes(
            selectedContract.sla_response_time,
            selectedContract.sla_solution_time,
          )
        : {}

      await createTicket({
        number: 'PENDENTE',
        company: parent.company,
        unit: parent.unit || undefined,
        department: department && department !== 'none' ? department : undefined,
        title: title.trim(),
        description: description.trim(),
        type,
        category: parent.category || undefined,
        subcategory: parent.subcategory || undefined,
        equipment: parent.equipment || undefined,
        contract: contract || undefined,
        impact,
        urgency,
        priority: autoPriority,
        status: 'Novo',
        assigned_to: parent.assigned_to || undefined,
        requester_name: parent.requester_name,
        requester_email: parent.requester_email,
        requester_phone: parent.requester_phone,
        source: parent.source || 'Manual',
        sla_status: 'Dentro do Prazo',
        parent_ticket_id: parent.id,
        sla_response_deadline: sla.sla_response_deadline,
        sla_solution_deadline: sla.sla_solution_deadline,
      } as any)

      toast({ title: 'Ticket filho criado com sucesso!' })
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      toast({
        title: 'Erro ao criar ticket filho',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-600" />
            Abrir Ticket Filho
          </DialogTitle>
          <DialogDescription>
            O novo chamado será vinculado ao ticket pai{' '}
            <span className="font-semibold text-foreground">{parent.number}</span> e herdará
            empresa, contrato e contato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do ticket filho"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Descrição <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Descreva o problema ou solicitação do ticket filho..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prioridade</Label>
              <Select value={autoPriority || priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Impacto</Label>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Urgência</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCIES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {autoPriority && (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Prioridade calculada:</span>
              <PriorityBadge priority={autoPriority} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Setor</Label>
            <Select value={department || 'none'} onValueChange={setDepartment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Contrato (herdado do pai)</Label>
            <Select
              value={contract || '_none'}
              onValueChange={(v) => setContract(v === '_none' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem contrato</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.number}
                    {c.expand?.company?.trade_name ? ` — ${c.expand.company.trade_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200">
            <p>
              <span className="font-semibold">Empresa:</span>{' '}
              {parent.expand?.company?.trade_name || 'N/A'}
            </p>
            <p>
              <span className="font-semibold">Solicitante:</span> {parent.requester_name}
              {parent.requester_email ? ` (${parent.requester_email})` : ''}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Criar Ticket Filho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Helper exportado para que o TicketDetail verifique o bloqueio de encerramento
 * do ticket pai antes de abrir o diálogo de resolução.
 * Retorna a lista de filhos pendentes (vazia = pode encerrar).
 */
export async function checkPendingChildren(parentId: string): Promise<TicketRecord[]> {
  const { getChildTickets, CHILD_CLOSED_STATUSES } = await import('@/services/tickets')
  try {
    const children = await getChildTickets(parentId)
    return children.filter((c) => !CHILD_CLOSED_STATUSES.includes(c.status))
  } catch {
    return []
  }
}
