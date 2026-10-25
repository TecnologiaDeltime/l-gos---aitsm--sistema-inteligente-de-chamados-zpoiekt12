import { useState, useEffect } from 'react'
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
  Sliders,
  CheckCircle2,
  Ticket,
  Clock,
  Building2,
  Shield,
  Loader2,
} from 'lucide-react'

interface DesignSettingsTabProps {
  isAdminOrGestor: boolean
}

export function DesignSettingsTab({ isAdminOrGestor }: DesignSettingsTabProps) {
  const { toast } = useToast()
  const { designSettings, updateDesignSettings, applyDesignPreview, resetDesignPreview } =
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

  // Sincronizar quando as configurações do banco chegarem
  useEffect(() => {
    setSidebarBg(designSettings.sidebar_bg_color || DEFAULT_DESIGN_SETTINGS.sidebar_bg_color)
    setSidebarText(designSettings.sidebar_text_color || DEFAULT_DESIGN_SETTINGS.sidebar_text_color)
    setSystemVariant(
      designSettings.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
    )
  }, [designSettings])

  // Aplicar preview imediato sempre que o usuário alterar um valor no formulário
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
      title: 'Valores restaurados para o padrão',
      description: 'Clique em "Salvar Alterações de Design" para persistir no banco.',
    })
  }

  const handleSave = async () => {
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

  // Análise de contraste WCAG entre fundo e texto da barra
  const contrastRatio = getContrastRatio(sidebarBg, sidebarText)
  const isContrastLow = contrastRatio < 3.0
  const isContrastMedium = contrastRatio >= 3.0 && contrastRatio < 4.5

  const hasChanges =
    sidebarBg !== designSettings.sidebar_bg_color ||
    sidebarText !== designSettings.sidebar_text_color ||
    systemVariant !== designSettings.system_theme_variant

  return (
    <div className="space-y-6 max-w-4xl">
      {/* CABEÇALHO DA SEÇÃO DE DESIGN */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Aparência & Identidade Visual do Sistema
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
                Dark Tech v0.0.220
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

          {/* 1. SELETOR DE COR DA BARRA LATERAL */}
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

            {/* Swatches predefinidos organizados por tom (Escuros vs Claros) */}
            <div className="space-y-3 pt-1">
              {/* Grupo: Paletas Escuras (Dark Tech) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Paletas Escuras (Dark Tech)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    (6 opções originais)
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

              {/* Grupo: Paletas Claras (Light / Soft) */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Paletas Claras (Novas)
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 border-cyan-500/40 text-cyan-400"
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

          {/* 2. SELETOR DE COR DAS LETRAS E ÍCONES */}
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

              {/* Color picker livre com input hex */}
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

            {/* Swatches predefinidos */}
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

          {/* 3. CARTÃO DE PREVIEW INTERATIVO DA BARRA */}
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

            {/* Mini mock da barra lateral renderizado com as cores escolhidas */}
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

          {/* 4. VARIAÇÕES DE CORES DO SISTEMA (TEMAS) */}
          <div className="space-y-4 pt-4 border-t border-border/80">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Variações de Cores do Sistema (5 Temas Disponíveis)
              </Label>
              <p className="text-xs text-muted-foreground">
                Além do tema Cyber Cyan original, escolha entre quatro variações calibradas (Neon
                Purple, Emerald Teal, Ice Blue Light e Solar Amber) com persistência em tempo real.
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
                    {/* Header do card de tema */}
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

                      {/* Amostras de cores e chips de destaque */}
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

                      {/* Mockup visual de preview do tema */}
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

                    {/* Botão de seleção */}
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

          {/* BOTÕES DE AÇÃO: SALVAR E RESTAURAR */}
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
                Restaurar Padrão
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {hasChanges && (
                  <span className="text-xs text-amber-400 font-mono hidden sm:inline">
                    * Alterações não salvas
                  </span>
                )}
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:brightness-110 w-full sm:w-auto text-xs h-9"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {saving ? 'Gravando...' : 'Salvar Alterações de Design'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
