import { useEffect, useState, useMemo } from 'react'
import {
  Target,
  Save,
  Trash2,
  RefreshCw,
  Plus,
  Calendar,
  Infinity as InfinityIcon,
  Search,
  Filter,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getUsers } from '@/services/users'
import {
  getTechnicianGoals,
  createTechnicianGoal,
  updateTechnicianGoal,
  deleteTechnicianGoal,
  type TechnicianGoalRecord,
} from '@/services/technician-goals'
import { useRealtime } from '@/hooks/use-realtime'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function formatPeriodMonth(monthKey?: string) {
  if (!monthKey) return '—'
  const [y, m] = monthKey.split('-')
  const idx = parseInt(m, 10) - 1
  return `${MONTH_NAMES[idx] || m} / ${y}`
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function SlaGoalsPage() {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<any[]>([])
  const [goals, setGoals] = useState<TechnicianGoalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<string>('all')

  // Modal de criação/edição
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingGoal, setEditingGoal] = useState<TechnicianGoalRecord | null>(null)

  // Campos do formulário
  const [formTechId, setFormTechId] = useState('')
  const [formPeriodType, setFormPeriodType] = useState<'geral' | 'mensal'>('geral')
  const [formPeriodMonth, setFormPeriodMonth] = useState(currentMonthKey())
  const [formResponsePct, setFormResponsePct] = useState<number>(90)
  const [formSolutionPct, setFormSolutionPct] = useState<number>(85)
  const [formEffectivenessPct, setFormEffectivenessPct] = useState<number>(80)
  const [formNotes, setFormNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [techs, goalRecords] = await Promise.all([
        getUsers('role = "tecnico" || role = "gestor" || role = "admin"'),
        getTechnicianGoals(),
      ])
      setTechnicians(techs)
      setGoals(goalRecords)
    } catch (err) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('technician_goals', () => {
    loadData()
  })

  const openNewGoalModal = (techId?: string) => {
    setEditingGoal(null)
    setFormTechId(techId || (technicians[0]?.id ?? ''))
    setFormPeriodType('geral')
    setFormPeriodMonth(currentMonthKey())
    setFormResponsePct(90)
    setFormSolutionPct(85)
    setFormEffectivenessPct(80)
    setFormNotes('')
    setModalOpen(true)
  }

  const openEditGoalModal = (goal: TechnicianGoalRecord) => {
    setEditingGoal(goal)
    setFormTechId(goal.technician)
    setFormPeriodType(goal.period_type)
    setFormPeriodMonth(goal.period_month || currentMonthKey())
    setFormResponsePct(goal.response_sla_target)
    setFormSolutionPct(goal.solution_sla_target)
    setFormEffectivenessPct(goal.resolution_effectiveness_target)
    setFormNotes(goal.notes || '')
    setModalOpen(true)
  }

  const validatePcts = (r: number, s: number, e: number) => {
    if (isNaN(r) || r < 0 || r > 100) return 'Meta de SLA de Resposta deve estar entre 0% e 100%.'
    if (isNaN(s) || s < 0 || s > 100) return 'Meta de SLA de Solução deve estar entre 0% e 100%.'
    if (isNaN(e) || e < 0 || e > 100)
      return 'Meta de Efetividade de Resolução deve estar entre 0% e 100%.'
    return null
  }

  const handleSaveGoal = async () => {
    if (!formTechId) {
      toast({
        title: 'Técnico obrigatório',
        description: 'Selecione um técnico para definir as metas.',
        variant: 'destructive',
      })
      return
    }

    const valErr = validatePcts(formResponsePct, formSolutionPct, formEffectivenessPct)
    if (valErr) {
      toast({
        title: 'Percentual inválido',
        description: valErr,
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: Partial<TechnicianGoalRecord> = {
        technician: formTechId,
        period_type: formPeriodType,
        period_month: formPeriodType === 'mensal' ? formPeriodMonth : '',
        response_sla_target: Number(formResponsePct),
        solution_sla_target: Number(formSolutionPct),
        resolution_effectiveness_target: Number(formEffectivenessPct),
        notes: formNotes.trim(),
      }

      if (editingGoal) {
        await updateTechnicianGoal(editingGoal.id, payload)
        toast({ title: 'Meta atualizada com sucesso' })
      } else {
        // Verifica se já existe meta para a mesma chave técnico + vigência
        const existing = goals.find(
          (g) =>
            g.technician === formTechId &&
            g.period_type === formPeriodType &&
            (formPeriodType === 'geral' || g.period_month === formPeriodMonth),
        )
        if (existing) {
          // Atualiza a existente em vez de duplicar
          await updateTechnicianGoal(existing.id, payload)
          toast({ title: 'Meta do técnico atualizada com sucesso' })
        } else {
          await createTechnicianGoal(payload)
          toast({ title: 'Nova meta cadastrada com sucesso' })
        }
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      toast({
        title: 'Erro ao salvar meta',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Deseja realmente remover esta meta?')) return
    try {
      await deleteTechnicianGoal(goalId)
      toast({ title: 'Meta removida com sucesso' })
      await loadData()
    } catch (err) {
      toast({
        title: 'Erro ao remover meta',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  // Filtragem de metas
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const techName =
        g.expand?.technician?.name ||
        technicians.find((t) => t.id === g.technician)?.name ||
        technicians.find((t) => t.id === g.technician)?.email ||
        ''
      const matchesSearch =
        search === '' ||
        techName.toLowerCase().includes(search.toLowerCase()) ||
        (g.notes || '').toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (filterPeriod === 'geral') return g.period_type === 'geral'
      if (filterPeriod === 'mensal') return g.period_type === 'mensal'
      return true
    })
  }, [goals, search, filterPeriod, technicians])

  // Mapeamento rápido de metas vigentes por técnico (para a tabela resumo de técnicos)
  const techSummary = useMemo(() => {
    return technicians.map((tech) => {
      const techGoals = goals.filter((g) => g.technician === tech.id)
      const generalGoal = techGoals.find((g) => g.period_type === 'geral')
      const monthlyGoals = techGoals.filter((g) => g.period_type === 'mensal')
      return {
        tech,
        generalGoal,
        monthlyGoalsCount: monthlyGoals.length,
        totalGoalsCount: techGoals.length,
      }
    })
  }, [technicians, goals])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" /> Gestão de Metas por Técnico
          </h2>
          <p className="text-xs text-slate-500">
            Defina e ajuste as metas individuais de SLA de Resposta, SLA de Solução e Efetividade de
            Resolução para cada técnico (vigência geral contínua ou mensal).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/sla-dashboard">
            <Button size="sm" variant="outline">
              Voltar ao SLA
            </Button>
          </Link>
          <Button size="sm" onClick={() => openNewGoalModal()}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova Meta
          </Button>
          <Button size="sm" variant="ghost" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Técnicos Elegíveis</p>
              <p className="text-2xl font-bold">{technicians.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Metas Gerais Ativas</p>
              <p className="text-2xl font-bold">
                {goals.filter((g) => g.period_type === 'geral').length}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <InfinityIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Metas Mensais Específicas</p>
              <p className="text-2xl font-bold">
                {goals.filter((g) => g.period_type === 'mensal').length}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Visão Geral por Técnico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            Metas Vigentes por Técnico
          </CardTitle>
          <CardDescription className="text-xs">
            Visão consolidada da vigência contínua e metas mensais configuradas para cada técnico.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : technicians.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Nenhum técnico encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Técnico</TableHead>
                    <TableHead className="text-xs text-center">Vigência Geral</TableHead>
                    <TableHead className="text-xs text-center">SLA Resposta</TableHead>
                    <TableHead className="text-xs text-center">SLA Solução</TableHead>
                    <TableHead className="text-xs text-center">Efetividade</TableHead>
                    <TableHead className="text-xs text-center">Metas do Mês</TableHead>
                    <TableHead className="text-xs text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techSummary.map(({ tech, generalGoal, monthlyGoalsCount }) => (
                    <TableRow key={tech.id}>
                      <TableCell className="text-xs font-medium">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {tech.name || tech.email}
                          </p>
                          <p className="text-[11px] text-slate-400">{tech.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {generalGoal ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <InfinityIcon className="h-3 w-3" /> Contínua
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">Padrão (90/85/80)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold text-blue-600">
                        {generalGoal ? `${generalGoal.response_sla_target}%` : '90%'}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold text-emerald-600">
                        {generalGoal ? `${generalGoal.solution_sla_target}%` : '85%'}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold text-indigo-600">
                        {generalGoal ? `${generalGoal.resolution_effectiveness_target}%` : '80%'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {monthlyGoalsCount} cadastrada(s)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            if (generalGoal) {
                              openEditGoalModal(generalGoal)
                            } else {
                              openNewGoalModal(tech.id)
                            }
                          }}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {generalGoal ? 'Editar Geral' : 'Definir Meta'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico e Todas as Metas Cadastradas (Geral e Mensais) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                Registros de Metas Cadastradas
              </CardTitle>
              <CardDescription className="text-xs">
                Todas as metas individuais cadastradas com seus respectivos períodos e vigências.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar técnico..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-44"
                />
              </div>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Vigência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas vigências</SelectItem>
                  <SelectItem value="geral">Apenas Geral</SelectItem>
                  <SelectItem value="mensal">Apenas Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filteredGoals.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhuma meta cadastrada encontrada. Clique em &quot;Nova Meta&quot; para definir a
              primeira.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Técnico</TableHead>
                    <TableHead className="text-xs text-center">Tipo de Vigência</TableHead>
                    <TableHead className="text-xs text-center">Período</TableHead>
                    <TableHead className="text-xs text-center">SLA Resposta (%)</TableHead>
                    <TableHead className="text-xs text-center">SLA Solução (%)</TableHead>
                    <TableHead className="text-xs text-center">Efetividade (%)</TableHead>
                    <TableHead className="text-xs">Observações</TableHead>
                    <TableHead className="text-xs text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGoals.map((g) => {
                    const tech =
                      g.expand?.technician || technicians.find((t) => t.id === g.technician)
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="text-xs font-medium">
                          {tech?.name || tech?.email || 'Técnico não identificado'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {g.period_type === 'geral' ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Vigência Contínua
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-blue-700 border-blue-300"
                            >
                              Mês Específico
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium">
                          {g.period_type === 'geral'
                            ? 'Contínua / Geral'
                            : formatPeriodMonth(g.period_month)}
                        </TableCell>
                        <TableCell className="text-xs text-center font-bold text-blue-600">
                          {g.response_sla_target}%
                        </TableCell>
                        <TableCell className="text-xs text-center font-bold text-emerald-600">
                          {g.solution_sla_target}%
                        </TableCell>
                        <TableCell className="text-xs text-center font-bold text-indigo-600">
                          {g.resolution_effectiveness_target}%
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">
                          {g.notes || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditGoalModal(g)}
                              title="Editar meta"
                            >
                              <Save className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500"
                              onClick={() => handleDeleteGoal(g.id)}
                              title="Excluir meta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação / Edição de Meta */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              {editingGoal ? 'Editar Meta do Técnico' : 'Definir Meta do Técnico'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe as metas de SLA e efetividade (0 a 100%). Valores são exibidos estritamente em
              percentual no painel do técnico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Técnico */}
            <div className="space-y-1.5">
              <Label className="text-xs">Técnico</Label>
              <Select value={formTechId} onValueChange={setFormTechId} disabled={!!editingGoal}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name || t.email} ({t.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Vigência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Vigência</Label>
                <Select value={formPeriodType} onValueChange={(val: any) => setFormPeriodType(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Vigência Geral (Contínua)</SelectItem>
                    <SelectItem value="mensal">Mês Específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formPeriodType === 'mensal' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Mês de Referência</Label>
                  <Input
                    type="month"
                    value={formPeriodMonth}
                    onChange={(e) => setFormPeriodMonth(e.target.value)}
                    className="text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Aplicação</Label>
                  <div className="h-9 px-3 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center text-[11px] text-slate-500">
                    Válida para todos os meses
                  </div>
                </div>
              )}
            </div>

            {/* Metas: 3 percentuais */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                  SLA Resposta (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={formResponsePct}
                  onChange={(e) => setFormResponsePct(Number(e.target.value))}
                  className="text-center font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  SLA Solução (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={formSolutionPct}
                  onChange={(e) => setFormSolutionPct(Number(e.target.value))}
                  className="text-center font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                  Efetividade (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={formEffectivenessPct}
                  onChange={(e) => setFormEffectivenessPct(Number(e.target.value))}
                  className="text-center font-bold text-xs"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações do Gestor (Opcional)</Label>
              <Input
                placeholder="Ex.: Meta reajustada para o fechamento do trimestre"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveGoal} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
