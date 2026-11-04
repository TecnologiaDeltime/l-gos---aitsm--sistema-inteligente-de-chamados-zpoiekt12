import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  ScheduledTicketRecord,
  RecurrenceType,
  createScheduledTicket,
  updateScheduledTicket,
  ADVANCE_NOTICE_OPTIONS,
} from '@/services/scheduled-tickets'
import { CompanyRecord, CompanyDepartmentRecord, getCompanyDepartments } from '@/services/companies'
import { CompanyUnitRecord, getCompanyUnitsByCompany } from '@/services/company-units'
import { ContractRecord, getContracts } from '@/services/contracts'
import { CategoryRecord } from '@/services/categories'
import { QueueRecord } from '@/services/queues'
import { UserItem } from '@/services/users'
import { computePriority } from '@/lib/itil-matrix'
import { PriorityBadge } from '@/components/PriorityBadge'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { CalendarClock, Repeat, Bell, Building2, User, Sparkles, Loader2 } from 'lucide-react'

interface ScheduledTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTicket?: ScheduledTicketRecord | null
  onSuccess: () => void
  companies: CompanyRecord[]
  categories: CategoryRecord[]
  queues: QueueRecord[]
  operators: UserItem[]
}

const WEEKDAYS = [
  { value: 1, label: 'Seg', fullName: 'Segunda-feira' },
  { value: 2, label: 'Ter', fullName: 'Terça-feira' },
  { value: 3, label: 'Qua', fullName: 'Quarta-feira' },
  { value: 4, label: 'Qui', fullName: 'Quinta-feira' },
  { value: 5, label: 'Sex', fullName: 'Sexta-feira' },
  { value: 6, label: 'Sáb', fullName: 'Sábado' },
  { value: 0, label: 'Dom', fullName: 'Domingo' },
]

