import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TV_DASHBOARDS_CATALOG,
  loadTvPreferences,
  saveTvPreferences,
  fetchQueueTicketsSummary,
  fetchTicketStatusSummary,
  fetchOnlineUsers,
  fetchClientHoursSummary,
  fetchExecutiveGoalsData,
  fetchChangesSummary,
  fetchProblemsSummary,
  type TvModePreferences,
  type QueueTicketsSummary,
  type TicketStatusSummary,
  type OnlineUserItem,
  type TvMetasData,
  type ChangesSummary,
  type ProblemsSummary,
} from '@/services/tv-mode'
import type { ClientHoursData } from '@/services/client-hours'
import { TvQueueTicketsDashboard } from '@/components/tv/TvQueueTicketsDashboard'
import { TvStatusTicketsDashboard } from '@/components/tv/TvStatusTicketsDashboard'
import { TvOnlineUsersDashboard } from '@/components/tv/TvOnlineUsersDashboard'
import { TvClientHoursDashboard } from '@/components/tv/TvClientHoursDashboard'
import { TvExecutiveGoalsDashboard } from '@/components/tv/TvExecutiveGoalsDashboard'
import { TvChangesDashboard } from '@/components/tv/TvChangesDashboard'
import { TvProblemsDashboard } from '@/components/tv/TvProblemsDashboard'
import { LogosLogoFull } from '@/components/brand/LogosLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Tv,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  X,
  Settings,
  RefreshCw,
  Clock,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'

