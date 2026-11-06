import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  ArrowRight,
  ListTodo,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermissions } from '@/hooks/use-permissions'
import { getProjects } from '@/services/projects'
import type { ProjectRecord, ProjectMethodology, ProjectStatus } from '@/types/projects'
import { formatSeconds } from '@/lib/duration'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodologyFilter, setMethodologyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const list = await getProjects()
      setProjects(list)
    } catch (err) {
      console.error('Erro ao carregar projetos:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.expand?.company?.name &&
        p.expand.company.name.toLowerCase().includes(search.toLowerCase()))

    const matchesMethodology = methodologyFilter === 'all' || p.methodology === methodologyFilter

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter

    return matchesSearch && matchesMethodology && matchesStatus
  })

  // KPIs
  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const completedProjects = projects.filter((p) => p.status === 'completed').length
  const totalWorkedSeconds = projects.reduce((acc, p) => acc + (p.total_worked_seconds || 0), 0)

  const getMethodologyBadge = (methodology: ProjectMethodology) => {
    switch (methodology) {
      case 'waterfall':
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
          >
            Cascata (Waterfall)
          </Badge>
        )
      case 'scrum':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
          >
            Ágil (Scrum)
          </Badge>
        )
      case 'lean':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Lean (Fluxo Contínuo)
          </Badge>
        )
      default:
        return <Badge variant="outline">{methodology}</Badge>
    }
  }

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'planning':
        return (
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
          >
            Planejamento
          </Badge>
        )
      case 'active':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Em Execução</Badge>
      case 'completed':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Concluído</Badge>
      case 'suspended':
        return (
          <Badge variant="destructive" className="bg-rose-500 text-white">
            Suspenso
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Cancelado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">Módulo de Projetos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de iniciativas estratégicas e operacionais com metodologias Cascata, Ágil (Scrum)
            e Lean.
          </p>
        </div>

        {permissions.canAccessItem('projects', 'projects_create') && (
          <Button
            onClick={() => navigate('/projetos/novo')}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        )}
      </div>

      {/* Indicadores executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total de Projetos
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">Iniciativas cadastradas</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Em Execução
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {activeProjects}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Projetos ativos com entregas</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Concluídos
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedProjects}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Entregas formalmente fechadas</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Horas Lançadas
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatSeconds(totalWorkedSeconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">Esforço operacional acumulado</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projeto por nome, descrição ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Metodologia:</span>
              </div>
              <Select value={methodologyFilter} onValueChange={setMethodologyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Metodologia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="waterfall">Cascata (Waterfall)</SelectItem>
                  <SelectItem value="scrum">Ágil (Scrum)</SelectItem>
                  <SelectItem value="lean">Lean (Fluxo Contínuo)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="active">Em Execução</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Projetos */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Não há projetos correspondentes aos filtros selecionados. Crie seu primeiro projeto
              para começar.
            </p>
            {permissions.canAccessItem('projects', 'projects_create') && (
              <Button
                onClick={() => navigate('/projetos/novo')}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Projeto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="border-border/60 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold line-clamp-1">
                      {project.name}
                    </CardTitle>
                    {project.expand?.company ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{project.expand.company.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>Projeto Interno</span>
                      </div>
                    )}
                  </div>
                  {getStatusBadge(project.status)}
                </div>

                <div className="pt-2">{getMethodologyBadge(project.methodology)}</div>

                {project.description && (
                  <CardDescription className="line-clamp-2 text-xs pt-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {project.expand?.manager?.name
                        ? `Gestor: ${project.expand.manager.name}`
                        : 'Sem gestor definido'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{formatSeconds(project.total_worked_seconds || 0)}</span>
                  </div>

                  {project.start_date && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Início: {new Date(project.start_date).toLocaleDateString('pt-BR')}
                        {project.target_date &&
                          ` • Previsão: ${new Date(project.target_date).toLocaleDateString('pt-BR')}`}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="w-full text-xs font-medium justify-between group hover:border-amber-500 hover:text-amber-600"
                >
                  <Link to={`/projetos/${project.id}`}>
                    <span>Acessar Projeto & Atividades</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
