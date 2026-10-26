import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/hooks/use-theme'
import {
  SIDEBAR_BG_SWATCHES,
  SIDEBAR_TEXT_SWATCHES,
  THEME_VARIANTS,
  SystemThemeVariant,
  getContrastRatio,
  DEFAULT_DESIGN_SETTINGS,
  uploadLogo,
  removeLogo,
  copySystemLogoToReports,
  validateLogoFile,
} from '@/services/design-settings'
import {
  Palette,
  Check,
  RotateCcw,
  Save,
  AlertTriangle,
  Sparkles,
  Layout,
  Type,
  Eye,
  CheckCircle2,
  Ticket,
  Clock,
  Building2,
  Loader2,
  Upload,
  Trash2,
  Copy,
  FileImage,
  ImageIcon,
  FileText,
} from 'lucide-react'

interface DesignSettingsTabProps {
  isAdminOrGestor: boolean
}

export function DesignSettingsTab({ isAdminOrGestor }: DesignSettingsTabProps) {
  const { toast } = useToast()
  const { designSettings, updateDesignSettings, applyDesignPreview, refreshDesignSettings } =
    useTheme()

  // Estados locais para edição interativa com preview imediato
  const [sidebarBg, setSidebarBg] = useState<string>(
    designSettings.sidebar_bg_color || DEFAULT_DESIGN_SETTINGS.sidebar_bg_color,
  )
  const [sidebarText, setSidebarText] = useState<string>(
    designSettings.sidebar_text_color || DEFAULT_DESIGN_SETTINGS.sidebar_text_color,
  )
  const [systemVariant, setSystemVariant] = useState<SystemThemeVariant>(
    designSettings.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
  )
  const [saving, setSaving] = useState(false)

  // Estados para gerenciamento de logotipos
  const [systemLogoPreview, setSystemLogoPreview] = useState<string>(designSettings.logo_url || '')
  const [reportLogoPreview, setReportLogoPreview] = useState<string>(
    designSettings.report_logo_url || '',
  )
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingReportLogo, setUploadingReportLogo] = useState(false)
  const [copyingLogo, setCopyingLogo] = useState(false)

  const systemLogoInputRef = useRef<HTMLInputElement>(null)
  const reportLogoInputRef = useRef<HTMLInputElement>(null)

  // Sincronizar quando as configurações do banco chegarem
  useEffect(() => {
    setSidebarBg(designSettings.sidebar_bg_color || DEFAULT_DESIGN_SETTINGS.sidebar_bg_color)
    setSidebarText(designSettings.sidebar_text_color || DEFAULT_DESIGN_SETTINGS.sidebar_text_color)
    setSystemVariant(
      designSettings.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
    )
    setSystemLogoPreview(designSettings.logo_url || '')
    setReportLogoPreview(designSettings.report_logo_url || '')
  }, [designSettings])

  // Handlers para cores e temas
  const handleSidebarBgChange = (newColor: string, suggestedTextColor?: string) => {
    setSidebarBg(newColor)
    const newTextColor = suggestedTextColor || sidebarText
    if (suggestedTextColor) {
      setSidebarText(suggestedTextColor)
    }
    applyDesignPreview({
      sidebar_bg_color: newColor,
      sidebar_text_color: newTextColor,
      system_theme_variant: systemVariant,
    })
  }

  const handleSidebarTextChange = (newColor: string) => {
    setSidebarText(newColor)
    applyDesignPreview({
      sidebar_bg_color: sidebarBg,
      sidebar_text_color: newColor,
      system_theme_variant: systemVariant,
    })
  }

  const handleThemeVariantChange = (newVariant: SystemThemeVariant) => {
    setSystemVariant(newVariant)
    applyDesignPreview({
      sidebar_bg_color: sidebarBg,
      sidebar_text_color: sidebarText,
      system_theme_variant: newVariant,
    })
  }

  const handleResetToDefault = () => {
    setSidebarBg(DEFAULT_DESIGN_SETTINGS.sidebar_bg_color)
    setSidebarText(DEFAULT_DESIGN_SETTINGS.sidebar_text_color)
    setSystemVariant(DEFAULT_DESIGN_SETTINGS.system_theme_variant)
    applyDesignPreview(DEFAULT_DESIGN_SETTINGS)
    toast({
      title: 'Cores restauradas para o padrão',
      description: 'Clique em "Salvar Alterações de Cores" para persistir no banco.',
    })
  }

  const handleSaveColors = async () => {
    setSaving(true)
    try {
      await updateDesignSettings({
        sidebar_bg_color: sidebarBg,
        sidebar_text_color: sidebarText,
        system_theme_variant: systemVariant,
      })
      toast({
        title: 'Design atualizado com sucesso!',
        description: 'As novas cores e temas foram gravados e aplicados para todos os usuários.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar configurações de design',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handlers de Upload / Remoção de Logotipo
  const handleSystemLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateLogoFile(file)
    if (!validation.valid) {
      toast({
        title: 'Arquivo não aceito',
        description: validation.error,
        variant: 'destructive',
      })
      if (systemLogoInputRef.current) systemLogoInputRef.current.value = ''
      return
    }

    // Preview local imediato enquanto sobe
    const objectUrl = URL.createObjectURL(file)
    setSystemLogoPreview(objectUrl)

    setUploadingLogo(true)
    try {
      const updated = await uploadLogo(file, 'logo')
      await refreshDesignSettings()
      setSystemLogoPreview(updated.logo_url || objectUrl)
      toast({
        title: 'Logotipo atualizado!',
        description: 'O novo logotipo agora é exibido no menu lateral, no topo e na tela de login.',
      })
    } catch (err: any) {
      setSystemLogoPreview(designSettings.logo_url || '')
      toast({
        title: 'Erro ao enviar logotipo',
        description: err?.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
      if (systemLogoInputRef.current) systemLogoInputRef.current.value = ''
    }
  }

  const handleRemoveSystemLogo = async () => {
    if (
      !confirm(
        'Deseja realmente remover o logotipo da empresa? O sistema passará a exibir o nome em texto neutro.',
      )
    ) {
      return
    }
    setUploadingLogo(true)
    try {
      await removeLogo('logo')
      await refreshDesignSettings()
      setSystemLogoPreview('')
      toast({
        title: 'Logotipo removido',
        description: 'O sistema voltou ao estado sem logotipo gráfico (wordmark textual).',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao remover logotipo',
        description: err?.message || 'Falha ao processar solicitação.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleReportLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateLogoFile(file)
    if (!validation.valid) {
      toast({
        title: 'Arquivo não aceito',
        description: validation.error,
        variant: 'destructive',
      })
      if (reportLogoInputRef.current) reportLogoInputRef.current.value = ''
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setReportLogoPreview(objectUrl)

    setUploadingReportLogo(true)
    try {
      const updated = await uploadLogo(file, 'report_logo')
      await refreshDesignSettings()
      setReportLogoPreview(updated.report_logo_url || objectUrl)
      toast({
        title: 'Logotipo para documentos atualizado!',
        description:
          'Este logo será aplicado nos relatórios, dashboards e exportações de documentos.',
      })
    } catch (err: any) {
      setReportLogoPreview(designSettings.report_logo_url || '')
      toast({
        title: 'Erro ao enviar logotipo de relatórios',
        description: err?.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setUploadingReportLogo(false)
      if (reportLogoInputRef.current) reportLogoInputRef.current.value = ''
    }
  }

  const handleRemoveReportLogo = async () => {
    if (!confirm('Deseja remover o logotipo de documentos e relatórios?')) {
      return
    }
    setUploadingReportLogo(true)
    try {
      await removeLogo('report_logo')
      await refreshDesignSettings()
      setReportLogoPreview('')
      toast({
        title: 'Logotipo de relatórios removido',
        description:
          'Relatórios e dashboards voltarão a usar o logo principal ou cabeçalho textual.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao remover logotipo de relatórios',
        description: err?.message || 'Falha ao processar solicitação.',
        variant: 'destructive',
      })
    } finally {
      setUploadingReportLogo(false)
    }
  }

  const handleUseSystemLogoForReports = async () => {
    setCopyingLogo(true)
    try {
      const updated = await copySystemLogoToReports()
      await refreshDesignSettings()
      setReportLogoPreview(updated.report_logo_url || '')
      toast({
        title: 'Logotipo replicado!',
        description:
          'O logotipo do sistema agora também será utilizado nos relatórios e documentos.',
      })
    } catch (err: any) {
      toast({
        title: 'Não foi possível replicar o logotipo',
        description: err?.message || 'Certifique-se de que há um logotipo principal configurado.',
        variant: 'destructive',
      })
    } finally {
      setCopyingLogo(false)
    }
  }

  // Análise de contraste WCAG entre fundo e texto da barra
  const contrastRatio = getContrastRatio(sidebarBg, sidebarText)
  const isContrastLow = contrastRatio < 3.0
  const isContrastMedium = contrastRatio >= 3.0 && contrastRatio < 4.5

  const hasColorChanges =
    sidebarBg !== designSettings.sidebar_bg_color ||
    sidebarText !== designSettings.sidebar_text_color ||
    systemVariant !== designSettings.system_theme_variant

  return (
    <div className="space-y-6 max-w-4xl">
      {/* SEÇÃO 1: GESTÃO DE LOGOTIPOS (SISTEMA + DOCUMENTOS/RELATÓRIOS) */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Gestão de Logotipos da Empresa
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Insira ou modifique o logotipo da empresa exibido no sistema e defina o logotipo
                exclusivo para relatórios, dashboards e documentos gerados.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-primary/30 text-primary self-start sm:self-auto"
            >
              Formatos: PNG, JPG, SVG (Máx 2MB)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1.1 LOGO PRINCIPAL DO SISTEMA */}
            <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Logotipo Principal do Sistema
                  </Label>
                  {systemLogoPreview ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                      Sem logo (Texto)
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Aparece na barra lateral, no cabeçalho superior e na tela de login. Ao remover, o
                  sistema exibe o nome institucional em texto neutro.
                </p>

                {/* Box de Preview do Logo do Sistema */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Pré-visualização imediata:
                  </span>
                  <div className="h-28 rounded-lg border border-dashed border-border bg-background/50 flex items-center justify-center p-3 relative overflow-hidden">
                    {systemLogoPreview ? (
                      <img
                        src={systemLogoPreview}
                        alt="Logotipo do Sistema"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center space-y-1">
                        <span className="text-sm font-bold tracking-tight text-foreground/80">
                          ITSM Desk
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          (Modo texto ativo — nenhum arquivo carregado)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação para o Logo do Sistema */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <input
                  ref={systemLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleSystemLogoUpload}
                  disabled={!isAdminOrGestor || uploadingLogo}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => systemLogoInputRef.current?.click()}
                    disabled={!isAdminOrGestor || uploadingLogo}
                    className="flex-1 text-xs h-8 bg-primary text-primary-foreground hover:brightness-110"
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {systemLogoPreview ? 'Modificar Logotipo' : 'Inserir Logotipo'}
                      </>
                    )}
                  </Button>

                  {systemLogoPreview && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRemoveSystemLogo}
                      disabled={!isAdminOrGestor || uploadingLogo}
                      className="text-xs h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                      title="Remover logotipo e voltar ao texto neutro"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
                {!isAdminOrGestor && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Apenas administradores ou gestores podem alterar o logotipo.
                  </p>
                )}
              </div>
            </div>

            {/* 1.2 LOGO PARA RELATÓRIOS, DASHBOARDS E DOCUMENTOS */}
            <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Logotipo para Documentos & Relatórios
                  </Label>
                  {reportLogoPreview ? (
                    <Badge
                      variant="secondary"
                      className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px]"
                    >
                      Personalizado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                      Usa padrão
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Aplicado no cabeçalho de relatórios impressos, dashboards gerenciais e documentos
                  PDF (ideal para versões com contraste adequado em folha branca A4).
                </p>

                {/* Box de Preview do Logo de Relatórios */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      Pré-visualização (fundo claro):
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      (A4 / Impressão)
                    </span>
                  </div>
                  <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white flex items-center justify-center p-3 relative overflow-hidden shadow-inner">
                    {reportLogoPreview ? (
                      <img
                        src={reportLogoPreview}
                        alt="Logotipo para Relatórios"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : systemLogoPreview ? (
                      <div className="text-center space-y-1">
                        <img
                          src={systemLogoPreview}
                          alt="Logotipo do Sistema (Herdado)"
                          className="max-h-16 max-w-full object-contain mx-auto opacity-75"
                        />
                        <p className="text-[9px] text-slate-500">
                          (Herdando o logotipo do sistema)
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <span className="text-sm font-bold tracking-tight text-slate-800">
                          ITSM Desk
                        </span>
                        <p className="text-[9px] text-slate-500">(Texto padrão em documentos)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação para o Logo de Relatórios */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <input
                  ref={reportLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleReportLogoUpload}
                  disabled={!isAdminOrGestor || uploadingReportLogo}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => reportLogoInputRef.current?.click()}
                    disabled={!isAdminOrGestor || uploadingReportLogo}
                    className="flex-1 text-xs h-8 bg-primary text-primary-foreground hover:brightness-110"
                  >
                    {uploadingReportLogo ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {reportLogoPreview ? 'Modificar Logo' : 'Inserir Logo de Documentos'}
                      </>
                    )}
                  </Button>

                  {systemLogoPreview && !reportLogoPreview && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleUseSystemLogoForReports}
                      disabled={!isAdminOrGestor || copyingLogo}
                      className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/10"
                      title="Copiar o logotipo atual do sistema para os documentos"
                    >
                      {copyingLogo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Usar o mesmo do sistema
                        </>
                      )}
                    </Button>
                  )}

                  {reportLogoPreview && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRemoveReportLogo}
                      disabled={!isAdminOrGestor || uploadingReportLogo}
                      className="text-xs h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                      title="Remover logotipo específico de relatórios"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: CORES DA BARRA, TEXTOS E TEMAS DO SISTEMA */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Cores do Menu & Temas do Sistema
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Personalize a cor da barra lateral, dos textos/ícones e selecione entre os temas
                tecnológicos dark tech com persistência global em tempo real.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono h-6"
              >
                Dark Tech v0.0.224
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-6">
          {/* AVISO DE CONTRASTE SE NECESSÁRIO */}
          {isContrastLow && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Aviso de Baixo Contraste ({contrastRatio.toFixed(1)}:1)
                </p>
                <p className="text-amber-300/90 text-[11px] leading-relaxed">
                  A combinação entre a cor de fundo da barra e a cor do texto pode dificultar a
                  leitura dos itens de menu. Sugerimos escolher um tom de texto mais claro ou um
                  fundo mais escuro para garantir conforto visual.
                </p>
              </div>
            </div>
          )}

          {/* 2.1 SELETOR DE COR DA BARRA LATERAL */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layout className="h-4 w-4 text-primary" />
                  Cor da Barra (Menu Lateral)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Escolha um swatch tecnológico predefinido ou selecione qualquer cor pelo seletor
                  livre.
                </p>
              </div>

              {/* Color picker livre com input hex */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div
                  className="h-8 w-8 rounded-lg border border-border shadow-xs overflow-hidden cursor-pointer relative"
                  style={{ backgroundColor: sidebarBg }}
                >
                  <input
                    type="color"
                    aria-label="Selecionar cor da barra lateral"
                    value={sidebarBg}
                    onChange={(e) => handleSidebarBgChange(e.target.value)}
                    disabled={!isAdminOrGestor}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border text-xs font-mono">
                  <span className="text-muted-foreground text-[10px]">HEX:</span>
                  <input
                    type="text"
                    value={sidebarBg}
                    onChange={(e) => handleSidebarBgChange(e.target.value)}
                    disabled={!isAdminOrGestor}
                    maxLength={7}
                    className="w-16 bg-transparent text-xs font-mono font-semibold focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Swatches predefinidos organizados por tom */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Paletas Escuras (Dark Tech)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {SIDEBAR_BG_SWATCHES.filter((s) => s.tone === 'dark').map((swatch) => {
                    const isSelected = sidebarBg.toLowerCase() === swatch.value.toLowerCase()
                    return (
                      <button
                        key={swatch.value}
                        type="button"
                        onClick={() => handleSidebarBgChange(swatch.value, swatch.defaultText)}
                        disabled={!isAdminOrGestor}
                        className={`group relative p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col gap-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-card shadow-md'
                            : 'border-border/80 hover:border-border hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div
                            className="h-6 w-6 rounded-lg border border-white/10 shadow-xs flex items-center justify-center shrink-0"
                            style={{ backgroundColor: swatch.value }}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {swatch.value}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {swatch.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {swatch.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Paletas Claras (Light / Soft)
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary"
                  >
                    Auto-harmonização WCAG
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {SIDEBAR_BG_SWATCHES.filter((s) => s.tone === 'light').map((swatch) => {
                    const isSelected = sidebarBg.toLowerCase() === swatch.value.toLowerCase()
                    return (
                      <button
                        key={swatch.value}
                        type="button"
                        onClick={() => handleSidebarBgChange(swatch.value, swatch.defaultText)}
                        disabled={!isAdminOrGestor}
                        className={`group relative p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col gap-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-card shadow-md'
                            : 'border-border/80 hover:border-border hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div
                            className="h-6 w-6 rounded-lg border border-black/10 shadow-xs flex items-center justify-center shrink-0"
                            style={{ backgroundColor: swatch.value }}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 text-slate-900" />}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {swatch.value}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {swatch.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {swatch.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 2.2 SELETOR DE COR DAS LETRAS E ÍCONES */}
          <div className="space-y-4 pt-4 border-t border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  Cor das Letras e Ícones do Menu
                </Label>
                <p className="text-xs text-muted-foreground">
                  Define a cor dos textos e ícones destacados e ativos na barra de navegação
                  lateral.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div
                  className="h-8 w-8 rounded-lg border border-border shadow-xs overflow-hidden cursor-pointer relative"
                  style={{ backgroundColor: sidebarText }}
                >
                  <input
                    type="color"
                    aria-label="Selecionar cor das letras e ícones"
                    value={sidebarText}
                    onChange={(e) => handleSidebarTextChange(e.target.value)}
                    disabled={!isAdminOrGestor}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border text-xs font-mono">
                  <span className="text-muted-foreground text-[10px]">HEX:</span>
                  <input
                    type="text"
                    value={sidebarText}
                    onChange={(e) => handleSidebarTextChange(e.target.value)}
                    disabled={!isAdminOrGestor}
                    maxLength={7}
                    className="w-16 bg-transparent text-xs font-mono font-semibold focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              {SIDEBAR_TEXT_SWATCHES.map((swatch) => {
                const isSelected = sidebarText.toLowerCase() === swatch.value.toLowerCase()
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() => handleSidebarTextChange(swatch.value)}
                    disabled={!isAdminOrGestor}
                    className={`group relative p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col gap-2 ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/40 bg-card shadow-md'
                        : 'border-border/80 hover:border-border hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className="h-6 w-6 rounded-lg border border-black/10 shadow-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: swatch.value }}
                      >
                        {isSelected && (
                          <Check
                            className={`h-3.5 w-3.5 ${
                              swatch.value === '#ffffff' || swatch.value === '#e2e8f0'
                                ? 'text-slate-900'
                                : 'text-slate-950'
                            }`}
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {swatch.value}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {swatch.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {swatch.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2.3 CARTÃO DE PREVIEW INTERATIVO DA BARRA */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                Amostra de Visualização do Menu Lateral
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    isContrastLow
                      ? 'border-amber-500 text-amber-400'
                      : isContrastMedium
                        ? 'border-blue-500 text-blue-400'
                        : 'border-emerald-500 text-emerald-400'
                  }`}
                >
                  Contraste: {contrastRatio.toFixed(1)}:1{' '}
                  {isContrastLow ? '(Baixo)' : isContrastMedium ? '(Bom)' : '(Excelente)'}
                </Badge>
              </div>
            </div>

            <div
              className="p-3.5 rounded-xl border border-white/10 shadow-inner flex flex-wrap sm:flex-nowrap items-center gap-3 transition-colors duration-300"
              style={{ backgroundColor: sidebarBg }}
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
                style={{
                  backgroundColor: `${sidebarText}18`,
                  color: sidebarText,
                  border: `1px solid ${sidebarText}40`,
                }}
              >
                <Ticket className="h-3.5 w-3.5" style={{ color: sidebarText }} />
                <span>Tickets (Ativo)</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: sidebarText }}
              >
                <Building2 className="h-3.5 w-3.5" style={{ color: sidebarText }} />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: sidebarText }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: sidebarText }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: sidebarText }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: sidebarText }}
                />
                ONLINE
              </div>
            </div>
          </div>

          {/* 2.4 VARIAÇÕES DE CORES DO SISTEMA (TEMAS) */}
          <div className="space-y-4 pt-4 border-t border-border/80">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Variações de Cores do Sistema (6 Temas Disponíveis)
              </Label>
              <p className="text-xs text-muted-foreground">
                Escolha entre os 6 temas disponíveis com preview em tempo real e persistência
                global.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {THEME_VARIANTS.map((variant) => {
                const isSelected = systemVariant === variant.id
                return (
                  <div
                    key={variant.id}
                    onClick={() => isAdminOrGestor && handleThemeVariantChange(variant.id)}
                    className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/40 bg-card shadow-lg shadow-primary/5'
                        : 'border-border/80 hover:border-border hover:bg-secondary/30'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full shadow-xs"
                            style={{ backgroundColor: variant.primaryHex }}
                          />
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {variant.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 font-semibold">
                            Ativo
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {variant.description}
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                          Amostras de cor:
                        </span>
                        <div className="flex items-center gap-2">
                          {variant.chips.map((chip, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span
                                className="h-5 w-5 rounded-md border border-white/20 shadow-xs"
                                style={{ backgroundColor: chip }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div
                        className="p-3 rounded-lg border border-white/10 shadow-inner mt-2 space-y-2"
                        style={{ background: variant.previewBg }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: variant.primaryHex }}
                            />
                            <span className="text-[10px] font-mono text-white/80 font-bold">
                              {variant.subtitle}
                            </span>
                          </div>
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded text-black font-bold"
                            style={{ backgroundColor: variant.accentHex }}
                          >
                            NEON
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: '68%',
                              backgroundColor: variant.primaryHex,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {variant.primaryHex}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        disabled={!isAdminOrGestor}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleThemeVariantChange(variant.id)
                        }}
                        className={`h-7 text-xs font-semibold ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:border-primary/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Selecionado
                          </>
                        ) : (
                          'Selecionar'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* BOTÕES DE AÇÃO: SALVAR CORES E RESTAURAR */}
          {isAdminOrGestor && (
            <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                disabled={saving}
                className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Restaurar Cores Padrão
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {hasColorChanges && (
                  <span className="text-xs text-amber-400 font-mono hidden sm:inline">
                    * Alterações não salvas
                  </span>
                )}
                <Button
                  type="button"
                  onClick={handleSaveColors}
                  disabled={saving || !hasColorChanges}
                  className="bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:brightness-110 w-full sm:w-auto text-xs h-9"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {saving ? 'Gravando...' : 'Salvar Alterações de Cores'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