export function TvModePage() {
  const navigate = useNavigate()

  // Preferências
  const [prefs, setPrefs] = useState<TvModePreferences>(loadTvPreferences())
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false)

  // Relógio
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Dados dos 7 dashboards
  const [loading, setLoading] = useState<boolean>(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const [queueData, setQueueData] = useState<QueueTicketsSummary[]>([])
  const [statusData, setStatusData] = useState<TicketStatusSummary[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserItem[]>([])
  const [clientHours, setClientHours] = useState<ClientHoursData[]>([])
  const [goalsData, setGoalsData] = useState<TvMetasData | null>(null)
  const [changesData, setChangesData] = useState<ChangesSummary | null>(null)
  const [problemsData, setProblemsData] = useState<ProblemsSummary | null>(null)

  // Barra de progresso do timer
  const [timerProgress, setTimerProgress] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // Relógio digital em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Carregar dados de todos os dashboards
  const loadAllData = useCallback(async () => {
    // Trata expiração de sessão de forma graciosa sem quebrar
    if (!pb.authStore.isValid) {
      console.warn('Sessão expirada no Modo TV')
      return
    }

    try {
      setLoading(true)
      const [q, st, onl, ch, g, chg, prob] = await Promise.all([
        fetchQueueTicketsSummary().catch((err) => {
          console.error('Erro queueData:', err)
          return []
        }),
        fetchTicketStatusSummary().catch((err) => {
          console.error('Erro statusData:', err)
          return []
        }),
        fetchOnlineUsers().catch((err) => {
          console.error('Erro onlineUsers:', err)
          return []
        }),
        fetchClientHoursSummary().catch((err) => {
          console.error('Erro clientHours:', err)
          return []
        }),
        fetchExecutiveGoalsData().catch((err) => {
          console.error('Erro goalsData:', err)
          return null
        }),
        fetchChangesSummary().catch((err) => {
          console.error('Erro changesData:', err)
          return null
        }),
        fetchProblemsSummary().catch((err) => {
          console.error('Erro problemsData:', err)
          return null
        }),
      ])

      setQueueData(q)
      setStatusData(st)
      setOnlineUsers(onl)
      setClientHours(ch)
      setGoalsData(g)
      setChangesData(chg)
      setProblemsData(prob)
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Erro ao carregar dados do Modo TV:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Polling automático a cada 45 segundos
  useEffect(() => {
    loadAllData()
    const pollInterval = setInterval(() => {
      loadAllData()
    }, 45000)
    return () => clearInterval(pollInterval)
  }, [loadAllData])

  // Dashboards ativos ordenados
  const activeDashboards = TV_DASHBOARDS_CATALOG.filter((d) =>
    prefs.enabledDashboards.includes(d.id),
  )

  // Avançar dashboard
  const handleNext = useCallback(() => {
    if (activeDashboards.length <= 1) return
    setCurrentIndex((prev) => (prev + 1) % activeDashboards.length)
    setTimerProgress(0)
  }, [activeDashboards.length])

  // Voltar dashboard
  const handlePrev = useCallback(() => {
    if (activeDashboards.length <= 1) return
    setCurrentIndex((prev) => (prev - 1 + activeDashboards.length) % activeDashboards.length)
    setTimerProgress(0)
  }, [activeDashboards.length])

  // Rotação automática e barra de progresso
  useEffect(() => {
    if (!isPlaying || activeDashboards.length <= 1) return

    const intervalSec = Math.max(5, prefs.rotationIntervalSeconds)
    const tickMs = 250
    const step = (tickMs / (intervalSec * 1000)) * 100

    const progressTimer = setInterval(() => {
      setTimerProgress((prev) => {
        if (prev + step >= 100) {
          handleNext()
          return 0
        }
        return prev + step
      })
    }, tickMs)

    return () => clearInterval(progressTimer)
  }, [isPlaying, activeDashboards.length, prefs.rotationIntervalSeconds, handleNext])

  // Monitora Fullscreen API e evento ESCAPE
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Atalhos de teclado (Espaço = play/pause, Setas = navega, Esc = sair/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showConfigModal) return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Escape' && isPlaying) {
        // Se estiver em fullscreen, o navegador já sai do fullscreen
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showConfigModal, isPlaying, handleNext, handlePrev])

  // Alternar tela cheia (Fullscreen)
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen()
        } else {
          await document.documentElement.requestFullscreen()
        }
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Falha ao alternar tela cheia:', err)
    }
  }

  // Iniciar Exibição
  const startPresentation = async () => {
    if (activeDashboards.length === 0) return
    setCurrentIndex(0)
    setTimerProgress(0)
    setIsPlaying(true)
    setShowConfigModal(false)
    try {
      if (containerRef.current && !document.fullscreenElement) {
        await containerRef.current.requestFullscreen().catch(() => {})
      }
    } catch {
      // Ignora erro se navegador bloquear fullscreen sem clique direto
    }
  }

  // Toggle dashboard checkbox
  const toggleDashboard = (id: string) => {
    const exists = prefs.enabledDashboards.includes(id)
    let nextList: string[]
    if (exists) {
      if (prefs.enabledDashboards.length <= 1) return // pelo menos 1
      nextList = prefs.enabledDashboards.filter((x) => x !== id)
    } else {
      nextList = [...prefs.enabledDashboards, id]
    }
    const updated = { ...prefs, enabledDashboards: nextList }
    setPrefs(updated)
    saveTvPreferences(updated)
  }

  // Atualizar intervalo
  const updateInterval = (val: number) => {
    const clean = Math.max(5, Math.min(300, val || 30))
    const updated = { ...prefs, rotationIntervalSeconds: clean }
    setPrefs(updated)
    saveTvPreferences(updated)
  }

  const currentDashboard = activeDashboards[currentIndex] || activeDashboards[0]

  // Renderizar o componente correspondente ao dashboard atual
  const renderCurrentDashboardComponent = () => {
    if (!currentDashboard) {
      return (
        <div className="flex h-full items-center justify-center text-slate-400">
          Nenhum dashboard selecionado. Abra as configurações para habilitar.
        </div>
      )
    }

    switch (currentDashboard.id) {
      case 'queue_tickets':
        return <TvQueueTicketsDashboard data={queueData} loading={loading} />
      case 'status_tickets':
        return <TvStatusTicketsDashboard data={statusData} loading={loading} />
      case 'online_users':
        return <TvOnlineUsersDashboard data={onlineUsers} loading={loading} />
      case 'client_hours':
        return <TvClientHoursDashboard data={clientHours} loading={loading} />
      case 'executive_goals':
        return <TvExecutiveGoalsDashboard data={goalsData} loading={loading} />
      case 'changes_summary':
        return <TvChangesDashboard data={changesData} loading={loading} />
      case 'problems_summary':
        return <TvProblemsDashboard data={problemsData} loading={loading} />
      default:
        return null
    }
  }

  // TELA DE PRÉVIA / CONFIGURAÇÃO (quando não está em exibição e clica em config ou na entrada)
  if (!isPlaying) {
    return (
      <div className="min-h-screen bg-[#0F1013] text-white flex flex-col p-4 lg:p-8">
        {/* Topo da Tela de Configuração */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="bg-black/50 border-white/15 text-slate-300 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar ao Sistema
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <LogosLogoFull monogramClassName="h-8 w-8" textClassName="text-xl" />
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs ml-2">
                  MODO TV · MONITOR
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Exibição contínua em tela cheia com rotação automática de indicadores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="lg"
              onClick={startPresentation}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold shadow-lg shadow-amber-500/20 px-8 text-base"
            >
              <Play className="h-5 w-5 mr-2 fill-black" />
              Iniciar Exibição em Tela Cheia
            </Button>
          </div>
        </div>

        {/* Corpo: Painel de Configurações e Prévia */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 max-w-7xl mx-auto w-full">
          {/* Coluna Esquerda: Seleção dos 7 Dashboards e Intervalo */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-[#17181C] border-amber-500/30 text-white shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-400" />
                  Dashboards na Rotação
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Marque quais painéis entrarão na rotação automática da TV
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5">
                {TV_DASHBOARDS_CATALOG.map((dash) => {
                  const isChecked = prefs.enabledDashboards.includes(dash.id)
                  return (
                    <div
                      key={dash.id}
                      onClick={() => toggleDashboard(dash.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-xs'
                          : 'bg-black/30 border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleDashboard(dash.id)}
                        className="mt-0.5 border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:text-black"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white leading-tight">{dash.title}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-snug">
                          {dash.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Ajuste de Intervalo */}
            <Card className="bg-[#17181C] border-amber-500/30 text-white shadow-xl">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    Tempo por Dashboard
                  </Label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Intervalo de troca automática (segundos)
                  </p>
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min={5}
                    max={300}
                    step={5}
                    value={prefs.rotationIntervalSeconds}
                    onChange={(e) => updateInterval(parseInt(e.target.value, 10))}
                    className="bg-black/60 border-amber-500/40 text-center font-bold text-amber-300 text-lg"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Cartão Informativo e Resumo de Instruções para TV */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-gradient-to-br from-[#17181C] to-black border-amber-500/30 text-white p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Tv className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-amber-300">Modo TV Lógos AITILSM</h3>
                  <p className="text-xs text-slate-400">
                    Preparado para monitores de parede, salas de comando e NOC
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Atalhos e Comportamento na Exibição:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 ml-1">
                    <li>
                      <strong className="text-white">Espaço:</strong> Pausa ou retoma a rotação
                      automática
                    </li>
                    <li>
                      <strong className="text-white">Setas Direita / Esquerda:</strong> Avança ou
                      volta o dashboard
                    </li>
                    <li>
                      <strong className="text-white">Tecla ESC:</strong> Sai da tela cheia ou
                      encerra exibição
                    </li>
                    <li>
                      <strong className="text-white">Atualização em tempo real:</strong> Dados
                      sincronizados a cada 45s
                    </li>
                    <li>
                      <strong className="text-white">Tema Oficial:</strong> Paleta escura de alto
                      contraste Amber Alert
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-300 font-semibold mb-2">
                    Resumo da Rotação Selecionada:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeDashboards.map((d, idx) => (
                      <Badge
                        key={d.id}
                        className="bg-black/60 text-amber-300 border-amber-500/30 text-xs py-1 px-2.5"
                      >
                        {idx + 1}. {d.title}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={startPresentation}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-base py-6 px-10 shadow-xl"
                  >
                    <Play className="h-5 w-5 mr-2 fill-black" />
                    Iniciar Exibição Agora
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // TELA CHEIA EM EXIBIÇÃO CONTÍNUA (MODO TV ATIVO)
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0c0d10] text-white flex flex-col select-none overflow-hidden"
    >
      {/* Barra de Progresso Superior da Rotação */}
      <div className="h-1.5 w-full bg-black/60 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-all duration-300"
          style={{ width: `${timerProgress}%` }}
        />
      </div>

      {/* Header Discreto do Modo TV */}
      <header className="h-16 px-6 bg-[#17181C]/90 backdrop-blur border-b border-amber-500/20 flex items-center justify-between shrink-0">
        {/* Esquerda: Logo Oficial e Nome do Dashboard Atual */}
        <div className="flex items-center gap-5">
          <LogosLogoFull monogramClassName="h-9 w-9" textClassName="text-xl" />
          <div className="h-6 w-px bg-white/15" />
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold uppercase">
              MODO TV
            </Badge>
            <span className="text-xl lg:text-2xl font-black text-white tracking-tight">
              {currentDashboard?.title}
            </span>
          </div>
        </div>

        {/* Centro: Indicadores de Paginação / Dots */}
        <div className="hidden md:flex items-center gap-2">
          {activeDashboards.map((dash, i) => (
            <button
              key={dash.id}
              onClick={() => {
                setCurrentIndex(i)
                setTimerProgress(0)
              }}
              title={dash.title}
              className={`h-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'w-8 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                  : 'w-2.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Direita: Relógio grande, Controles e Botão Sair */}
        <div className="flex items-center gap-4">
          {/* Relógio Digital */}
          <div className="text-right">
            <p className="text-lg lg:text-xl font-mono font-black text-amber-300 leading-none">
              {currentTime.toLocaleTimeString('pt-BR')}
            </p>
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider leading-tight mt-0.5">
              {currentTime.toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </p>
          </div>

          <div className="h-6 w-px bg-white/15" />

          {/* Controles discretos */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              title="Dashboard Anterior (Seta Esquerda)"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Pausar rotação (Espaço)' : 'Retomar rotação (Espaço)'}
              className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-amber-400" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              title="Próximo Dashboard (Seta Direita)"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={loadAllData}
              title="Atualizar Dados Agora"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title="Alternar Tela Cheia"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPlaying(false)
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {})
                }
              }}
              className="ml-2 bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600 hover:text-white text-xs font-bold"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Sair da TV
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo do Dashboard Atual em Tela Cheia */}
      <main className="flex-1 p-4 lg:p-6 overflow-hidden relative">
        {renderCurrentDashboardComponent()}
      </main>

      {/* Rodapé Discreto com Informação de Atualização e Paginação */}
      <footer className="h-7 px-6 bg-[#17181C]/70 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Monitoramento Ativo · Atualizado às {lastRefreshedAt.toLocaleTimeString('pt-BR')}
          </span>
          <span>·</span>
          <span>Intervalo: {prefs.rotationIntervalSeconds}s</span>
        </div>

        <div className="flex items-center gap-2">
          <span>
            Painel {currentIndex + 1} de {activeDashboards.length}
          </span>
          <span>·</span>
          <span className="text-slate-500">[Espaço] Pausar · [ESC] Sair</span>
        </div>
      </footer>
    </div>
  )
}
