import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/hooks/use-theme'
import {
  THEME_VARIANTS,
  SystemThemeVariant,
  DEFAULT_DESIGN_SETTINGS,
  normalizeThemeVariant,
  uploadLogo,
  removeLogo,
  copySystemLogoToReports,
  validateLogoFile,
} from '@/services/design-settings'
import {
  Palette,
  RotateCcw,
  Save,
  Sparkles,
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
  ShieldCheck,
} from 'lucide-react'

interface DesignSettingsTabProps {
  isAdminOrGestor: boolean
}

export function DesignSettingsTab({ isAdminOrGestor }: DesignSettingsTabProps) {
  const { toast } = useToast()
  const { designSettings, updateDesignSettings, applyDesignPreview, refreshDesignSettings } =
    useTheme()

  const currentNormalized = normalizeThemeVariant(
    designSettings.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
  )

  // Estados locais para seleção de tema e preview imediato
  const [selectedVariant, setSelectedVariant] = useState<SystemThemeVariant>(currentNormalized)
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
    const norm = normalizeThemeVariant(
      designSettings.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
    )
    setSelectedVariant(norm)
    setSystemLogoPreview(designSettings.logo_url || '')
    setReportLogoPreview(designSettings.report_logo_url || '')
  }, [designSettings])

  const activeThemeDef = THEME_VARIANTS.find((t) => t.id === selectedVariant) || THEME_VARIANTS[0]

  const handleSelectTheme = (variantId: SystemThemeVariant) => {
    setSelectedVariant(variantId)
    const themeDef = THEME_VARIANTS.find((t) => t.id === variantId) || THEME_VARIANTS[0]
    applyDesignPreview({
      system_theme_variant: variantId,
      sidebar_bg_color: themeDef.sidebarBgHex,
      sidebar_text_color: themeDef.sidebarTextHex,
    })
  }

  const handleResetToDefault = () => {
    const defaultVar = DEFAULT_DESIGN_SETTINGS.system_theme_variant
    const defaultDef = THEME_VARIANTS.find((t) => t.id === defaultVar) || THEME_VARIANTS[0]
    setSelectedVariant(defaultVar)
    applyDesignPreview({
      system_theme_variant: defaultVar,
      sidebar_bg_color: defaultDef.sidebarBgHex,
      sidebar_text_color: defaultDef.sidebarTextHex,
    })
    toast({
      title: 'Tema restaurado para Amber Alert (Padrão)',
      description: 'Clique em "Salvar Tema do Sistema" para persistir globalmente.',
    })
  }

  const handleSaveTheme = async () => {
    setSaving(true)
    try {
      const targetTheme = THEME_VARIANTS.find((t) => t.id === selectedVariant) || THEME_VARIANTS[0]
      await updateDesignSettings({
        system_theme_variant: selectedVariant,
        sidebar_bg_color: targetTheme.sidebarBgHex,
        sidebar_text_color: targetTheme.sidebarTextHex,
      })
      toast({
        title: 'Tema do sistema atualizado com sucesso!',
        description: `O tema "${targetTheme.name}" foi salvo globalmente para todos os operadores e administradores.`,
      })
    } catch {
      toast({
        title: 'Erro ao salvar tema de design',
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

  const hasChanges = selectedVariant !== currentNormalized

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

      {/* SEÇÃO 2: TEMAS DE CORES DO SISTEMA (DEFINIÇÃO DO DESIGN) */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Temas Visuais do Sistema
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Selecione o tema oficial projetado para o Service Desk ITSM. Cada tema harmoniza
                automaticamente o fundo do app, a barra lateral, cartões, contraste e destaques
                operacionais.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono h-6 flex items-center gap-1.5"
              >
                <ShieldCheck className="h-3 w-3" />
                Amber Alert Padrão
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* AVISO DO NOVO TEMA PADRÃO E VARIAÇÕES */}
          <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200/90 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">
                Novo padrão do sistema: Amber Alert (Escuro) & Amber Light (Claro)
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                No modo escuro do Amber Alert, o menu lateral possui fundo branco e tipografia em
                âmbar escuro. No tema claro Amber Light, o fundo geral é branco com a barra lateral
                no tom âmbar mais escuro e letras brancas.
              </p>
            </div>
          </div>

          {/* CARTÕES DE TEMA (AMBER ALERT ESCURO COM MENU BRANCO, AMBER LIGHT COM MENU ÂMBAR, CORPORATE BLUE, TEAL OPS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {THEME_VARIANTS.map((variant) => {
              const isSelected = selectedVariant === variant.id
              return (
                <div
                  key={variant.id}
                  onClick={() => isAdminOrGestor && handleSelectTheme(variant.id)}
                  className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/40 bg-card shadow-lg shadow-primary/10'
                      : 'border-border/80 hover:border-border hover:bg-secondary/30'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full shadow-xs border border-white/20 shrink-0"
                          style={{ backgroundColor: variant.primaryHex }}
                        />
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {variant.name}
                        </p>
                      </div>
                      {isSelected ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px] h-5 font-semibold">
                          Ativo
                        </Badge>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {variant.primaryHex}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {variant.description}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        Paleta funcional:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {variant.chips.map((chip, idx) => (
                          <div
                            key={idx}
                            className="h-5 w-6 rounded border border-white/20 shadow-xs flex items-center justify-center text-[9px] font-mono text-white/70"
                            style={{ backgroundColor: chip }}
                            title={chip}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mini mockup do tema com representação fiel do fundo e da barra lateral */}
                    <div
                      className="p-2 rounded-lg border border-border shadow-inner mt-2 overflow-hidden flex gap-2 h-20"
                      style={{ background: variant.previewBg }}
                    >
                      {/* Mini Sidebar */}
                      <div
                        className="w-16 rounded border flex flex-col justify-between p-1.5 shrink-0 shadow-xs"
                        style={{
                          backgroundColor: variant.sidebarBgHex,
                          borderColor: `${variant.sidebarTextHex}30`,
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  variant.id === 'amber_light'
                                    ? '#d97706'
                                    : variant.sidebarTextHex,
                              }}
                            />
                            <div
                              className="h-1.5 w-7 rounded-sm"
                              style={{ backgroundColor: variant.sidebarTextHex }}
                            />
                          </div>
                          <div
                            className="h-2 w-full rounded px-1 flex items-center"
                            style={{
                              backgroundColor:
                                variant.id === 'amber_light'
                                  ? '#d9770628'
                                  : `${variant.sidebarTextHex}25`,
                            }}
                          >
                            <span
                              className="text-[7px] font-bold font-mono"
                              style={{
                                color:
                                  variant.id === 'amber_light'
                                    ? '#d97706'
                                    : variant.sidebarTextHex,
                              }}
                            >
                              ITSM
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-[7px] font-mono font-medium truncate"
                          style={{
                            color:
                              variant.id === 'amber_light'
                                ? '#ffffff'
                                : variant.sidebarTextHex,
                          }}
                        >
                          Menu
                        </span>
                      </div>

                      {/* Mini Conteúdo */}
                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-[9px] font-semibold truncate"
                            style={{
                              color: variant.mode === 'light' ? '#1f2937' : '#f3f4f6',
                            }}
                          >
                            {variant.name.replace(' (Padrão)', '')}
                          </span>
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: variant.primaryHex }}
                          />
                        </div>
                        <div
                          className="p-1 rounded text-[7px] font-mono border"
                          style={{
                            backgroundColor:
                              variant.mode === 'light' ? '#ffffff' : 'rgba(255,255,255,0.06)',
                            color: variant.mode === 'light' ? '#4b5563' : '#9ca3af',
                            borderColor:
                              variant.mode === 'light' ? '#e5e7eb' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          Fundo: {variant.mode === 'light' ? 'Branco' : 'Escuro'}
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{
                            backgroundColor:
                              variant.mode === 'light'
                                ? 'rgba(0,0,0,0.08)'
                                : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: '75%', backgroundColor: variant.primaryHex }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Menu: {variant.sidebarBgHex}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      disabled={!isAdminOrGestor}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectTheme(variant.id)
                      }}
                      className={`h-7 text-xs font-semibold ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
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

          {/* PREVIEW EM TEMPO REAL DO TEMA SELECIONADO */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                Demonstração da Barra Lateral no Tema: {activeThemeDef.name}
              </span>
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
=======
              <Badge
                variant="outline"
                className="text-[10px] border-primary/40 text-primary font-mono"
              >
                Harmonizado WCAG
              </Badge>
            </div>

            {(() => {
              const isAmberLight = activeThemeDef.id === 'amber_light'
              const activeColor = isAmberLight ? '#d97706' : activeThemeDef.sidebarTextHex
              const activeBg = isAmberLight ? 'rgba(217, 119, 6, 0.15)' : `${activeThemeDef.sidebarTextHex}18`
              const inactiveColor = isAmberLight ? '#ffffff' : activeThemeDef.sidebarTextHex

              return (
                <div
                  className="p-3 rounded-lg border border-border/80 flex flex-wrap items-center gap-2 transition-colors"
                  style={{ backgroundColor: activeThemeDef.sidebarBgHex }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
                    style={{
                      backgroundColor: activeBg,
                      color: activeColor,
                    }}
                  >
                    <Ticket className="h-3.5 w-3.5" style={{ color: activeColor }} />
                    <span>Chamados (Ativo)</span>
                  </div>

                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                    style={{ color: inactiveColor }}
                  >
                    <Building2
                      className="h-3.5 w-3.5"
                      style={{ color: inactiveColor }}
                    />
                    <span>Clientes</span>
                  </div>

                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                    style={{ color: inactiveColor }}
                  >
                    <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                    <span>SLA</span>
                  </div>

                  <div
                    className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                    style={{ color: inactiveColor }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{
                        backgroundColor:
                          activeThemeDef.id === 'amber_light'
                            ? '#d97706'
                            : activeThemeDef.primaryHex,
                      }}
                    />
                    ONLINE
                  </div>
                </div>
              )
            })()}
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-90 hover:opacity-100 transition-opacity"
                      style={{ color: inactiveColor }}
                    >
                      <Clock className="h-3.5 w-3.5" style={{ color: inactiveColor }} />
                      <span>SLA</span>
                    </div>

                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
=======
                    <div
                      className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                      style={{ color: inactiveColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            activeThemeDef.id === 'amber_light'
                              ? '#d97706'
                              : activeThemeDef.primaryHex,
                        }}
                      />
                      ONLINE
                    </div>
                  </>
                )
              })()}
            </div>
=======

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: activeThemeDef.sidebarTextHex }}
                />
                <span>Clientes</span>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-85 hover:opacity-100 transition-opacity"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: activeThemeDef.sidebarTextHex }} />
                <span>SLA</span>
              </div>

              <div
                className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-black/30 border border-white/5"
                style={{ color: activeThemeDef.sidebarTextHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activeThemeDef.primaryHex }}
                />
                ONLINE
              </div>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO: SALVAR TEMA E RESTAURAR */}
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
                Restaurar Padrão (Amber Alert)
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {hasChanges && (
                  <span className="text-xs text-amber-400 font-mono hidden sm:inline">
                    * Tema modificado (não salvo)
                  </span>
                )}
                <Button
                  type="button"
                  onClick={handleSaveTheme}
                  disabled={saving || !hasChanges}
                  className="bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:brightness-110 w-full sm:w-auto text-xs h-9"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {saving ? 'Gravando...' : 'Salvar Tema do Sistema'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