export const ScheduledTicketDialog: React.FC<ScheduledTicketDialogProps> = ({
  open,
  onOpenChange,
  editingTicket,
  onSuccess,
  companies,
  categories,
  queues,
  operators,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Dados básicos do ticket
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contractId, setContractId] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requesterPhone, setRequesterPhone] = useState('')
  const [type, setType] = useState('Requisição de Serviço')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [queueId, setQueueId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('Média')
  const [impact, setImpact] = useState('Médio')
  const [urgency, setUrgency] = useState('Média')

  // Agendamento principal
  const [scheduledDate, setScheduledDate] = useState('')

  // 1. Recorrência
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none')
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1)
  const [hasEndDate, setHasEndDate] = useState(false)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  // 2. Aviso prévio
  const [advanceNoticeMinutes, setAdvanceNoticeMinutes] = useState<number>(0)

  // Sub-entidades carregadas por empresa
  const [companyUnits, setCompanyUnits] = useState<CompanyUnitRecord[]>([])
  const [companyDepartments, setCompanyDepartments] = useState<CompanyDepartmentRecord[]>([])
  const [companyContracts, setCompanyContracts] = useState<ContractRecord[]>([])

  // Inicialização ao abrir modal (criação vs edição)
  React.useEffect(() => {
    if (!open) return

    if (editingTicket) {
      setTitle(editingTicket.title || '')
      setDescription(editingTicket.description || '')
      setCompanyId(editingTicket.company || '')
      setUnitId(editingTicket.unit || '')
      setDepartmentId(editingTicket.department || '')
      setContractId(editingTicket.contract || '')
      setRequesterName(editingTicket.requester_name || '')
      setRequesterEmail(editingTicket.requester_email || '')
      setRequesterPhone(editingTicket.requester_phone || '')
      // Se era Incidente ou Problema (legado), ajusta para Requisição de Serviço
      const savedType = editingTicket.type
      if (!savedType || savedType === 'Incidente' || savedType === 'Problema') {
        setType('Requisição de Serviço')
      } else {
        setType(savedType)
      }
      setCategoryId(editingTicket.category || '')
      setSubcategoryId(editingTicket.subcategory || '')
      setQueueId(editingTicket.queue || '')
      setAssignedTo(editingTicket.assigned_to || '')

      // Carregar prioridade/urgência/impacto da atividade se existir ou do agendamento
      const subCat = categories.find((c) => c.id === editingTicket.subcategory)
      if (subCat) {
        const subImp = subCat.impact || editingTicket.impact || 'Médio'
        const subUrg = subCat.urgency || editingTicket.urgency || 'Média'
        const subPrio = subCat.priority || computePriority(subImp, subUrg)
        setImpact(subImp)
        setUrgency(subUrg)
        setPriority(subPrio)
      } else {
        setPriority(editingTicket.priority || 'Média')
        setImpact(editingTicket.impact || 'Médio')
        setUrgency(editingTicket.urgency || 'Média')
      }

      // Formatar datetime para input local (YYYY-MM-DDTHH:mm)
      if (editingTicket.scheduled_date) {
        const d = new Date(editingTicket.scheduled_date)
        const pad = (n: number) => String(n).padStart(2, '0')
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        setScheduledDate(localIso)
      } else {
        setScheduledDate('')
      }

      setRecurrenceType(editingTicket.recurrence_type || 'none')
      setRecurrenceDaysOfWeek(
        editingTicket.recurrence_days_of_week && editingTicket.recurrence_days_of_week.length > 0
          ? editingTicket.recurrence_days_of_week
          : [1, 2, 3, 4, 5],
      )
      setRecurrenceDayOfMonth(editingTicket.recurrence_day_of_month || 1)
      if (editingTicket.recurrence_end_date) {
        setHasEndDate(true)
        setRecurrenceEndDate(editingTicket.recurrence_end_date.split('T')[0] || '')
      } else {
        setHasEndDate(false)
        setRecurrenceEndDate('')
      }

      setAdvanceNoticeMinutes(editingTicket.advance_notice_minutes || 0)
    } else {
      // Padrão para novo agendamento
      setTitle('')
      setDescription('')
      setCompanyId('')
      setUnitId('')
      setDepartmentId('')
      setContractId('')
      setRequesterName(user?.name || '')
      setRequesterEmail(user?.email || '')
      setRequesterPhone('')
      setType('Requisição de Serviço')
      setCategoryId('')
      setSubcategoryId('')
      setQueueId('')
      setAssignedTo(user?.id || '')
      setPriority('Média')
      setImpact('Médio')
      setUrgency('Média')

      // Sugerir agendamento para a próxima hora redonda
      const nextHour = new Date()
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      const localIso = `${nextHour.getFullYear()}-${pad(nextHour.getMonth() + 1)}-${pad(nextHour.getDate())}T${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`
      setScheduledDate(localIso)

      setRecurrenceType('none')
      setRecurrenceDaysOfWeek([1, 2, 3, 4, 5])
      setRecurrenceDayOfMonth(nextHour.getDate())
      setHasEndDate(false)
      setRecurrenceEndDate('')
      setAdvanceNoticeMinutes(0)
    }
  }, [open, editingTicket, user])

  // Atualizar dados de empresa (filiais, departamentos e contratos)
  React.useEffect(() => {
    if (!companyId) {
      setCompanyUnits([])
      setCompanyDepartments([])
      setCompanyContracts([])
      return
    }

    getCompanyUnitsByCompany(companyId)
      .then(setCompanyUnits)
      .catch(() => setCompanyUnits([]))

    getCompanyDepartments(companyId)
      .then(setCompanyDepartments)
      .catch(() => setCompanyDepartments([]))

    getContracts(`company = "${companyId}" && status = "Ativo"`)
      .then(setCompanyContracts)
      .catch(() => setCompanyContracts([]))
  }, [companyId])

  const parentCategoryMap = React.useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => {
      if (!c.parent) map.set(c.id, c.name)
    })
    return map
  }, [categories])

  const subcategories = React.useMemo(() => {
    const subs = categories.filter((c) => c.parent && c.active !== false)
    if (subs.length > 0) return subs
    return categories.filter((c) => c.active !== false)
  }, [categories])

  // Quando o usuário seleciona uma Atividade do catálogo
  const handleSubcategoryChange = (newSubId: string) => {
    setSubcategoryId(newSubId)
    const selectedSub = categories.find((c) => c.id === newSubId)
    if (selectedSub) {
      if (selectedSub.parent) {
        setCategoryId(selectedSub.parent)
      } else {
        setCategoryId(selectedSub.id)
      }
      const imp = selectedSub.impact || 'Médio'
      const urg = selectedSub.urgency || 'Média'
      const prio = selectedSub.priority || computePriority(imp, urg)
      setImpact(imp)
      setUrgency(urg)
      setPriority(prio)
    } else {
      setCategoryId('')
      setImpact('Médio')
      setUrgency('Média')
      setPriority('Média')
    }
  }

  const toggleWeekday = (day: number) => {
    if (recurrenceDaysOfWeek.includes(day)) {
      if (recurrenceDaysOfWeek.length === 1) {
        toast({
          title: 'Atenção',
          description: 'Selecione ao menos um dia da semana para a recorrência semanal.',
          variant: 'destructive',
        })
        return
      }
      setRecurrenceDaysOfWeek(recurrenceDaysOfWeek.filter((d) => d !== day))
    } else {
      setRecurrenceDaysOfWeek([...recurrenceDaysOfWeek, day])
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o título do agendamento.',
        variant: 'destructive',
      })
      return
    }
    if (!companyId) {
      toast({ title: 'Atenção', description: 'Selecione a empresa.', variant: 'destructive' })
      return
    }
    if (!requesterName.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o nome do solicitante.',
        variant: 'destructive',
      })
      return
    }
    if (!description.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe a descrição do ticket.',
        variant: 'destructive',
      })
      return
    }
    if (!scheduledDate) {
      toast({
        title: 'Atenção',
        description: 'Informe a data e horário programados.',
        variant: 'destructive',
      })
      return
    }

    const schedIso = new Date(scheduledDate).toISOString()

    // Validação da recorrência
    if (recurrenceType === 'weekly' && recurrenceDaysOfWeek.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos um dia da semana para a recorrência.',
        variant: 'destructive',
      })
      return
    }

    let endIso: string | undefined = undefined
    if (hasEndDate && recurrenceEndDate) {
      const parsedEnd = new Date(recurrenceEndDate + 'T23:59:59')
      if (parsedEnd.getTime() <= new Date(scheduledDate).getTime()) {
        toast({
          title: 'Data limite inválida',
          description: 'A data limite de repetição deve ser posterior à data de abertura inicial.',
          variant: 'destructive',
        })
        return
      }
      endIso = parsedEnd.toISOString()
    }

    setLoading(true)
    try {
      const payload: Partial<ScheduledTicketRecord> = {
        title: title.trim(),
        description: description.trim(),
        company: companyId,
        unit: unitId || undefined,
        department: departmentId || undefined,
        contract: contractId || undefined,
        requester_name: requesterName.trim(),
        requester_email: requesterEmail.trim() || undefined,
        requester_phone: requesterPhone.trim() || undefined,
        type,
        category: categoryId || undefined,
        subcategory: subcategoryId || undefined,
        queue: queueId || undefined,
        assigned_to: assignedTo || undefined,
        priority,
        impact,
        urgency,
        scheduled_date: schedIso,
        recurrence_type: recurrenceType,
        recurrence_days_of_week: recurrenceType === 'weekly' ? recurrenceDaysOfWeek : undefined,
        recurrence_day_of_month:
          recurrenceType === 'monthly' ? Number(recurrenceDayOfMonth) : undefined,
        recurrence_end_date: hasEndDate ? endIso : undefined,
        advance_notice_minutes: Number(advanceNoticeMinutes) || 0,
        status: 'agendado',
      }

      if (editingTicket) {
        // Se mudou a data ou horário para frente, resetar o notice_sent para permitir novo aviso prévio
        if (new Date(schedIso).getTime() > new Date(editingTicket.scheduled_date).getTime()) {
          payload.notice_sent = false
        }
        await updateScheduledTicket(editingTicket.id, payload)
        toast({
          title: 'Agendamento atualizado',
          description: 'As alterações no ticket programado foram salvas com sucesso.',
        })
      } else {
        payload.created_by = user?.id || undefined
        payload.notice_sent = false
        await createScheduledTicket(payload)
        toast({
          title: 'Ticket programado com sucesso',
          description: 'O chamado será gerado automaticamente na data configurada.',
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar agendamento',
        description: err?.message || 'Ocorreu um erro ao persistir o ticket programado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarClock className="h-5 w-5 text-primary" />
            {editingTicket ? 'Editar Ticket Programado' : 'Novo Ticket Programado'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 pt-2">
          {/* Seção 1: Identificação e Agendamento */}
          <div className="rounded-lg border p-4 bg-muted/20 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Programação da Abertura
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label
                  htmlFor="sched-title"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Título do Chamado *
                </Label>
                <Input
                  id="sched-title"
                  placeholder="Ex.: Manutenção preventiva mensal de servidores"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label
                  htmlFor="sched-date"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Data e Hora da Primeira Abertura *
                </Label>
                <Input
                  id="sched-date"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1"
                  required
                />
                <span className="text-[11px] text-muted-foreground">
                  O cron de 5 minutos verificará a abertura automaticamente.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Tipo de Chamado
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                    <SelectItem value="Mudança">Mudança</SelectItem>
                    <SelectItem value="Projeto">Projeto</SelectItem>
                    <SelectItem value="Tarefa Interna">Tarefa Interna</SelectItem>
                    <SelectItem value="Visita Técnica">Visita Técnica</SelectItem>
                    <SelectItem value="Dúvida">Dúvida</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  Chamados programáveis (Incidente e Problema não se aplicam a agendamento).
                </span>
              </div>
            </div>
          </div>

          {/* Seção 2: Recorrência */}
          <div className="rounded-lg border p-4 bg-primary/5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Repeat className="h-4 w-4" />
                Recorrência (Chamados Rotineiros)
              </div>
              <span className="text-xs text-muted-foreground">
                Re-agenda o mesmo registro a cada ciclo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Frequência de Repetição
                </Label>
                <Select
                  value={recurrenceType}
                  onValueChange={(val: RecurrenceType) => setRecurrenceType(val)}
                >
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não repete (Abertura única)</SelectItem>
                    <SelectItem value="daily">Diário (Todos os dias)</SelectItem>
                    <SelectItem value="weekly">Semanal (Dias específicos)</SelectItem>
                    <SelectItem value="monthly">Mensal (Dia fixo no mês)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'monthly' && (
                <div>
                  <Label
                    htmlFor="day-of-month"
                    className="text-xs font-semibold uppercase text-muted-foreground"
                  >
                    Dia do Mês (1 a 31)
                  </Label>
                  <Input
                    id="day-of-month"
                    type="number"
                    min={1}
                    max={31}
                    value={recurrenceDayOfMonth}
                    onChange={(e) =>
                      setRecurrenceDayOfMonth(
                        Math.max(1, Math.min(31, parseInt(e.target.value) || 1)),
                      )
                    }
                    className="mt-1 bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Meses com menos dias serão ajustados para o último dia válido.
                  </span>
                </div>
              )}
            </div>

            {/* Seleção de dias da semana quando semanal */}
            {recurrenceType === 'weekly' && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Dias da semana permitidos:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const isSelected = recurrenceDaysOfWeek.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background hover:bg-muted text-muted-foreground border-input'
                        }`}
                        title={day.fullName}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Repetir até (data limite opcional) */}
            {recurrenceType !== 'none' && (
              <div className="pt-2 border-t border-primary/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium cursor-pointer" htmlFor="toggle-end-date">
                      Definir data limite de término?
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Se desativado, o chamado repete indefinidamente até ser cancelado.
                    </p>
                  </div>
                  <Switch
                    id="toggle-end-date"
                    checked={hasEndDate}
                    onCheckedChange={setHasEndDate}
                  />
                </div>

                {hasEndDate && (
                  <div className="max-w-xs">
                    <Label
                      htmlFor="sched-end-date"
                      className="text-xs font-semibold uppercase text-muted-foreground"
                    >
                      Repetir até a data
                    </Label>
                    <Input
                      id="sched-end-date"
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="mt-1 bg-background"
                      required={hasEndDate}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 3: Aviso Prévio */}
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
              <Bell className="h-4 w-4 text-amber-500" />
              Aviso Prévio ao Responsável
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Avisar responsável (minutos antes)
                </Label>
                <Select
                  value={String(advanceNoticeMinutes)}
                  onValueChange={(val) => setAdvanceNoticeMinutes(Number(val))}
                >
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADVANCE_NOTICE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground bg-background/60 p-3 rounded border">
                <p className="font-medium text-foreground mb-1">Canais disparados:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Notificação in-app (tipo Alerta)</li>
                  <li>E-mail noreply@logositsm.com.br</li>
                  <li>Destinatários: Criador + Responsável atribuído</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seção 4: Cliente e Solicitante */}
          <div className="rounded-lg border p-4 bg-muted/20 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
              <Building2 className="h-4 w-4 text-primary" />
              Cliente e Localidade
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Empresa / Cliente *
                </Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name || c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Filial / Unidade
                </Label>
                <Select
                  value={unitId}
                  onValueChange={setUnitId}
                  disabled={!companyId || companyUnits.length === 0}
                >
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue
                      placeholder={
                        companyUnits.length === 0 ? 'Nenhuma unidade' : 'Selecione a filial'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companyUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Departamento / Setor
                </Label>
                <Select
                  value={departmentId}
                  onValueChange={setDepartmentId}
                  disabled={!companyId || companyDepartments.length === 0}
                >
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue
                      placeholder={
                        companyDepartments.length === 0 ? 'Nenhum setor' : 'Selecione o setor'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companyDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="sched-req-name"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Nome do Solicitante *
                </Label>
                <Input
                  id="sched-req-name"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Nome completo"
                  className="mt-1 bg-background"
                  required
                />
              </div>

              <div>
                <Label
                  htmlFor="sched-req-email"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  E-mail do Solicitante
                </Label>
                <Input
                  id="sched-req-email"
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  placeholder="contato@cliente.com.br"
                  className="mt-1 bg-background"
                />
              </div>

              <div>
                <Label
                  htmlFor="sched-req-phone"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="sched-req-phone"
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-1 bg-background"
                />
              </div>
            </div>

            {companyContracts.length > 0 && (
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Vincular ao Contrato Ativo
                </Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue placeholder="Selecione o contrato (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.number ? `Contrato #${c.number} (${c.type})` : `Contrato (${c.type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Seção 5: Atribuição, Atividade do Catálogo e Prioridade Automática */}
          <div className="rounded-lg border p-4 bg-muted/20 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
              <User className="h-4 w-4 text-primary" />
              Atribuição e Atividade do Catálogo
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Fila de Atendimento
                </Label>
                <Select value={queueId} onValueChange={setQueueId}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue placeholder="Selecione a fila" />
                  </SelectTrigger>
                  <SelectContent>
                    {queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Responsável / Operador
                </Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="mt-1 bg-background">
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

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Atividade do Catálogo
                </Label>
                <Select
                  value={subcategoryId}
                  onValueChange={handleSubcategoryChange}
                  disabled={subcategories.length === 0}
                >
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue
                      placeholder={
                        subcategories.length === 0
                          ? 'Nenhuma atividade disponível'
                          : 'Selecione a atividade do catálogo...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sc) => {
                      const group = sc.parent ? parentCategoryMap.get(sc.parent) : null
                      return (
                        <SelectItem key={sc.id} value={sc.id}>
                          {group ? `${group} › ${sc.name}` : sc.name}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  A prioridade e a urgência são definidas automaticamente pela atividade.
                </span>
              </div>
            </div>

            {/* Painel Informativo de Prioridade, Urgência e Impacto definidos pela Atividade */}
            <div className="rounded-lg border bg-background/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Prioridade e Urgência</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {subcategoryId ? 'Definido pela atividade' : 'Padrão do sistema'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                    Prioridade
                  </span>
                  <PriorityBadge priority={priority} />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                    Urgência
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {urgency || 'Média'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                    Impacto
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {impact || 'Médio'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 6: Descrição Detalhada */}
          <div>
            <Label
              htmlFor="sched-desc"
              className="text-xs font-semibold uppercase text-muted-foreground"
            >
              Descrição / Procedimento do Chamado *
            </Label>
            <Textarea
              id="sched-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as instruções ou escopo que serão copiados no corpo do ticket quando ele for gerado..."
              className="mt-1"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTicket ? 'Salvar Alterações' : 'Salvar Agendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
