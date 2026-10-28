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
  Mail,
  Tags,
  BarChart3,
  FileBarChart,
  BookOpen,
  Boxes,
  Server,
  Settings,
  Bell,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
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
  Hourglass,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Bug,
  Search,
  CheckCircle2,
  RefreshCw,
  DollarSign,
  FileSearch,
  Volume2,
  VolumeX,
  Lock,
  Palette,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { normalizeThemeVariant } from '@/services/design-settings'
import { usePermissions } from '@/hooks/use-permissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAlertMute } from '@/hooks/use-alert-mute'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { RefreshIndicator } from '@/components/RefreshIndicator'

export default function Layout() {
  const { user, signOut } = useAuth()
  const { designSettings } = useTheme()
  const permissions = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { isMuted, toggleMute, loading: muteLoading } = useAlertMute()
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [chamadosMenuOpen, setChamadosMenuOpen] = useState(false)
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false)
  const [changesMenuOpen, setChangesMenuOpen] = useState(false)
  const [problemsMenuOpen, setProblemsMenuOpen] = useState(false)
  const [visitsN2MenuOpen, setVisitsN2MenuOpen] = useState(false)
  const [configuracoesMenuOpen, setConfiguracoesMenuOpen] = useState(false)
  const [relatoriosMenuOpen, setRelatoriosMenuOpen] = useState(false)
  const [cmdbMenuOpen, setCmdbMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

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
    {
      label: 'Painel Gerencial',
      path: '/manager-dashboard',
      icon: TrendingUp,
      show: permissions.canViewReports,
    },
    { label: 'Agenda de Operadores', path: '/agenda-tecnica', icon: CalendarClock, show: true },
    { label: 'Visitas Técnicas', path: '/visits', icon: MapPin, show: true },
    {
      label: 'Dashboard de Visitas',
      path: '/visits/dashboard',
      icon: MapPin,
      show: permissions.canViewReports,
    },
    { label: 'Painel do Operador', path: '/visits/technician-dashboard', icon: Gauge, show: true },
    {
      label: 'Pesquisa de Satisfação',
      path: '/satisfaction',
      icon: Star,
      show: permissions.canViewReports,
    },
    { label: 'Base de Conhecimento', path: '/knowledge-base', icon: BookOpen, show: true },
  ]

  const clientSubmenuItems = [
    {
      label: 'Cadastro de Clientes',
      path: '/clients',
      icon: Building2,
      show: permissions.canReadModule('clients'),
    },
    {
      label: 'Contrato',
      path: '/contracts',
      icon: FileText,
      show: permissions.canReadModule('clients'),
    },
    {
      label: 'Horas Clientes',
      path: '/horas-clientes',
      icon: Hourglass,
      show: permissions.canReadModule('clients'),
    },
    {
      label: 'Consumo de Contratos',
      path: '/contracts/consumption',
      icon: Gauge,
      show: permissions.canReadModule('clients'),
    },
    {
      label: 'Dashboard de Contratos',
      path: '/contracts/dashboard',
      icon: CalendarClock,
      show: permissions.canReadModule('clients'),
    },
  ]

  const clientGroupVisible =
    !permissions.isModuleHidden('clients') && clientSubmenuItems.some((i) => i.show)

  const chamadosSubmenuItems = [
    {
      label: 'Fila de Tickets',
      path: '/tickets',
      icon: Ticket,
      show: permissions.canReadModule('tickets'),
    },
    {
      label: 'Tickets Programados',
      path: '/tickets/scheduled',
      icon: CalendarClock,
      show: permissions.canReadModule('tickets'),
    },
    {
      label: 'Chamados Retidos',
      path: '/tickets/retained',
      icon: ShieldAlert,
      show: permissions.isAdmin || permissions.isGestor,
    },
    {
      label: 'Abrir Chamado',
      path: '/chamados/novo',
      icon: PlusCircle,
      show: permissions.canWriteModule('tickets'),
    },
    {
      label: 'Categorias',
      path: '/categorias',
      icon: Tags,
      show: permissions.canManageCategories,
    },
    {
      label: 'Catálogo de Atividades',
      path: '/catalogo',
      icon: ListTree,
      show: permissions.canManageCategories,
    },
    {
      label: 'Aprovações',
      path: '/tickets/approvals',
      icon: ShieldCheck,
      show: permissions.canReadModule('tickets'),
    },
  ]

  const dashboardSubmenuItems = [
    {
      label: 'Dashboard Gerencial',
      path: '/dashboard-gerencial',
      icon: LayoutDashboard,
      show: permissions.canReadModule('dashboard'),
    },
    {
      label: 'Painel de Tickets',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: permissions.canReadModule('dashboard'),
    },
  ]

  const chamadosGroupVisible =
    !permissions.isModuleHidden('tickets') && chamadosSubmenuItems.some((i) => i.show)

  const cmdbSubmenuItems = [
    {
      label: 'Ativos',
      path: '/cmdb/assets',
      icon: Server,
      show: permissions.canReadModule('cmdb'),
    },
    {
      label: 'Itens de Configuração',
      path: '/cmdb/configuration-items',
      icon: Boxes,
      show: permissions.canReadModule('cmdb'),
    },
    {
      label: 'Cofre de Senhas',
      path: '/vault',
      icon: Lock,
      show: permissions.canAccessVault,
    },
  ]
  const cmdbGroupVisible =
    !permissions.isModuleHidden('cmdb') && cmdbSubmenuItems.some((i) => i.show)

  const changesSubmenuItems = [
    {
      label: 'Dashboard de Mudanças',
      path: '/changes',
      icon: LayoutDashboard,
      show: permissions.canReadModule('changes'),
    },
    {
      label: 'Requisições de Mudança (RDM)',
      path: '/changes/list',
      icon: FileText,
      show: permissions.canReadModule('changes'),
    },
    { label: 'Minhas Mudanças', path: '/changes/my', icon: User, show: true },
    {
      label: 'Mudanças Pendentes de Aprovação',
      path: '/changes/pending',
      icon: Clock,
      show: permissions.canReadModule('changes'),
    },
    {
      label: 'Calendário de Mudanças',
      path: '/changes/calendar',
      icon: CalendarClock,
      show: permissions.canReadModule('changes'),
    },
    {
      label: 'Comitê de Mudanças',
      path: '/changes/committee',
      icon: Users,
      show: permissions.canReadModule('changes'),
    },
    {
      label: 'Tipos de Mudança',
      path: '/changes/types',
      icon: Tags,
      show: permissions.canWriteModule('changes'),
    },
    {
      label: 'Catálogo de Mudança Padrão',
      path: '/changes/templates',
      icon: FileCheck,
      show: permissions.canWriteModule('changes'),
    },
    {
      label: 'Relatórios',
      path: '/changes/reports',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Configurações',
      path: '/changes/settings',
      icon: Settings,
      show: permissions.canWriteModule('settings'),
    },
  ]
  const changesGroupVisible =
    !permissions.isModuleHidden('changes') && changesSubmenuItems.some((i) => i.show)

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
    { label: 'Despesas', path: '/visitas-n2/expenses', icon: FileCheck, show: true },
    { label: 'Ordens de Serviço', path: '/visitas-n2/service-orders', icon: FileText, show: true },
    { label: 'Assinaturas', path: '/visitas-n2/signatures', icon: CheckCheck, show: true },
    { label: 'Checklists de Visita', path: '/visitas-n2/checklists', icon: ListTree, show: true },
    { label: 'Visitas Recorrentes', path: '/visitas-n2/recurring', icon: RefreshCw, show: true },
    {
      label: 'Disponibilidade de Operadores',
      path: '/visitas-n2/availability',
      icon: Clock,
      show: true,
    },
    { label: 'Taxas de KM', path: '/visitas-n2/km-rates', icon: Gauge, show: true },
    { label: 'Relatórios', path: '/visitas-n2/reports', icon: BarChart3, show: true },
  ]
  const visitsN2GroupVisible = true

  const adminSubmenuItems = [
    {
      label: 'Operadores',
      path: '/operators',
      icon: Users,
      show: permissions.canReadModule('operators') || permissions.isAdmin,
    },
    {
      label: 'Perfis de Acesso',
      path: '/profiles',
      icon: Shield,
      show: permissions.canReadModule('profiles') || permissions.isAdmin,
    },
  ]
  const adminGroupVisible =
    (!permissions.isModuleHidden('operators') || !permissions.isModuleHidden('profiles')) &&
    adminSubmenuItems.some((i) => i.show)

  const configuracoesSubmenuItems = [
    {
      label: 'Caixa de E-mail & IMAP',
      path: '/settings?tab=email',
      icon: Mail,
      show: permissions.canWriteModule('settings'),
    },
    {
      label: 'Configurações de SLA',
      path: '/settings/sla',
      icon: Clock,
      show: permissions.canWriteModule('settings'),
    },
    {
      label: 'Central de Automações',
      path: '/automations',
      icon: Workflow,
      show: permissions.canManageAutomations,
    },
    { label: 'Filas', path: '/queues', icon: Inbox, show: permissions.canManageQueues },
    {
      label: 'Bloqueio de Clientes',
      path: '/blocking',
      icon: ShieldOff,
      show: permissions.isAdmin,
    },
    {
      label: 'Notificações',
      path: '/notifications',
      icon: Bell,
      show: !permissions.isModuleHidden('notifications'),
    },
    {
      label: 'Design & Cores',
      path: '/settings?tab=design',
      icon: Palette,
      show: permissions.canWriteModule('settings'),
    },
    {
      label: 'Configurações Gerais',
      path: '/settings',
      icon: Settings,
      show: permissions.canWriteModule('settings'),
    },
  ]
  const relatoriosSubmenuItems = [
    {
      label: 'Relatórios Gerenciais',
      path: '/reports',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Funcionalidades Implantadas',
      path: '/reports/implemented-features',
      icon: FileText,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Auditoria de Alertas',
      path: '/reports/alert-audit',
      icon: FileSearch,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Relatórios por Filial',
      path: '/reports/unit',
      icon: BarChart3,
      show: permissions.canAccessUnitReports && permissions.canReadModule('reports'),
    },
    {
      label: 'Dashboard de SLA',
      path: '/sla-dashboard',
      icon: BarChart3,
      show: permissions.canReadModule('sla_dashboard'),
    },
    {
      label: 'Metas de SLA',
      path: '/sla-goals',
      icon: BarChart3,
      show: permissions.canReadModule('sla_dashboard'),
    },
    {
      label: 'Atividades Recorrentes',
      path: '/recurrent-activities',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Relatórios Agendados',
      path: '/scheduled-reports',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Relatório Mensal do Cliente',
      path: '/reports/monthly-client',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
    {
      label: 'Extração de Clientes',
      path: '/reports/clients',
      icon: BarChart3,
      show: permissions.canReadModule('reports'),
    },
  ]
  const relatoriosGroupVisible =
    !permissions.isModuleHidden('reports') &&
    !permissions.isModuleHidden('sla_dashboard') &&
    relatoriosSubmenuItems.some((i) => i.show)

  const configuracoesGroupVisible = configuracoesSubmenuItems.some((i) => i.show)

  const teamIdx = navItems.findIndex((i) => i.path === '/manager-dashboard')
  const navBeforeClient = navItems.slice(0, teamIdx).filter((i) => i.show)
  const navAfterClient = navItems.slice(teamIdx).filter((i) => i.show)

  const renderSubItem = (sub: any, currentFull?: string) => {
    const SubIcon = sub.icon
    const subActive = currentFull
      ? currentFull === sub.path ||
        (location.pathname === sub.path && !location.search && !sub.path.includes('?'))
      : location.pathname === sub.path
    return (
      <Link
        key={sub.path}
        to={sub.path}
        onClick={() => setMobileOpen(false)}
        data-nav-active={subActive ? 'true' : undefined}
        style={
          subActive
            ? {
                color: activeItemColor,
                backgroundColor: 'rgba(217, 119, 6, 0.14)',
              }
            : {
                color: customSidebarText,
              }
        }
        className={`relative flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
          subActive
            ? 'bg-primary/20 text-primary font-semibold shadow-xs ring-1 ring-primary/30'
            : 'hover:bg-sidebar-accent hover:text-sidebar-foreground'
        }`}
      >
        <SubIcon
          style={{ color: subActive ? activeItemColor : customSidebarText || undefined }}
          className={`h-3.5 w-3.5 shrink-0 ${subActive ? 'text-primary' : 'opacity-85'}`}
        />
        <span className="truncate">{sub.label}</span>
      </Link>
    )
  }

  const renderNavItem = (item: any) => {
    const Icon = item.icon
    const active = location.pathname === item.path
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileOpen(false)}
        data-nav-active={active ? 'true' : undefined}
        style={
          active
            ? {
                color: activeItemColor,
                borderColor: 'rgba(217, 119, 6, 0.35)',
                backgroundColor: 'rgba(217, 119, 6, 0.14)',
              }
            : {
                color: customSidebarText,
              }
        }
        className={`relative flex items-center gap-3 mx-2 my-0.5 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary font-semibold shadow-xs shadow-primary/10 ring-1 ring-primary/30'
            : 'hover:bg-sidebar-accent hover:text-sidebar-foreground'
        }`}
      >
        {active && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
            style={{
              backgroundColor: activeItemColor,
              boxShadow: `0 0 8px ${activeItemColor}`,
            }}
          />
        )}
        <Icon
          style={{ color: active ? activeItemColor : customSidebarText || undefined }}
          className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-primary' : 'opacity-85'}`}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  // Tema oficial Amber Alert: barra lateral branca (#FFFFFF), textos/ícones #92400E, item ativo #d97706
  const customSidebarBg = designSettings?.sidebar_bg_color || '#FFFFFF'
  const customSidebarText = designSettings?.sidebar_text_color || '#92400E'
  const activeItemColor = '#d97706'

  const navContent = (
    <div
      className="flex h-full flex-col border-r border-sidebar-border relative backdrop-blur transition-colors duration-200"
      style={{
        backgroundColor: customSidebarBg || undefined,
        color: customSidebarText || undefined,
      }}
    >
      <div
        className="flex h-16 items-center px-4 border-b border-sidebar-border/80"
        style={{
          backgroundColor: customSidebarBg ? `${customSidebarBg}ee` : undefined,
        }}
      >
        <Link to="/" className="flex items-center gap-2.5 group w-full overflow-hidden">
          {designSettings?.logo_url ? (
            <div className="relative flex items-center max-h-11">
              <img
                src={designSettings.logo_url}
                alt="Logotipo"
                className="h-9 w-auto max-w-[190px] object-contain drop-shadow-[0_0_8px_hsl(var(--primary)/0.25)] transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: '#d97706',
                  boxShadow: '0 0 8px rgba(217, 119, 6, 0.6)',
                }}
              />
              <span
                className="text-base font-bold tracking-tight truncate transition-colors group-hover:opacity-90"
                style={{ color: customSidebarText }}
              >
                ITSM Desk
              </span>
            </div>
          )}
        </Link>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto py-2 scroll-smooth">
        {navBeforeClient.map(renderNavItem)}
        {
          <div key="dashboard-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setDashboardMenuOpen(!dashboardMenuOpen)}
                data-nav-active={
                  dashboardSubmenuItems.some((i) => location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  dashboardSubmenuItems.some((i) => location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  dashboardSubmenuItems.some((i) => location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <LayoutDashboard
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: dashboardSubmenuItems.some((i) => location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Dashboard</span>
                {dashboardMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: dashboardSubmenuItems.some((i) => location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: dashboardSubmenuItems.some((i) => location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {dashboardMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {dashboardSubmenuItems.map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        }
        {chamadosGroupVisible && (
          <div key="chamados-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setChamadosMenuOpen(!chamadosMenuOpen)}
                data-nav-active={
                  chamadosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  chamadosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  chamadosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Ticket
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: chamadosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Tickets</span>
                {chamadosMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: chamadosSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: chamadosSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {chamadosMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {chamadosSubmenuItems
                  .filter((i) => i.show)
                  .map((sub) => {
                    const currentFull = `${location.pathname}${location.search}`
                    return renderSubItem(sub, currentFull)
                  })}
              </div>
            )}
          </div>
        )}
        {clientGroupVisible && (
          <div key="cliente-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setClientMenuOpen(!clientMenuOpen)}
                data-nav-active={
                  clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Building2
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Cliente</span>
                {clientMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: clientSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {clientMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {clientSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {cmdbGroupVisible && (
          <div key="cmdb-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setCmdbMenuOpen(!cmdbMenuOpen)}
                data-nav-active={
                  cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Server
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">CMDB</span>
                {cmdbMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: cmdbSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {cmdbMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {cmdbSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {changesGroupVisible && (
          <div key="changes-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setChangesMenuOpen(!changesMenuOpen)}
                data-nav-active={
                  changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <GitBranch
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Gestão de Mudanças</span>
                {changesMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: changesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {changesMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {changesSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {problemsGroupVisible && (
          <div key="problems-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setProblemsMenuOpen(!problemsMenuOpen)}
                data-nav-active={
                  problemsSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  problemsSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  problemsSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Bug
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: problemsSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Gestão de Problemas</span>
                {problemsMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: problemsSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: problemsSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {problemsMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {problemsSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {visitsN2GroupVisible && (
          <div key="visits-n2-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setVisitsN2MenuOpen(!visitsN2MenuOpen)}
                data-nav-active={
                  visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <MapPin
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Gestão de Visitas</span>
                {visitsN2MenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: visitsN2SubmenuItems.some((i) => location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {visitsN2MenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {visitsN2SubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {relatoriosGroupVisible && (
          <div key="relatorios-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setRelatoriosMenuOpen(!relatoriosMenuOpen)}
                data-nav-active={
                  relatoriosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  relatoriosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  relatoriosSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <FileBarChart
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: relatoriosSubmenuItems.some(
                      (i) => i.show && location.pathname === i.path,
                    )
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Relatórios</span>
                {relatoriosMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: relatoriosSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: relatoriosSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {relatoriosMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {relatoriosSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
        {navAfterClient.map(renderNavItem)}

        {/* Grupo Administração (Operadores e Perfis de Acesso) */}
        {adminGroupVisible && (
          <div key="administracao-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                data-nav-active={
                  adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Shield
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Administração</span>
                {adminMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: adminSubmenuItems.some((i) => i.show && location.pathname === i.path)
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {adminMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {adminSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}

        {configuracoesGroupVisible && (
          <div key="configuracoes-group" className="my-0.5">
            <div className="flex items-center px-2">
              <button
                onClick={() => setConfiguracoesMenuOpen(!configuracoesMenuOpen)}
                data-nav-active={
                  configuracoesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'true'
                    : undefined
                }
                style={
                  configuracoesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? {
                        color: activeItemColor,
                        backgroundColor: 'rgba(217, 119, 6, 0.14)',
                      }
                    : {
                        color: customSidebarText,
                      }
                }
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  configuracoesSubmenuItems.some((i) => i.show && location.pathname === i.path)
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Settings
                  className="h-4 w-4 shrink-0 text-primary"
                  style={{
                    color: configuracoesSubmenuItems.some(
                      (i) => i.show && location.pathname === i.path,
                    )
                      ? activeItemColor
                      : customSidebarText || undefined,
                  }}
                />
                <span className="truncate">Configurações</span>
                {configuracoesMenuOpen ? (
                  <ChevronDown
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: configuracoesSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                ) : (
                  <ChevronRight
                    className="ml-auto h-3.5 w-3.5 opacity-75"
                    style={{
                      color: configuracoesSubmenuItems.some(
                        (i) => i.show && location.pathname === i.path,
                      )
                        ? activeItemColor
                        : customSidebarText || undefined,
                    }}
                  />
                )}
              </button>
            </div>
            {configuracoesMenuOpen && (
              <div className="ml-4 pl-2 my-1 border-l border-sidebar-border/70 space-y-0.5">
                {configuracoesSubmenuItems.filter((i) => i.show).map((sub) => renderSubItem(sub))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div
        className="px-4 py-3 border-t border-sidebar-border/80 flex items-center justify-between"
        style={{
          backgroundColor: customSidebarBg ? `${customSidebarBg}cc` : undefined,
        }}
      >
        <p className="text-[10px] font-mono opacity-70" style={{ color: customSidebarText }}>
          ITSM Desk
        </p>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-mono"
          style={{ color: customSidebarText }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse shadow-xs"
            style={{
              backgroundColor: '#d97706',
              boxShadow: '0 0 6px rgba(217, 119, 6, 0.7)',
            }}
          />
          ONLINE
        </span>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      {!isMobile && (
        <aside className="sticky top-0 h-screen w-64 flex-shrink-0 border-r border-sidebar-border shadow-xl shadow-black/20 z-30">
          {navContent}
        </aside>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-card/80 backdrop-blur-md px-4 md:px-6 transition-colors duration-300 shadow-xs">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-sidebar-accent">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="p-0 w-64 border-r border-sidebar-border bg-sidebar"
                >
                  {navContent}
                </SheetContent>
              </Sheet>
            )}
            <div className="flex items-center gap-2.5">
              {designSettings?.logo_url ? (
                <img
                  src={designSettings.logo_url}
                  alt="Logotipo"
                  className="h-7 w-auto max-w-[120px] object-contain hidden md:block mr-1 opacity-90 hover:opacity-100 transition-opacity"
                />
              ) : null}
              <span className="hidden sm:inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                {[
                  ...navItems,
                  ...dashboardSubmenuItems,
                  ...clientSubmenuItems,
                  ...cmdbSubmenuItems,
                  ...chamadosSubmenuItems,
                  ...changesSubmenuItems,
                  ...problemsSubmenuItems,
                  ...visitsN2SubmenuItems,
                  ...relatoriosSubmenuItems,
                  ...adminSubmenuItems,
                  ...configuracoesSubmenuItems,
                ].find((i) => i.path === `${location.pathname}${location.search}`)?.label ||
                  [
                    ...navItems,
                    ...dashboardSubmenuItems,
                    ...clientSubmenuItems,
                    ...cmdbSubmenuItems,
                    ...chamadosSubmenuItems,
                    ...changesSubmenuItems,
                    ...problemsSubmenuItems,
                    ...visitsN2SubmenuItems,
                    ...relatoriosSubmenuItems,
                    ...adminSubmenuItems,
                    ...configuracoesSubmenuItems,
                  ].find((i) => i.path === location.pathname)?.label ||
                  'Painel'}{' '}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer de atualização automática com opções e botão manual ao lado do sino de notificações */}
            <RefreshIndicator />

            {/* Botão de silenciar voz e alertas de tela ao lado do sino de notificações */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={muteLoading}
                  onClick={async () => {
                    await toggleMute()
                    if (!isMuted) {
                      toast({
                        title: 'Notificações Silenciadas',
                        description: 'A voz e os popups de alerta foram desativados para você.',
                      })
                    } else {
                      toast({
                        title: 'Notificações Ativadas',
                        description: 'A voz e os popups de alerta foram reativados.',
                      })
                    }
                  }}
                  className={`relative transition-colors duration-200 ${
                    isMuted
                      ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label={isMuted ? 'Ativar notificações' : 'Silenciar notificações'}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5 text-red-500 animate-in fade-in zoom-in-75 duration-200" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                  {isMuted && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">
                  {isMuted
                    ? 'Ativar notificações (Voz e popups silenciados)'
                    : 'Silenciar notificações (Desativa voz e popups)'}
                </p>
              </TooltipContent>
            </Tooltip>

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
                <DropdownMenuItem
                  onClick={() => navigate('/notifications')}
                  className="text-primary text-xs justify-center"
                >
                  Ver todas as notificações
                </DropdownMenuItem>
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
