import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Building2,
  FileText,
  Users,
  Inbox,
  Tags,
  BarChart3,
  BookOpen,
  Boxes,
  Server,
  Settings,
  Bell,
  LogOut,
  Menu,
  Shield,
  User,
  CheckCheck,
  Upload,
  FileCheck,
  MapPin,
  Star,
  CalendarClock,
  Gauge,
  ShieldOff,
  TrendingUp,
  Workflow,
  ListTree,
  Clock,
  Sun,
  Moon,
  Hourglass,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Bug,
  Search,
  CheckCircle2,
  RefreshCw,
  DollarSign,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { usePermissions } from '@/hooks/use-permissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  getNotifications,
  markNotificationRead,
  NotificationRecord,
} from '@/services/notifications'
import { AiAssistantDrawer } from '@/components/AiAssistantDrawer'
import { NewTicketToast } from '@/components/NewTicketToast'

export default function Layout() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [chamadosMenuOpen, setChamadosMenuOpen] = useState(false)
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false)
  const [changesMenuOpen, setChangesMenuOpen] = useState(false)
  const [problemsMenuOpen, setProblemsMenuOpen] = useState(false)
  const [visitsN2MenuOpen, setVisitsN2MenuOpen] = useState(false)
  const [configuracoesMenuOpen, setConfiguracoesMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      getNotifications(user.id)
        .then(setNotifications)
        .catch(() => {})
    }
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkRead = (id: string) => {
    markNotificationRead(id).then(() => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    })
  }

  const navItems = [
    { label: 'Meu Painel', path: '/operator-dashboard', icon: Gauge, show: true },
    { label: 'Relatórios', path: '/reports', icon: BarChart3, show: permissions.canViewReports },
    {
      label: 'Relatórios por Filial',
      path: '/reports/unit',
      icon: BarChart3,
      show: permissions.canAccessUnitReports,
    },
    {
      label: 'Painel Gerencial',
      path: '/manager-dashboard',
      icon: TrendingUp,
      show: permissions.canViewReports,
    },
    { label: 'Agenda Técnica', path: '/agenda-tecnica', icon: CalendarClock, show: true },
    { label: 'Visitas Técnicas', path: '/visits', icon: MapPin, show: true },
    {
      label: 'Dashboard de Visitas',
      path: '/visits/dashboard',
      icon: MapPin,
      show: permissions.canViewReports,
    },
    { label: 'Painel do Técnico', path: '/visits/technician-dashboard', icon: Gauge, show: true },
    {
      label: 'Deslocamentos',
      path: '/visits/travel-dashboard',
      icon: MapPin,
      show: permissions.canViewReports,
    },
    {
      label: 'Reembolsos',
      path: '/visits/reimbursement-dashboard',
      icon: FileCheck,
      show: permissions.canViewReports,
    },
    {
      label: 'Mapa Operacional',
      path: '/visits/map',
      icon: MapPin,
      show: permissions.isAdmin || permissions.isGestor,
    },
    {
      label: 'Pesquisa de Satisfação',
      path: '/satisfaction',
      icon: Star,
      show: permissions.canViewReports,
    },
    { label: 'CMDB', path: '/cmdb', icon: Boxes, show: permissions.canViewCmdb },
    { label: 'Ativos', path: '/cmdb/assets', icon: Server, show: permissions.canViewCmdb },
    { label: 'Base de Conhecimento', path: '/knowledge-base', icon: BookOpen, show: true },
    {
      label: 'Dashboard de Automações',
      path: '/automations/dashboard',
      icon: Workflow,
      show: permissions.canViewAutomations,
    },
  ]

  const clientSubmenuItems = [
    {
      label: 'Cadastro de Clientes',
      path: '/clients',
      icon: Building2,
      show: permissions.canManageClients,
    },
    { label: 'Contrato', path: '/contracts', icon: FileText, show: permissions.canManageContracts },
    {
      label: 'Horas Clientes',
      path: '/horas-clientes',
      icon: Hourglass,
      show: permissions.canManageContracts,
    },
    {
      label: 'Consumo de Contratos',
      path: '/contracts/consumption',
      icon: Gauge,
      show: permissions.canManageContracts,
    },
    {
      label: 'Dashboard de Contratos',
      path: '/contracts/dashboard',
      icon: CalendarClock,
      show: permissions.canManageContracts,
    },
  ]

  const clientGroupVisible = permissions.canManageClients || permissions.canManageContracts

  const chamadosSubmenuItems = [
    { label: 'Fila de Tickets', path: '/tickets', icon: Ticket, show: true },
    { label: 'Abrir Chamado', path: '/chamados/novo', icon: PlusCircle, show: true },
    { label: 'Aprovações', path: '/aprovacoes', icon: FileCheck, show: true },
    { label: 'Categorias', path: '/categorias', icon: Tags, show: permissions.canManageCategories },
    {
      label: 'Catálogo de Atividades',
      path: '/catalogo',
      icon: ListTree,
      show: permissions.canManageCategories,
    },
  ]

  const dashboardSubmenuItems = [
    {
      label: 'Dashboard Gerencial',
      path: '/dashboard-gerencial',
      icon: LayoutDashboard,
      show: true,
    },
    { label: 'Painel de Tickets', path: '/dashboard', icon: LayoutDashboard, show: true },
  ]

  const chamadosGroupVisible = chamadosSubmenuItems.some((i) => i.show)

  const changesSubmenuItems = [
    { label: 'Dashboard de Mudanças', path: '/changes', icon: LayoutDashboard, show: true },
    { label: 'Solicitações de Mudança', path: '/changes/list', icon: FileText, show: true },
    { label: 'Minhas Mudanças', path: '/changes/my', icon: User, show: true },
    { label: 'Mudanças Pendentes de Aprovação', path: '/changes/pending', icon: Clock, show: true },
    { label: 'Calendário de Mudanças', path: '/changes/calendar', icon: CalendarClock, show: true },
    { label: 'Comitê de Mudanças', path: '/changes/committee', icon: Users, show: true },
    {
      label: 'Tipos de Mudança',
      path: '/changes/types',
      icon: Tags,
      show: permissions.isAdmin || permissions.isGestor,
    },
    {
      label: 'Modelos de Mudança',
      path: '/changes/templates',
      icon: FileCheck,
      show: permissions.isAdmin || permissions.isGestor,
    },
    {
      label: 'Relatórios',
      path: '/changes/reports',
      icon: BarChart3,
      show: permissions.canViewReports,
    },
    {
      label: 'Configurações',
      path: '/changes/settings',
      icon: Settings,
      show: permissions.isAdmin,
    },
  ]
  const changesGroupVisible = changesSubmenuItems.some((i) => i.show)

  const problemsSubmenuItems = [
    { label: 'Dashboard de Problemas', path: '/problems', icon: LayoutDashboard, show: true },
    { label: 'Lista de Problemas', path: '/problems/list', icon: Bug, show: true },
    { label: 'Novo Problema', path: '/problems/new', icon: PlusCircle, show: true },
    { label: 'Meus Problemas', path: '/problems/my', icon: User, show: true },
    {
      label: 'Problemas em Investigação',
      path: '/problems/investigation',
      icon: Search,
      show: true,
    },
    { label: 'Análise de Efetividade', path: '/problems/effectiveness', icon: Gauge, show: true },
    { label: 'Problemas Pendentes', path: '/problems/pending', icon: Clock, show: true },
    { label: 'Problemas Encerrados', path: '/problems/closed', icon: CheckCircle2, show: true },
    {
      label: 'Base de Erros Conhecidos',
      path: '/problems/known-errors',
      icon: BookOpen,
      show: true,
    },
    { label: 'Relatórios', path: '/problems/reports', icon: BarChart3, show: true },
    { label: 'Configurações', path: '/problems/settings', icon: Settings, show: true },
  ]
  const problemsGroupVisible = problemsSubmenuItems.some((i) => i.show)

  const visitsN2SubmenuItems = [
    {
      label: 'Dashboard de Visitas',
      path: '/visitas-n2/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: 'Calendário de Visitas',
      path: '/visitas-n2/calendar',
      icon: CalendarClock,
      show: true,
    },
    { label: 'Lista de Visitas', path: '/visitas-n2/list', icon: Ticket, show: true },
    { label: 'Nova Visita', path: '/visitas-n2/new', icon: PlusCircle, show: true },
    { label: 'Minhas Visitas', path: '/visitas-n2/my', icon: User, show: true },
    { label: 'Deslocamentos', path: '/visitas-n2/travel', icon: MapPin, show: true },
    { label: 'Despesas', path: '/visitas-n2/expenses', icon: FileCheck, show: true },
    { label: 'Reembolsos', path: '/visitas-n2/reimbursements', icon: DollarSign, show: true },
    { label: 'Ordens de Serviço', path: '/visitas-n2/service-orders', icon: FileText, show: true },
    { label: 'Assinaturas', path: '/visitas-n2/signatures', icon: CheckCheck, show: true },
    { label: 'Checklists de Visita', path: '/visitas-n2/checklists', icon: ListTree, show: true },
    { label: 'Visitas Recorrentes', path: '/visitas-n2/recurring', icon: RefreshCw, show: true },
    {
      label: 'Disponibilidade de Técnicos',
      path: '/visitas-n2/availability',
      icon: Clock,
      show: true,
    },
    { label: 'Taxas de KM', path: '/visitas-n2/km-rates', icon: Gauge, show: true },
    { label: 'Relatórios', path: '/visitas-n2/reports', icon: BarChart3, show: true },
  ]
  const visitsN2GroupVisible = true

  const configuracoesSubmenuItems = [
    {
      label: 'Configurações de SLA',
      path: '/settings/sla',
      icon: Clock,
      show: permissions.isAdmin,
    },
    {
      label: 'Central de Automações',
      path: '/automations',
      icon: Workflow,
      show: permissions.canManageAutomations,
    },
    { label: 'Filas', path: '/queues', icon: Inbox, show: permissions.canManageQueues },
    { label: 'Equipe', path: '/team', icon: Users, show: permissions.canManageTeam },
    { label: 'Tipos de Ativo', path: '/cmdb/types', icon: Tags, show: permissions.canManageCmdb },
    {
      label: 'Bloqueio de Clientes',
      path: '/blocking',
      icon: ShieldOff,
      show: permissions.isAdmin,
    },
    { label: 'Central de Aprovações', path: '/approval-center', icon: FileCheck, show: true },
    { label: 'Configurações Gerais', path: '/settings', icon: Settings, show: permissions.isAdmin },
  ]
  const configuracoesGroupVisible = configuracoesSubmenuItems.some((i) => i.show)

  const teamIdx = navItems.findIndex((i) => i.path === '/reports')
  const navBeforeClient = navItems.slice(0, teamIdx).filter((i) => i.show)
  const navAfterClient = navItems.slice(teamIdx).filter((i) => i.show)

  const renderNavItem = (item: any) => {
    const Icon = item.icon
    const active = location.pathname === item.path
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  const navContent = (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-bold text-base text-foreground tracking-tight">Sistema ITSM</span>
          <p className="text-[10px] text-muted-foreground font-medium">Gestão de Chamados</p>
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto py-2 scroll-smooth">
        {navBeforeClient.map(renderNavItem)}
        {
          <div key="dashboard-group">
            <div className="flex items-center">
              <button
                onClick={() => setDashboardMenuOpen(!dashboardMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  dashboardSubmenuItems.some((i) => location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Dashboard</span>
                {dashboardMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {dashboardMenuOpen &&
              dashboardSubmenuItems.map((sub) => {
                const SubIcon = sub.icon
                const subActive = location.pathname === sub.path
                return (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                      subActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    }`}
                  >
                    <SubIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{sub.label}</span>
                  </Link>
                )
              })}
          </div>
        }
        {chamadosGroupVisible && (
          <div key="chamados-group">
            <div className="flex items-center">
              <button
                onClick={() => setChamadosMenuOpen(!chamadosMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  chamadosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Ticket className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Tickets</span>
                {chamadosMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {chamadosMenuOpen &&
              chamadosSubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
        {clientGroupVisible && (
          <div key="cliente-group">
            <div className="flex items-center">
              <button
                onClick={() => setClientMenuOpen(!clientMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Building2 className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Cliente</span>
                {clientMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {clientMenuOpen &&
              clientSubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
        {changesGroupVisible && (
          <div key="changes-group">
            <div className="flex items-center">
              <button
                onClick={() => setChangesMenuOpen(!changesMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <GitBranch className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Gestão de Mudanças</span>
                {changesMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {changesMenuOpen &&
              changesSubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
        {problemsGroupVisible && (
          <div key="problems-group">
            <div className="flex items-center">
              <button
                onClick={() => setProblemsMenuOpen(!problemsMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  problemsSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Bug className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Gerenciamento de Problemas</span>
                {problemsMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {problemsMenuOpen &&
              problemsSubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
        {visitsN2GroupVisible && (
          <div key="visits-n2-group">
            <div className="flex items-center">
              <button
                onClick={() => setVisitsN2MenuOpen(!visitsN2MenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <MapPin className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Gestão Visitas Técnicas N2</span>
                {visitsN2MenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {visitsN2MenuOpen &&
              visitsN2SubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
        {navAfterClient.map(renderNavItem)}
        {configuracoesGroupVisible && (
          <div key="configuracoes-group">
            <div className="flex items-center">
              <button
                onClick={() => setConfiguracoesMenuOpen(!configuracoesMenuOpen)}
                className={`flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
                  configuracoesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Configurações</span>
                {configuracoesMenuOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
            {configuracoesMenuOpen &&
              configuracoesSubmenuItems
                .filter((i) => i.show)
                .map((sub) => {
                  const SubIcon = sub.icon
                  const subActive = location.pathname === sub.path
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 pl-10 pr-4 py-2 text-[13px] font-medium transition-all duration-200 border-l-2 ${
                        subActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <SubIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  )
                })}
          </div>
        )}
      </nav>

      <div className="px-5 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground font-medium">
          Sistema ITSM v1.0 &copy; 2026
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <aside className="sticky top-0 h-screen w-64 flex-shrink-0">{navContent}</aside>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6 transition-colors duration-300">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64 border-none">
                  {navContent}
                </SheetContent>
              </Sheet>
            )}
            <h1 className="text-lg font-semibold text-foreground">
              {[
                ...navItems,
                ...dashboardSubmenuItems,
                ...clientSubmenuItems,
                ...chamadosSubmenuItems,
                ...visitsN2SubmenuItems,
                ...configuracoesSubmenuItems,
              ].find((i) => i.path === location.pathname)?.label || 'Painel'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="transition-transform duration-300 hover:scale-110"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-primary" />
              ) : (
                <Moon className="h-5 w-5 text-primary" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex justify-between items-center">
                  <span>Notificações</span>
                  {unreadCount > 0 && (
                    <span className="text-xs text-primary font-normal">{unreadCount} novas</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto divide-y divide-border">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Sem notificações
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`p-3 text-xs cursor-pointer hover:bg-secondary transition-colors duration-150 ${
                          !n.read ? 'bg-primary/10 font-medium' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-foreground">{n.title}</p>
                          {!n.read && <CheckCheck className="h-3 w-3 text-primary" />}
                        </div>
                        <p className="text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                      {user?.name?.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-xs font-semibold text-foreground">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {user?.role || 'Solicitante'}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <AiAssistantDrawer />
      <NewTicketToast />
    </div>
  )
}
