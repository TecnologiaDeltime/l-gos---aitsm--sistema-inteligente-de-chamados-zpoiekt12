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
  const [clientMenuOpen, setClientMenuOpen] = useState(true)
  const [chamadosMenuOpen, setChamadosMenuOpen] = useState(true)

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
    { label: 'Equipe', path: '/team', icon: Users, show: permissions.canManageTeam },
    { label: 'Filas', path: '/queues', icon: Inbox, show: permissions.canManageQueues },
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
    { label: 'Importar Ativos', path: '/cmdb/import', icon: Upload, show: permissions.canViewCmdb },
    { label: 'Tipos de Ativo', path: '/cmdb/types', icon: Tags, show: permissions.canManageCmdb },
    { label: 'Base de Conhecimento', path: '/knowledge-base', icon: BookOpen, show: true },
    {
      label: 'Bloqueio de Clientes',
      path: '/blocking',
      icon: ShieldOff,
      show: permissions.isAdmin,
    },
    {
      label: 'Central de Automações',
      path: '/automations',
      icon: Workflow,
      show: permissions.canManageAutomations,
    },
    {
      label: 'Dashboard de Automações',
      path: '/automations/dashboard',
      icon: Workflow,
      show: permissions.canViewAutomations,
    },
    { label: 'Central de Aprovações', path: '/approval-center', icon: FileCheck, show: true },
    {
      label: 'Configurações de SLA',
      path: '/settings/sla',
      icon: Clock,
      show: permissions.isAdmin,
    },
    { label: 'Configurações', path: '/settings', icon: Settings, show: permissions.isAdmin },
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
    { label: 'Painel Geral', path: '/dashboard', icon: LayoutDashboard, show: true },
  ]

  const chamadosGroupVisible = chamadosSubmenuItems.some((i) => i.show)
  const teamIdx = navItems.findIndex((i) => i.path === '/team')
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
        {navAfterClient.map(renderNavItem)}
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
