import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/hooks/use-theme'
import {
  uploadLogo,
  removeLogo,
  copySystemLogoToReports,
  validateLogoFile,
  OFFICIAL_THEME,
  LIGHT_THEME,
  THEME_VARIANTS,
  SystemThemeVariant,
} from '@/services/design-settings'
import {
  Loader2,
  Upload,
  Trash2,
  Copy,
  FileImage,
  ImageIcon,
  FileText,
  Palette,
  CheckCircle2,
  Moon,
  Sun,
} from 'lucide-react'

interface DesignSettingsTabProps {
  isAdminOrGestor: boolean
}

export function DesignSettingsTab({ isAdminOrGestor }: DesignSettingsTabProps) {
  const { toast } = useToast()
  const { theme, setTheme, updateDesignSettings, designSettings, refreshDesignSettings } =
    useTheme()
  const [savingTheme, setSavingTheme] = useState(false)

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
    setSystemLogoPreview(designSettings.logo_url || '')
    setReportLogoPreview(designSettings.report_logo_url || '')
  }, [designSettings])

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
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
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

      {/* SEÇÃO 2: SELEÇÃO DE TEMA DO SISTEMA (MODO ESCURO / MODO CLARO) */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Modo de Exibição & Tema Visual
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Escolha o modo de exibição oficial do sistema: o consagrado{' '}
                <strong>Modo Escuro (Amber Alert)</strong> ou o elegante{' '}
                <strong>Modo Claro (Marrom & Branco)</strong>. A escolha é aplicada imediatamente e
                sincronizada com todos os usuários do ITSM.
              </CardDescription>
            </div>

            <Badge
              variant="secondary"
              className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold px-2.5 py-1 self-start sm:self-auto"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Ativo: {theme === 'light' ? LIGHT_THEME.name : OFFICIAL_THEME.name}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Cartões dos dois modos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2.1 MODO ESCURO (AMBER ALERT) */}
            {(() => {
              const isSelected =
                (designSettings.system_theme_variant || 'amber_alert') === 'amber_alert'
              return (
                <div
                  onClick={() => {
                    if (!isAdminOrGestor || savingTheme) return
                    setTheme('dark')
                  }}
                  className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md shadow-black/20 ring-1 ring-primary/40'
                      : 'border-border/80 bg-secondary/20 hover:border-border hover:bg-secondary/35'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-[#17181C] border border-amber-500/30 flex items-center justify-center">
                          <Moon className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            Modo Escuro (Amber Alert)
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            Padrão oficial escuro
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold">
                          Em uso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Clique para ativar
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fundo grafite neutro (#17181C), barra lateral grafite com tipografia em âmbar
                      suave (#FCD34D), ação âmbar (#F59E0B) e item ativo em âmbar vívido (#D97706).
                    </p>

                    {/* Paleta / Chips de cores */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-mono text-muted-foreground">Amostras:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          title="Fundo Grafite #17181C"
                          className="h-5 w-5 rounded-full bg-[#17181C] border border-white/20"
                        />
                        <span
                          title="Card #1F2126"
                          className="h-5 w-5 rounded-full bg-[#1F2126] border border-white/20"
                        />
                        <span
                          title="Tipografia Âmbar #FCD34D"
                          className="h-5 w-5 rounded-full bg-[#FCD34D]"
                        />
                        <span
                          title="Ação Primária #F59E0B"
                          className="h-5 w-5 rounded-full bg-[#F59E0B]"
                        />
                        <span title="Ativo #D97706" className="h-5 w-5 rounded-full bg-[#D97706]" />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={!isAdminOrGestor || savingTheme}
                    onClick={(e) => {
                      e.stopPropagation()
                      setTheme('dark')
                    }}
                    className="w-full text-xs h-8"
                  >
                    {isSelected ? 'Modo Escuro Ativo' : 'Ativar Modo Escuro'}
                  </Button>
                </div>
              )
            })()}

            {/* 2.2 MODO CLARO (MARROM & BRANCO) */}
            {(() => {
              const isSelected = designSettings.system_theme_variant === 'amber_light'
              return (
                <div
                  onClick={() => {
                    if (!isAdminOrGestor || savingTheme) return
                    setTheme('light')
                  }}
                  className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md shadow-black/10 ring-1 ring-primary/40'
                      : 'border-border/80 bg-secondary/20 hover:border-border hover:bg-secondary/35'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-[#FAF8F5] border border-amber-800/20 flex items-center justify-center">
                          <Sun className="h-4 w-4 text-amber-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            Modo Claro (Marrom & Branco)
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            UX suave de alto contraste
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold">
                          Em uso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Clique para ativar
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fundo acolhedor off-white (#FAF8F5), cartões brancos com bordas suaves,
                      tipografia em marrom profundo de alto contraste (WCAG AA), barra lateral
                      marrom nobre (#3D2314) com letras brancas e ações em marrom/âmbar quente
                      (#B45309).
                    </p>

                    {/* Paleta / Chips de cores */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-mono text-muted-foreground">Amostras:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          title="Fundo Off-white #FAF8F5"
                          className="h-5 w-5 rounded-full bg-[#FAF8F5] border border-slate-300"
                        />
                        <span
                          title="Card Branco #FFFFFF"
                          className="h-5 w-5 rounded-full bg-[#FFFFFF] border border-slate-300"
                        />
                        <span
                          title="Barra Lateral Marrom #3D2314"
                          className="h-5 w-5 rounded-full bg-[#3D2314]"
                        />
                        <span
                          title="Texto Marrom Profundo #2E1A0E"
                          className="h-5 w-5 rounded-full bg-[#2E1A0E]"
                        />
                        <span
                          title="Ação Marrom Âmbar #B45309"
                          className="h-5 w-5 rounded-full bg-[#B45309]"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={!isAdminOrGestor || savingTheme}
                    onClick={(e) => {
                      e.stopPropagation()
                      setTheme('light')
                    }}
                    className="w-full text-xs h-8"
                  >
                    {isSelected ? 'Modo Claro Ativo' : 'Ativar Modo Claro'}
                  </Button>
                </div>
              )
            })()}
          </div>

          {/* Mini-mockup / Demonstração ao vivo da barra lateral adaptada */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Demonstração ao Vivo da Barra Lateral (
                {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'})
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {theme === 'light'
                  ? 'Fundo #3D2314 • Texto #FFFFFF'
                  : 'Fundo #17181C • Texto #FCD34D'}
              </Badge>
            </div>

            <div
              className="rounded-xl border border-border/80 p-4 shadow-inner max-w-sm transition-colors duration-200"
              style={{
                backgroundColor: theme === 'light' ? '#3D2314' : '#17181C',
                color: theme === 'light' ? '#FFFFFF' : '#FCD34D',
              }}
            >
              {/* Topo do mockup */}
              <div
                className="flex items-center gap-2 pb-3 mb-3 border-b"
                style={{
                  borderColor:
                    theme === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-xs"
                  style={{
                    backgroundColor: theme === 'light' ? '#F59E0B' : '#D97706',
                    boxShadow:
                      theme === 'light'
                        ? '0 0 8px rgba(245,158,11,0.7)'
                        : '0 0 8px rgba(217,119,6,0.6)',
                  }}
                />
                <span
                  className="text-sm font-bold tracking-tight"
                  style={{ color: theme === 'light' ? '#FFFFFF' : '#FCD34D' }}
                >
                  ITSM Desk
                </span>
                <span
                  className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border"
                  style={{
                    borderColor:
                      theme === 'light' ? 'rgba(255,255,255,0.25)' : 'rgba(245,158,11,0.3)',
                    color: theme === 'light' ? '#FFFFFF' : '#FCD34D',
                  }}
                >
                  {theme === 'light' ? 'Marrom #3D2314' : 'Grafite #17181C'}
                </span>
              </div>

              {/* Itens do menu demonstrativo */}
              <div className="space-y-1 text-xs">
                {/* Item ativo */}
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold border-l-2"
                  style={{
                    backgroundColor:
                      theme === 'light' ? 'rgba(245,158,11,0.22)' : 'rgba(217,119,6,0.18)',
                    color: theme === 'light' ? '#FBBF24' : '#D97706',
                    borderColor: theme === 'light' ? '#F59E0B' : '#D97706',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-3.5 w-3.5"
                      style={{ color: theme === 'light' ? '#FBBF24' : '#D97706' }}
                    />
                    Dashboard Gerencial
                  </span>
                  <span
                    className="text-[10px] font-mono px-1 rounded"
                    style={{
                      backgroundColor:
                        theme === 'light' ? 'rgba(245,158,11,0.3)' : 'rgba(217,119,6,0.25)',
                      color: theme === 'light' ? '#FFFFFF' : '#D97706',
                    }}
                  >
                    Ativo
                  </span>
                </div>

                {/* Itens comuns */}
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md opacity-90 transition-colors"
                  style={{ color: theme === 'light' ? '#FFFFFF' : '#FCD34D' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(252,211,77,0.7)',
                    }}
                  />
                  <span>Fila de Chamados</span>
                </div>
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md opacity-90 transition-colors"
                  style={{ color: theme === 'light' ? '#FFFFFF' : '#FCD34D' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(252,211,77,0.7)',
                    }}
                  />
                  <span>CMDB & Ativos</span>
                </div>
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md opacity-90 transition-colors"
                  style={{ color: theme === 'light' ? '#FFFFFF' : '#FCD34D' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(252,211,77,0.7)',
                    }}
                  />
                  <span>Gestão de Mudanças</span>
                </div>
              </div>

              {/* Rodapé do mockup */}
              <div
                className="mt-4 pt-3 border-t flex items-center justify-between text-[10px] font-mono"
                style={{
                  borderColor:
                    theme === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                  color: theme === 'light' ? 'rgba(255,255,255,0.75)' : 'rgba(252,211,77,0.7)',
                }}
              >
                <span>ITSM Desk</span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: theme === 'light' ? '#FFFFFF' : '#FCD34D' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  ONLINE
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border/70 bg-secondary/15 text-xs text-muted-foreground leading-relaxed">
            <strong>Preservação Semântica e Acessibilidade:</strong> Em ambos os modos (Claro e
            Escuro), o significado das cores é estritamente preservado:{' '}
            <span className="text-red-500 font-semibold">Vermelho</span> para incidentes críticos e
            SLA estourado, <span className="text-amber-500 font-semibold">Laranja</span> para
            atenção/risco,{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verde</span> para
            resoluções concluídas e <span className="text-blue-500 font-semibold">Azul</span> para
            tickets em aberto.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
