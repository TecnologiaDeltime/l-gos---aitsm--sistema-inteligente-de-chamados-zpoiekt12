import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  ArrowLeft,
  Save,
  Users,
  Building2,
  Calendar,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { createProject } from '@/services/projects'
import { getCompanies } from '@/services/companies'
import { getOperators } from '@/services/operators'
import type {
  ProjectMethodology,
  ProjectStatus,
  ProjectMemberRole,
  ProjectTeamMember,
} from '@/types/projects'

export default function ProjectCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])

  // Formulário
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId] = useState<string>('none')
  const [managerId, setManagerId] = useState<string>(() => user?.id || '')
  const [methodology, setMethodology] = useState<ProjectMethodology>('waterfall')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')

  // Equipe
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([])
  const [selectedUserForTeam, setSelectedUserForTeam] = useState('')
  const [selectedRoleForTeam, setSelectedRoleForTeam] = useState<ProjectMemberRole>('assignee')

  useEffect(() => {
    loadAuxData()
  }, [])

  const loadAuxData = async () => {
    try {
      const [comps, ops] = await Promise.all([
        getCompanies().catch(() => []),
        getOperators().catch(() => []),
      ])
      setCompanies(comps)
      setOperators(ops)
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err)
    }
  }

  const handleAddMember = () => {
    if (!selectedUserForTeam) return
    const op = operators.find((o) => o.id === selectedUserForTeam)
    if (!op) return

    if (teamMembers.some((m) => m.user_id === selectedUserForTeam)) {
      toast({
        title: 'Membro já inserido',
        description: 'Este operador já faz parte da equipe do projeto.',
        variant: 'destructive',
      })
      return
    }

    setTeamMembers((prev) => [
      ...prev,
      {
        user_id: op.id,
        name: op.name || op.email,
        email: op.email,
        role: selectedRoleForTeam,
      },
    ])
    setSelectedUserForTeam('')
  }

  const handleRemoveMember = (userId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor informe o nome do projeto.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || undefined,
        methodology,
        status,
        manager: managerId || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
        team_members: teamMembers,
        total_worked_seconds: 0,
      }

      if (companyId && companyId !== 'none') {
        payload.company = companyId
      }

      const project = await createProject(payload)

      toast({
        title: 'Projeto criado com sucesso!',
        description: `O projeto "${project.name}" foi registrado com metodologia ${
          methodology === 'waterfall' ? 'Cascata' : methodology === 'scrum' ? 'Ágil/Scrum' : 'Lean'
        }.`,
      })

      navigate(`/projetos/${project.id}`)
    } catch (err: any) {
      console.error('Erro ao criar projeto:', err)
      toast({
        title: 'Erro ao criar projeto',
        description: err.message || 'Ocorreu um erro ao salvar o projeto.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Botão voltar e título */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Projetos
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <FolderKanban className="h-7 w-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Projeto</h1>
          <p className="text-sm text-muted-foreground">
            Defina o escopo, a metodologia de trabalho e a equipe responsável pela entrega.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação Geral */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Identificação Geral</CardTitle>
            <CardDescription className="text-xs">
              Dados cadastrais do projeto, cliente associado ou iniciativa interna.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do Projeto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: Migração para Cloud AWS, Implantação de VPN Corporativa..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Cliente / Organização</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Selecione o cliente (ou projeto interno)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Projeto Interno (Lógos / Próprio)</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Projetos internos não são vinculados a contratos de clientes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager">Gestor do Projeto</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger id="manager">
                    <SelectValue placeholder="Selecione o gestor" />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição & Objetivos</Label>
              <Textarea
                id="description"
                placeholder="Descreva o escopo, resultados esperados e justificativa do projeto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_date">Previsão de Conclusão</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metodologia e Ciclo de Vida */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Metodologia de Gestão</CardTitle>
            <CardDescription className="text-xs">
              Escolha a abordagem adequada às características da entrega.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Opção Cascata */}
              <div
                onClick={() => setMethodology('waterfall')}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  methodology === 'waterfall'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-border/60 hover:border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <span>Cascata (Waterfall)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fases sequenciais clássicas (Iniciação, Planejamento, Execução, Monitoramento e
                  Encerramento) com marcos claros e controle de dependências.
                </p>
              </div>

              {/* Opção Scrum */}
              <div
                onClick={() => setMethodology('scrum')}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  methodology === 'scrum'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-border/60 hover:border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  <span>Ágil (Scrum)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Product backlog priorizado, iterações em sprints temporizadas com metas,
                  cerimônias (daily, review, retro) e quadro sprint board.
                </p>
              </div>

              {/* Opção Lean */}
              <div
                onClick={() => setMethodology('lean')}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  methodology === 'lean'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-border/60 hover:border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
                  <FolderKanban className="h-4 w-4 text-emerald-500" />
                  <span>Lean (Fluxo Contínuo)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fluxo contínuo puxado com limite de trabalho em progresso (WIP limit) por etapa,
                  eliminação de gargalos e identificação de desperdícios.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="status">Status Inicial do Projeto</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planejamento</SelectItem>
                    <SelectItem value="active">Em Execução</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipe do Projeto */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Equipe do Projeto</CardTitle>
            <CardDescription className="text-xs">
              Delegue operadores com papéis específicos: Gestor, Responsável por Atividade ou
              Colaborador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <Label className="text-xs">Operador / Membro</Label>
                <Select value={selectedUserForTeam} onValueChange={setSelectedUserForTeam}>
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

              <div className="w-full sm:w-48 space-y-1.5">
                <Label className="text-xs">Papel no Projeto</Label>
                <Select
                  value={selectedRoleForTeam}
                  onValueChange={(val: any) => setSelectedRoleForTeam(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="assignee">Responsável por Atividade</SelectItem>
                    <SelectItem value="collaborator">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleAddMember}
                disabled={!selectedUserForTeam}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {teamMembers.length > 0 && (
              <div className="border border-border/50 rounded-lg divide-y divide-border/40 mt-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{member.name}</span>
                      <span className="text-muted-foreground">({member.email})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-secondary font-medium">
                        {member.role === 'manager'
                          ? 'Gestor'
                          : member.role === 'assignee'
                            ? 'Responsável por atividade'
                            : 'Colaborador'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/projetos')}
            disabled={loading}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Salvando...' : 'Criar Projeto'}
          </Button>
        </div>
      </form>
    </div>
  )
}
