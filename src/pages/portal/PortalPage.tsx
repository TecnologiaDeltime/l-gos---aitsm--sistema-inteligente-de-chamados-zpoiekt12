import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LifeBuoy,
  Plus,
  Clock,
  CheckCircle2,
  CalendarDays,
  Server,
  FileText,
  LogOut,
  Building2,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Sun,
  Moon,
  AlertCircle,
  Eye,
  ChevronRight,
  TrendingUp,
  MapPin,
  CheckCircle,
  XCircle,
  Wrench,
  ArrowLeft,
  Building,
  AlertTriangle,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getClientPortalData, getClientHoursBalance, PortalData } from '@/services/client-portal'
import { CompanyRecord, getCompanies } from '@/services/companies'
import { TicketRecord } from '@/services/tickets'
import { formatDateTime } from '@/lib/date-format'

// Sub-componentes
import TicketPublicDetailDialog from '@/components/portal/TicketPublicDetailDialog'
import PortalNewTicketDialog from '@/components/portal/PortalNewTicketDialog'
import PortalApprovalsTab from '@/components/portal/PortalApprovalsTab'
import PortalAssetsTab from '@/components/portal/PortalAssetsTab'
import PortalVisitsTab from '@/components/portal/PortalVisitsTab'
import PortalHoursTab from '@/components/portal/PortalHoursTab'

