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
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
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

export default function Layout() {
  const { user, signOut } = useAuth()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

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
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
    { label: 'Chamados', path: '/tickets', icon: Ticket, show: true },
    { label: 'Abrir Chamado', path: '/tickets/new', icon: PlusCircle, show: true },
    { label: 'Clientes', path: '/clients', icon: Building2, show: permissions.canManageClients },
    {
      label: 'Contratos',
      path: '/contracts',
      icon: FileText,
      show: permissions.canManageContracts,
    },
    { label: 'Equipe', path: '/team', icon: Users, show: permissions.canManageTeam },
    { label: 'Filas', path: '/queues', icon: Inbox, show: permissions.canManageQueues },
    { label: 'Categorias', path: '/categories', icon: Tags, show: permissions.canManageCategories },
    { label: 'Relatórios', path: '/reports', icon: BarChart3, show: permissions.canViewReports },
    { label: 'Aprovações', path: '/approvals', icon: FileCheck, show: true },
    { label: 'Visitas Técnicas', path: '/visits', icon: MapPin, show: true },
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
    { label: 'Configurações', path: '/settings', icon: Settings, show: permissions.isAdmin },
  ]

  const navContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <Shield className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-lg tracking-wide">Sistema ITSM</span>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        Sistema ITSM v1.0 &copy; 2026
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 flex-shrink-0 border-r border-slate-800">{navContent}</aside>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6 dark:bg-slate-900">
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
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {navItems.find((i) => i.path === location.pathname)?.label || 'Painel'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
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
                    <span className="text-xs text-blue-600 font-normal">{unreadCount} novas</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto divide-y">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-500">Sem notificações</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 ${
                          !n.read ? 'bg-blue-50/50 font-medium' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-slate-800">{n.title}</p>
                          {!n.read && <CheckCheck className="h-3 w-3 text-blue-600" />}
                        </div>
                        <p className="text-slate-600 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                      {user?.name?.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-[10px] text-slate-500 capitalize">
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

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <AiAssistantDrawer />
    </div>
  )
}
