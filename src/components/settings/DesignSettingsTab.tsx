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
} from '@/services/design-settings'
import {
  Loader2,
  Upload,
  Trash2,
  Copy,
  FileImage,
  ImageIcon,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'

interface DesignSettingsTabProps {
  isAdminOrGestor: boolean
}

export function DesignSettingsTab({ isAdminOrGestor }: DesignSettingsTabProps) {
  const { toast } = useToast()
  const { designSettings, refreshDesignSettings } = useTheme()

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

      {/* SEÇÃO 2: TEMA ÚNICO OFICIAL DO SISTEMA */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Padrão de Design & Experiência (UX Oficial)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                O sistema é configurado no tema oficial único {OFFICIAL_THEME.name}, garantindo
                consistência visual em todas as telas, alto contraste e conformidade WCAG AA.
              </CardDescription>
            </div>

            <Badge
              variant="secondary"
              className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold px-2.5 py-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Tema Ativo: {OFFICIAL_THEME.name}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg border border-border/80 bg-secondary/20 space-y-1.5">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Fundo do Sistema
              </span>
              <p className="text-sm font-semibold text-foreground">Grafite Escuro Neutro</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="h-3.5 w-3.5 rounded-full bg-[#17181C] border border-white/20" />
                #17181C
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border/80 bg-secondary/20 space-y-1.5">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Barra Lateral
              </span>
              <p className="text-sm font-semibold text-foreground">Grafite com Tipografia Âmbar</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="h-3.5 w-3.5 rounded-full bg-[#17181C] border border-amber-500/30" />
                #17181C / #FCD34D
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border/80 bg-secondary/20 space-y-1.5">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Ação Primária & Destaque
              </span>
              <p className="text-sm font-semibold text-foreground">Âmbar Oficial ITSM</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="h-3.5 w-3.5 rounded-full bg-[#F59E0B]" />
                #F59E0B / #D97706
              </div>
            </div>
          </div>

          {/* Mini-mockup / Demonstração ao vivo da barra lateral grafite */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Demonstração ao Vivo da Barra Lateral
            </span>
            <div className="rounded-xl border border-border/80 bg-[#17181C] p-4 text-foreground shadow-inner max-w-sm">
              {/* Topo do mockup */}
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D97706] shadow-[0_0_8px_rgba(217,119,6,0.6)]" />
                <span className="text-sm font-bold tracking-tight text-[#FCD34D]">ITSM Desk</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-[9px] border-amber-500/30 text-[#FCD34D] py-0 px-1.5"
                >
                  Grafite #17181C
                </Badge>
              </div>

              {/* Itens do menu demonstrativo */}
              <div className="space-y-1 text-xs">
                {/* Item ativo */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#D97706]/15 text-[#D97706] font-semibold border-l-2 border-[#D97706]">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#D97706]" />
                    Dashboard Executivo
                  </span>
                  <span className="text-[10px] font-mono text-[#D97706] bg-[#D97706]/20 px-1 rounded">
                    Ativo
                  </span>
                </div>

                {/* Itens comuns */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[#FCD34D] opacity-90 hover:bg-white/5 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FCD34D]/60" />
                  <span>Fila de Chamados</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[#FCD34D] opacity-90 hover:bg-white/5 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FCD34D]/60" />
                  <span>CMDB & Ativos</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[#FCD34D] opacity-90 hover:bg-white/5 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FCD34D]/60" />
                  <span>Gestão de Mudanças</span>
                </div>
              </div>

              {/* Rodapé do mockup */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-[#FCD34D]/70">
                <span>ITSM Desk</span>
                <span className="inline-flex items-center gap-1.5 text-[#FCD34D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  ONLINE
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border/60 bg-secondary/10 text-xs text-muted-foreground leading-relaxed">
            As cores funcionais do sistema seguem uma hierarquia estrita de significado: vermelho
            para incidentes críticos e estouro de SLA, laranja para riscos e atenção, verde para
            resoluções concluídas e azul para novos chamados em aberto.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