export default function PortalPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const { theme, toggleTheme, designSettings } = useTheme()
  const { toast } = useToast()

  // Verificação estrita de Administrador para o Modo Suporte
  const isAdmin = user?.role === 'admin'

  // Lista de empresas para seleção no modo suporte
  const [availableCompanies, setAvailableCompanies] = useState<CompanyRecord[]>([])

  // Empresa ativa no modo suporte (URL query param ou sessionStorage)
  const initialCompanyFromUrl = searchParams.get('company')
  const initialCompanyFromStorage = isAdmin
    ? sessionStorage.getItem('itsm_portal_support_company')
    : null
  const [supportCompanyId, setSupportCompanyId] = useState<string>(
    isAdmin ? initialCompanyFromUrl || initialCompanyFromStorage || '' : '',
  )

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'tickets' | 'approvals' | 'assets' | 'visits' | 'hours'
  >('tickets')

  // Dados do portal
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Período de horas
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [hoursData, setHoursData] = useState({
    contractedHours: 0,
    consumedHours: 0,
    balanceHours: 0,
    percentUsed: 0,
    periodName: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    hasContract: false,
  })
  const [hoursLoading, setHoursLoading] = useState(false)

  // Modais
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null)
  const [newTicketOpen, setNewTicketOpen] = useState(false)

  // Filtros de chamados
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('todos')

  // Identificação do usuário
  const isFocalPoint =
    user?.role === 'cliente_gestor' || user?.role === 'admin' || user?.role === 'gestor'

  // Efetiva empresa vinculada (no modo suporte usa a selecionada; caso contrário, a empresa do usuário)
  const effectiveCompanyId =
    isAdmin && supportCompanyId
      ? supportCompanyId
      : user?.company || (data?.company?.id as string) || ''

  const companyName = data?.company?.trade_name || data?.company?.legal_name || 'Sua Empresa'

  // Carrega lista de empresas caso seja Administrador
  useEffect(() => {
    if (isAdmin) {
      getCompanies('status = "Ativo" || status = null')
        .then((comps) => {
          setAvailableCompanies(comps)
          // Se ainda não tinha empresa selecionada e tem lista, seleciona a primeira
          if (!supportCompanyId && comps.length > 0) {
            const firstId = comps[0].id
            setSupportCompanyId(firstId)
            sessionStorage.setItem('itsm_portal_support_company', firstId)
          }
        })
        .catch((err) => {
          console.warn('Erro ao carregar lista de empresas para suporte:', err)
        })
    }
  }, [isAdmin])

  // Atualiza query param na URL quando admin altera a empresa
  const handleSelectSupportCompany = (companyId: string) => {
    setSupportCompanyId(companyId)
    sessionStorage.setItem('itsm_portal_support_company', companyId)
    setSearchParams({ company: companyId })
  }

  // Carregar dados
  const loadPortalData = async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const targetCompany = isAdmin && supportCompanyId ? supportCompanyId : undefined
      const portalResult = await getClientPortalData(user, targetCompany)
      setData(portalResult)

      // Atualiza o supportCompanyId se o serviço escolheu uma empresa e ainda não tínhamos uma definida
      if (isAdmin && !supportCompanyId && portalResult.company?.id) {
        setSupportCompanyId(portalResult.company.id)
        sessionStorage.setItem('itsm_portal_support_company', portalResult.company.id)
      }

      // Se temos empresa, busca dados de horas para o período selecionado
      if (portalResult.company?.id) {
        setHoursLoading(true)
        const balance = await getClientHoursBalance(
          portalResult.company.id,
          selectedMonth,
          selectedYear,
        )
        setHoursData(balance)
        setHoursLoading(false)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do portal:', err)
      toast({
        title: 'Erro ao carregar dados',
        description:
          err?.message || 'Não foi possível carregar as informações do portal do cliente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Recarregar horas quando o período muda
  const handleChangePeriod = async (month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
    if (!data?.company?.id) return

    try {
      setHoursLoading(true)
      const balance = await getClientHoursBalance(data.company.id, month, year)
      setHoursData(balance)
    } catch (err) {
      console.error('Erro ao atualizar período de horas:', err)
    } finally {
      setHoursLoading(false)
    }
  }

  useEffect(() => {
    loadPortalData()
  }, [user, supportCompanyId])

  const handleReturnToInternalSystem = () => {
    navigate('/dashboard')
  }

  const handleLogout = () => {
    logout()
    navigate('/portal/login')
  }

  // Filtragem dos chamados
  const tickets = data?.tickets || []
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.number.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.description?.toLowerCase().includes(ticketSearch.toLowerCase())

    const matchesStatus =
      ticketStatusFilter === 'todos' ||
      (ticketStatusFilter === 'abertos' &&
        t.status !== 'Resolvido' &&
        t.status !== 'Fechado' &&
        t.status !== 'Cancelado') ||
      (ticketStatusFilter === 'concluidos' &&
        (t.status === 'Resolvido' || t.status === 'Fechado')) ||
      t.status === ticketStatusFilter

    return matchesSearch && matchesStatus
  })

  // Contadores
  const pendingApprovalsCount = (data?.approvals || []).filter(
    (a) => a.status === 'Pendente',
  ).length
  const scheduledVisitsCount = (data?.technicalVisits || []).filter(
    (v) => v.status === 'Agendada' || v.status === 'Em Andamento',
  ).length
  const activeTicketsCount = tickets.filter(
    (t) => t.status !== 'Resolvido' && t.status !== 'Fechado' && t.status !== 'Cancelado',
  ).length

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* =========================================================================
          BARRA DE MODO SUPORTE / IMPERSONAÇÃO — EXCLUSIVO ADMINISTRADOR
          ========================================================================= */}
      {isAdmin && (
        <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-medium shadow-sm border-b border-amber-700/40 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 font-mono font-bold text-[11px] tracking-wider uppercase shadow-xs">
                <Wrench className="h-3.5 w-3.5 text-amber-400" />
                Modo Suporte • Administrador
              </span>
              <span className="text-slate-950 font-semibold hidden md:inline">
                Visualizando o portal exatamente com a visão do cliente para aferir erros e
                manutenção.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Seletor de Empresa para Alternar Rapidamente */}
              <div className="flex items-center gap-1.5 bg-slate-950/10 px-2 py-1 rounded-md border border-slate-950/20">
                <Building className="h-3.5 w-3.5 text-slate-950" />
                <span className="text-[11px] font-bold text-slate-950 hidden sm:inline">
                  Empresa:
                </span>
                <Select
                  value={supportCompanyId || effectiveCompanyId}
                  onValueChange={handleSelectSupportCompany}
                >
                  <SelectTrigger className="h-7 text-[11px] bg-slate-950 text-amber-200 border-none font-semibold min-w-[180px] max-w-[240px]">
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.trade_name || c.legal_name || c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão de Saída Rápida de Volta ao Sistema Interno */}
              <Button
                size="sm"
                onClick={handleReturnToInternalSystem}
                className="h-7 text-xs bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold border border-amber-400/40 gap-1.5 shadow-xs"
                title="Voltar ao Dashboard / Atendimento do sistema ITSM"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao Sistema Interno
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CABEÇALHO OFICIAL: Grafite #17181C com letras âmbar/brancas
          ========================================================================= */}
      <header
        className={`w-full border-b border-amber-500/20 bg-[#17181C] text-amber-100 shadow-md ${!isAdmin ? 'sticky top-0 z-40' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo e Nome da Empresa */}
          <div className="flex items-center gap-3">
            {designSettings?.logo_url ? (
              <img
                src={designSettings.logo_url}
                alt="Logo"
                className="h-8 max-w-[120px] object-contain drop-shadow"
              />
            ) : (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                <LifeBuoy className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-amber-400 uppercase">
                  Portal do Cliente
                </span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                  {companyName}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Central Integrada de Chamados, Ativos, Visitas e Horas
              </p>
            </div>
          </div>

          {/* Ações do Topo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão Novo Chamado Destaque */}
            <Button
              size="sm"
              onClick={() => setNewTicketOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm shadow-amber-600/30 gap-1.5 h-8 sm:h-9"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Abrir Chamado</span>
            </Button>

            {/* Alternador de tema oficial */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="border-zinc-700 bg-zinc-800/80 text-amber-300 hover:bg-zinc-700 hover:text-amber-200 h-8 w-8 sm:h-9 sm:w-9"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Recarregar dados */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadPortalData(true)}
              disabled={refreshing}
              className="border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 h-8 w-8 sm:h-9 sm:w-9"
              title="Atualizar Informações"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </Button>

            {/* Usuário / Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-700">
              <div className="text-right hidden md:block">
                <span className="text-xs font-semibold text-zinc-100 block leading-tight">
                  {user?.name || 'Cliente'}
                </span>
                <span className="text-[10px] text-amber-400">
                  {isFocalPoint ? 'Ponto Focal' : 'Solicitante'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 h-8 w-8 sm:h-9 sm:w-9"
                title="Sair do Portal"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          CORPO PRINCIPAL: Abas dos 6 Módulos do Usuário
          ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner de Boas-vindas com Resumo Rápido */}
        <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Olá, {user?.name || 'Cliente'}!</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bem-vindo à área de atendimento da <strong>{companyName}</strong>. Aqui você
                gerencia solicitações, valida aprovações e audita o consumo de horas.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 py-1 px-2.5 text-xs font-semibold"
              >
                {isFocalPoint ? 'Perfil: Ponto Focal Autorizado' : 'Perfil: Solicitante'}
              </Badge>
            </div>
          </div>

          {/* Cards de atalho e contadores rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeTab === 'tickets'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                <span>Chamados Ativos</span>
                <LifeBuoy className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-xl font-bold text-foreground">{activeTicketsCount}</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeTab === 'approvals'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                <span>Aprovações</span>
                <ShieldCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">{pendingApprovalsCount}</span>
                {pendingApprovalsCount > 0 && (
                  <Badge className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0 font-bold">
                    Pendente
                  </Badge>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('visits')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeTab === 'visits'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                <span>Visitas Agendadas</span>
                <CalendarDays className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-xl font-bold text-foreground">{scheduledVisitsCount}</span>
            </button>

            <button
              onClick={() => setActiveTab('hours')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeTab === 'hours'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                <span>Saldo de Horas</span>
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-foreground">{hoursData.balanceHours}h</span>
                <span className="text-[11px] text-muted-foreground">({hoursData.periodName})</span>
              </div>
            </button>
          </div>
        </div>

        {/* =========================================================================
            NAVEGAÇÃO POR ABAS (TABS)
            ========================================================================= */}
        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="space-y-4"
        >
          <div className="border-b border-border/80 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-2 sm:gap-4 flex justify-start">
              <TabsTrigger
                value="tickets"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-none px-3 py-2.5 text-xs sm:text-sm font-semibold gap-2"
              >
                <LifeBuoy className="h-4 w-4" />
                Meus Chamados ({tickets.length})
              </TabsTrigger>

              <TabsTrigger
                value="approvals"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-none px-3 py-2.5 text-xs sm:text-sm font-semibold gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Aprovações
                {pendingApprovalsCount > 0 && (
                  <Badge className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0 font-bold ml-1">
                    {pendingApprovalsCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="assets"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-none px-3 py-2.5 text-xs sm:text-sm font-semibold gap-2"
              >
                <Server className="h-4 w-4" />
                Meus Ativos (CMDB) ({data?.configurationItems?.length || 0})
              </TabsTrigger>

              <TabsTrigger
                value="visits"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-none px-3 py-2.5 text-xs sm:text-sm font-semibold gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Visitas Técnicas ({data?.technicalVisits?.length || 0})
              </TabsTrigger>

              <TabsTrigger
                value="hours"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-none px-3 py-2.5 text-xs sm:text-sm font-semibold gap-2"
              >
                <Clock className="h-4 w-4" />
                Horas e Franquia ({hoursData.periodName})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* =========================================================================
              ABA 1: MEUS CHAMADOS (Lista + Andamento + Logs Públicos)
              ========================================================================= */}
          <TabsContent value="tickets" className="space-y-4 mt-0">
            {/* Filtros e Ações de Chamados */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-3 sm:p-4 shadow-2xs">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, título ou assunto..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-[160px] text-xs h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="abertos">Apenas Abertos</SelectItem>
                    <SelectItem value="concluidos">Concluídos</SelectItem>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Aguardando Solicitante">Aguardando Você</SelectItem>
                    <SelectItem value="Resolvido">Resolvido</SelectItem>
                    <SelectItem value="Fechado">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                onClick={() => setNewTicketOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 h-9"
              >
                <Plus className="h-4 w-4" />
                Abrir Novo Chamado
              </Button>
            </div>

            {/* Listagem de Chamados */}
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl">
                Carregando chamados...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl space-y-3">
                <LifeBuoy className="h-8 w-8 text-muted-foreground mx-auto opacity-60" />
                <p className="font-semibold text-sm text-foreground">Nenhum chamado localizado</p>
                <p className="text-muted-foreground">
                  {ticketSearch || ticketStatusFilter !== 'todos'
                    ? 'Nenhum chamado corresponde aos filtros aplicados.'
                    : 'Sua empresa ainda não possui chamados registrados.'}
                </p>
                <Button
                  size="sm"
                  onClick={() => setNewTicketOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
                >
                  <Plus className="h-4 w-4" /> Abrir Primeiro Chamado
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTickets.map((ticket) => {
                  const isClosed = ticket.status === 'Resolvido' || ticket.status === 'Fechado'
                  const isWaitingClient = ticket.status === 'Aguardando Solicitante'

                  return (
                    <Card
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="cursor-pointer transition-all hover:border-amber-500/50 hover:shadow-sm bg-card"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                                #{ticket.number}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  isClosed
                                    ? 'bg-muted text-muted-foreground'
                                    : isWaitingClient
                                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold'
                                      : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                }
                              >
                                {ticket.status}
                              </Badge>
                              {ticket.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {ticket.type}
                                </Badge>
                              )}
                              {ticket.priority && (
                                <span className="text-[11px] text-muted-foreground">
                                  Prioridade: <strong>{ticket.priority}</strong>
                                </span>
                              )}
                            </div>
                            <CardTitle className="text-base font-semibold text-foreground">
                              {ticket.title}
                            </CardTitle>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-amber-600 dark:text-amber-400 gap-1 h-8"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver Andamento e Logs
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground">
                        <p className="line-clamp-2 text-foreground/80 leading-relaxed">
                          {ticket.description}
                        </p>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span>
                            Aberto em: <strong>{formatDateTime(ticket.created)}</strong>
                          </span>
                          {ticket.expand?.category?.name && (
                            <span>
                              Categoria: <strong>{ticket.expand.category.name}</strong>
                            </span>
                          )}
                          {ticket.requester_name && (
                            <span className="hidden sm:inline">
                              Solicitante: <strong>{ticket.requester_name}</strong>
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* =========================================================================
              ABA 2: APROVAÇÕES DOS PONTOS FOCAIS
              ========================================================================= */}
          <TabsContent value="approvals" className="mt-0">
            <PortalApprovalsTab
              approvals={data?.approvals || []}
              loading={loading}
              onRefresh={() => loadPortalData(true)}
              isFocalPoint={isFocalPoint}
              onOpenTicket={(t) => setSelectedTicket(t)}
            />
          </TabsContent>

          {/* =========================================================================
              ABA 3: MEUS ATIVOS (CMDB)
              ========================================================================= */}
          <TabsContent value="assets" className="mt-0">
            <PortalAssetsTab assets={data?.configurationItems || []} loading={loading} />
          </TabsContent>

          {/* =========================================================================
              ABA 4: VISITAS TÉCNICAS
              ========================================================================= */}
          <TabsContent value="visits" className="mt-0">
            <PortalVisitsTab
              visits={data?.technicalVisits || []}
              loading={loading}
              onOpenTicket={(t) => setSelectedTicket(t)}
            />
          </TabsContent>

          {/* =========================================================================
              ABA 5: HORAS CONTRATADAS × CONSUMIDAS × SALDO
              ========================================================================= */}
          <TabsContent value="hours" className="mt-0">
            <PortalHoursTab
              hoursData={hoursData}
              loading={hoursLoading}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChangePeriod={handleChangePeriod}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* =========================================================================
          RODAPÉ DO PORTAL
          ========================================================================= */}
      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground mt-auto bg-card/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{companyName} • Portal do Cliente do Sistema ITSM LUIZ</span>
          <span className="text-[11px]">
            Logs transparentes, segurança e conformidade operacional.
          </span>
        </div>
      </footer>

      {/* Modal de Detalhes Públicos e Logs Públicos do Chamado (sem anotações internas) */}
      {selectedTicket && (
        <TicketPublicDetailDialog
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTicket(null)
              loadPortalData(true)
            }
          }}
        />
      )}

      {/* Modal de Novo Chamado Amarrado à Empresa */}
      <PortalNewTicketDialog
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        companyId={effectiveCompanyId}
        companyName={companyName}
        user={{
          id: user?.id || '',
          name: user?.name || '',
          email: user?.email || '',
          unit: user?.unit,
          phone: user?.phone,
        }}
        categories={data?.categories || []}
        assets={data?.configurationItems || []}
        onSuccess={() => loadPortalData(true)}
      />
    </div>
  )
}
