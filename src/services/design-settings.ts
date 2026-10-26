import pb from '@/lib/pocketbase/client'

export type SystemThemeVariant = 'amber_alert' | 'amber_light' | 'corporate_blue' | 'teal_ops'

export interface DesignSettings {
  id?: string
  sidebar_bg_color: string
  sidebar_text_color: string
  system_theme_variant: SystemThemeVariant
  scope?: 'global'
  logo?: string
  report_logo?: string
  logo_url?: string
  report_logo_url?: string
  created?: string
  updated?: string
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  sidebar_bg_color: '#FFFFFF',
  sidebar_text_color: '#92400E',
  system_theme_variant: 'amber_alert',
  scope: 'global',
  logo: '',
  report_logo: '',
  logo_url: '',
  report_logo_url: '',
}

export interface ThemeVariantDefinition {
  id: SystemThemeVariant
  name: string
  mode: 'dark' | 'light'
  subtitle: string
  description: string
  primaryHex: string
  accentHex: string
  sidebarBgHex: string
  sidebarTextHex: string
  previewBg: string
  chips: string[]
  hslVariables: {
    primary: string
    primaryForeground: string
    accent: string
    accentForeground: string
    ring: string
    background?: string
    foreground?: string
    card?: string
    cardForeground?: string
    popover?: string
    popoverForeground?: string
    border?: string
    input?: string
    muted?: string
    mutedForeground?: string
    secondary?: string
    secondaryForeground?: string
    sidebarBackground?: string
    sidebarForeground?: string
    sidebarBorder?: string
    chart1: string
    chart2: string
    chart3: string
    chart4: string
    chart5: string
  }
}

/**
 * Temas do sistema ITSM:
 * 1. Amber Alert (Padrão escuro): Fundo grafite neutro #17181C, destaque âmbar #F59E0B e barra lateral BRANCA (#FFFFFF) com tipografia âmbar escuro (#92400E).
 * 2. Amber Light (Variação clara): Fundo BRANCO (#FFFFFF) para o app com barra lateral em Grafite Neutro (#17181C), letras dos menus principais brancas (#FFFFFF) e item selecionado/ativo em âmbar (#D97706).
 * 3. Corporate Blue Pro: Fundo azul-marinho profundo #0F1B33, primária #0052CC (azul Atlassian).
 * 4. Teal Ops: Fundo grafite-petróleo #101E20, primária #2DD4BF (teal).
 */
export const THEME_VARIANTS: ThemeVariantDefinition[] = [
  {
    id: 'amber_alert',
    name: 'Amber Alert (Padrão)',
    mode: 'dark',
    subtitle: 'Escuro com Menu Branco & Âmbar Escuro',
    description:
      'Tema escuro padrão com fundo grafite neutro (#17181C), primária âmbar (#F59E0B) e barra lateral branca (#FFFFFF) com textos e ícones em tons âmbar escuros (#92400E).',
    primaryHex: '#F59E0B',
    accentHex: '#FB923C',
    sidebarBgHex: '#FFFFFF',
    sidebarTextHex: '#92400E',
    previewBg: 'linear-gradient(135deg, #17181C 0%, #202227 55%, #292B32 100%)',
    chips: ['#F59E0B', '#92400E', '#FFFFFF', '#17181C'],
    hslVariables: {
      primary: '38 92% 50%', // #F59E0B
      primaryForeground: '24 80% 12%', // texto escuro sobre botão âmbar
      accent: '27 96% 61%', // #FB923C
      accentForeground: '0 0% 100%',
      ring: '38 92% 50%',
      background: '230 10% 10%', // #17181C
      foreground: '40 20% 96%', // #F5F3EF
      card: '230 9% 13.5%', // #1F2126
      cardForeground: '40 20% 96%',
      popover: '230 9% 12%',
      popoverForeground: '40 20% 96%',
      border: '230 8% 22%', // #31333A
      input: '230 8% 22%',
      muted: '230 9% 17%',
      mutedForeground: '230 8% 68%',
      secondary: '230 9% 19%',
      secondaryForeground: '40 20% 93%',
      sidebarBackground: '0 0% 100%', // #FFFFFF (Menu branco)
      sidebarForeground: '25 79% 31%', // #92400E (Âmbar escuro)
      sidebarBorder: '35 30% 90%', // Linha divisória sutil âmbar/cinza claro
      chart1: '38 92% 50%',
      chart2: '27 96% 61%',
      chart3: '45 93% 58%',
      chart4: '172 66% 50%',
      chart5: '0 84% 60%',
    },
  },
  {
    id: 'amber_light',
    name: 'Amber Light',
    mode: 'light',
    subtitle: 'Fundo Branco & Menu Grafite Neutro',
    description:
      'Tema claro com tela de fundo branca (#FFFFFF), cartões e textos em alto contraste e barra lateral em grafite neutro (#17181C) com letras brancas (#FFFFFF) e item ativo em âmbar (#D97706).',
    primaryHex: '#D97706',
    accentHex: '#F59E0B',
    sidebarBgHex: '#17181C',
    sidebarTextHex: '#FFFFFF',
    previewBg: 'linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 55%, #FEF3C7 100%)',
    chips: ['#17181C', '#D97706', '#F59E0B', '#FFFFFF'],
    hslVariables: {
      primary: '38 92% 44%', // #D97706 (ótimo contraste sobre fundo branco)
      primaryForeground: '0 0% 100%',
      accent: '38 92% 50%', // #F59E0B
      accentForeground: '24 80% 12%',
      ring: '38 92% 44%',
      background: '0 0% 100%', // #FFFFFF (Fundo da tela branco)
      foreground: '24 35% 13%', // #261D15 (Texto escuro altamente legível)
      card: '38 50% 99%', // Quase branco com sutil calor
      cardForeground: '24 35% 13%',
      popover: '0 0% 100%',
      popoverForeground: '24 35% 13%',
      border: '36 30% 88%', // Borda clara contrastada
      input: '36 30% 88%',
      muted: '38 40% 94%', // Fundo sutilmente apagado
      mutedForeground: '24 20% 42%',
      secondary: '38 45% 95%',
      secondaryForeground: '24 35% 16%',
      sidebarBackground: '230 10% 10%', // #17181C (Grafite neutro)
      sidebarForeground: '0 0% 100%', // #FFFFFF (Letras brancas)
      sidebarBorder: '230 8% 22%', // #31333A
      chart1: '38 92% 44%',
      chart2: '27 96% 50%',
      chart3: '160 84% 39%',
      chart4: '199 89% 48%',
      chart5: '0 84% 55%',
    },
  },
  {
    id: 'corporate_blue',
    name: 'Corporate Blue Pro',
    mode: 'dark',
    subtitle: 'Azul-Marinho Profundo & Atlassian Blue',
    description:
      'Visual corporativo de alta autoridade e sobriedade enterprise. Fundo marinho profundo com destaques em azul royal e tipografia cristalina.',
    primaryHex: '#0052CC',
    accentHex: '#2684FF',
    sidebarBgHex: '#0F1B33',
    sidebarTextHex: '#E2E8F0',
    previewBg: 'linear-gradient(135deg, #0F1B33 0%, #152442 55%, #1C3159 100%)',
    chips: ['#0052CC', '#2684FF', '#4C9AFF', '#0F1B33'],
    hslVariables: {
      primary: '216 100% 40%', // #0052CC
      primaryForeground: '0 0% 100%',
      accent: '214 100% 57%', // #2684FF
      accentForeground: '0 0% 100%',
      ring: '216 100% 50%',
      background: '220 54% 13%', // #0F1B33
      foreground: '210 40% 96%', // #E8EDF5
      card: '220 46% 16.5%', // #152442
      cardForeground: '210 40% 96%',
      popover: '220 48% 15%',
      popoverForeground: '210 40% 96%',
      border: '220 32% 24%', // #243555
      input: '220 32% 24%',
      muted: '220 38% 19%',
      mutedForeground: '215 20% 70%',
      secondary: '220 36% 21%',
      secondaryForeground: '210 40% 94%',
      sidebarBackground: '220 58% 11%', // #0B1426
      sidebarForeground: '214 32% 95%',
      sidebarBorder: '220 35% 19%',
      chart1: '216 100% 50%',
      chart2: '214 100% 60%',
      chart3: '172 66% 50%',
      chart4: '38 92% 50%',
      chart5: '280 80% 65%',
    },
  },
  {
    id: 'teal_ops',
    name: 'Teal Ops',
    mode: 'dark',
    subtitle: 'Grafite Petróleo & Teal Funcional',
    description:
      'Conforto visual para longas jornadas de operação ITSM. Tons frios e sóbrios, reservando vermelho e âmbar exclusivamente para riscos de SLA.',
    primaryHex: '#2DD4BF',
    accentHex: '#38BDF8',
    sidebarBgHex: '#101E20',
    sidebarTextHex: '#2DD4BF',
    previewBg: 'linear-gradient(135deg, #101E20 0%, #13272A 55%, #183337 100%)',
    chips: ['#2DD4BF', '#14B8A6', '#38BDF8', '#101E20'],
    hslVariables: {
      primary: '172 66% 50%', // #2DD4BF
      primaryForeground: '186 33% 9%', // #101E20
      accent: '199 89% 60%', // #38BDF8
      accentForeground: '0 0% 100%',
      ring: '172 66% 50%',
      background: '186 33% 9.5%', // #101E20
      foreground: '180 20% 96%', // #E8F7F6
      card: '186 28% 13%', // #152629
      cardForeground: '180 20% 96%',
      popover: '186 30% 12%',
      popoverForeground: '180 20% 96%',
      border: '186 22% 20%', // #22373A
      input: '186 22% 20%',
      muted: '186 25% 15%',
      mutedForeground: '180 14% 68%',
      secondary: '186 24% 17%',
      secondaryForeground: '180 20% 93%',
      sidebarBackground: '186 33% 8.5%', // #0E1A1C
      sidebarForeground: '172 66% 50%', // #2DD4BF
      sidebarBorder: '186 24% 16%',
      chart1: '172 66% 50%',
      chart2: '199 89% 60%',
      chart3: '160 84% 45%',
      chart4: '38 92% 50%',
      chart5: '0 84% 60%',
    },
  },
]

/**
 * Valida e normaliza um tema qualquer (incluindo migração de temas legados/teal_ops)
 * para o novo padrão amber_alert, preservando Corporate Blue Pro e Teal Ops quando explicitamente selecionados.
 */
export function normalizeThemeVariant(raw: any): SystemThemeVariant {
  if (
    raw === 'amber_alert' ||
    raw === 'amber_light' ||
    raw === 'corporate_blue' ||
    raw === 'teal_ops'
  ) {
    return raw
  }
  // Mapeamento semântico de legados:
  if (raw === 'ice_blue' || raw === 'neon_purple') {
    return 'corporate_blue'
  }
  // Demais legados ou não definidos viram o novo padrão amber_alert
  return 'amber_alert'
}

const STORAGE_KEY = 'itsm-design-settings'

/**
 * Lê configurações de design do cache local primeiro para carregamento instantâneo
 */
export function getCachedDesignSettings(): DesignSettings {
  if (typeof window === 'undefined') return DEFAULT_DESIGN_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const normalizedVariant = normalizeThemeVariant(parsed.system_theme_variant)
      const matchedTheme =
        THEME_VARIANTS.find((t) => t.id === normalizedVariant) || THEME_VARIANTS[0]

      let cachedSidebarBg = parsed.sidebar_bg_color || matchedTheme.sidebarBgHex
      let cachedSidebarText = parsed.sidebar_text_color || matchedTheme.sidebarTextHex
      if (normalizedVariant === 'amber_light' && cachedSidebarBg.toUpperCase() === '#78350F') {
        cachedSidebarBg = matchedTheme.sidebarBgHex
        cachedSidebarText = matchedTheme.sidebarTextHex
      }

      return {
        ...DEFAULT_DESIGN_SETTINGS,
        ...parsed,
        system_theme_variant: normalizedVariant,
        sidebar_bg_color: cachedSidebarBg,
        sidebar_text_color: cachedSidebarText,
      }
    }
  } catch {
    /* intentionally ignored */
  }
  return DEFAULT_DESIGN_SETTINGS
}

/**
 * Salva no localStorage para carregamento offline/instantâneo
 */
export function setCachedDesignSettings(settings: DesignSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* intentionally ignored */
  }
}

/**
 * Busca configurações do banco de dados (PocketBase). Se não houver, retorna o padrão.
 */
export async function getDesignSettings(): Promise<DesignSettings> {
  try {
    const records = await pb.collection('design_settings').getFullList<DesignSettings>({
      filter: 'scope = "global"',
      sort: '-created',
      requestKey: null,
    })
    if (records.length > 0) {
      const first = records[0]
      const logoUrl = first.logo ? pb.files.getURL(first, first.logo) : ''
      const reportLogoUrl = first.report_logo ? pb.files.getURL(first, first.report_logo) : ''

      const normalizedVariant = normalizeThemeVariant(first.system_theme_variant)
      const matchedTheme =
        THEME_VARIANTS.find((t) => t.id === normalizedVariant) || THEME_VARIANTS[0]

      // Se o tema for amber_light e o sidebar_bg_color gravado for o antigo #78350F, atualiza para o novo padrão #17181C
      let effectiveSidebarBg = first.sidebar_bg_color || matchedTheme.sidebarBgHex
      let effectiveSidebarText = first.sidebar_text_color || matchedTheme.sidebarTextHex
      if (normalizedVariant === 'amber_light' && effectiveSidebarBg.toUpperCase() === '#78350F') {
        effectiveSidebarBg = matchedTheme.sidebarBgHex
        effectiveSidebarText = matchedTheme.sidebarTextHex
      }

      const merged: DesignSettings = {
        id: first.id,
        sidebar_bg_color: effectiveSidebarBg,
        sidebar_text_color: effectiveSidebarText,
        system_theme_variant: normalizedVariant,
        scope: 'global',
        logo: first.logo || '',
        report_logo: first.report_logo || '',
        logo_url: logoUrl,
        report_logo_url: reportLogoUrl,
        created: first.created,
        updated: first.updated,
      }
      setCachedDesignSettings(merged)
      return merged
    }
  } catch (err) {
    console.warn('Erro ao buscar design_settings no PocketBase:', err)
  }
  return getCachedDesignSettings()
}

/**
 * Salva configurações de design no banco e atualiza cache
 */
export async function saveDesignSettings(
  data: Partial<Omit<DesignSettings, 'id' | 'created' | 'updated'>>,
): Promise<DesignSettings> {
  const current = await getDesignSettings()
  const payload: Record<string, any> = {
    sidebar_bg_color: data.sidebar_bg_color ?? current.sidebar_bg_color,
    sidebar_text_color: data.sidebar_text_color ?? current.sidebar_text_color,
    system_theme_variant: data.system_theme_variant ?? current.system_theme_variant,
    scope: 'global',
  }

  if (data.logo !== undefined) {
    payload.logo = data.logo
  }
  if (data.report_logo !== undefined) {
    payload.report_logo = data.report_logo
  }

  let savedRecord: any
  if (current.id) {
    savedRecord = await pb.collection('design_settings').update(current.id, payload)
  } else {
    try {
      const existing = await pb.collection('design_settings').getFirstListItem('scope = "global"')
      savedRecord = await pb.collection('design_settings').update(existing.id, payload)
    } catch (_) {
      savedRecord = await pb.collection('design_settings').create(payload)
    }
  }

  const logoUrl = savedRecord.logo ? pb.files.getURL(savedRecord, savedRecord.logo) : ''
  const reportLogoUrl = savedRecord.report_logo
    ? pb.files.getURL(savedRecord, savedRecord.report_logo)
    : ''

  const normalizedVariant = normalizeThemeVariant(savedRecord.system_theme_variant)
  const result: DesignSettings = {
    id: savedRecord.id,
    sidebar_bg_color: savedRecord.sidebar_bg_color,
    sidebar_text_color: savedRecord.sidebar_text_color,
    system_theme_variant: normalizedVariant,
    scope: 'global',
    logo: savedRecord.logo || '',
    report_logo: savedRecord.report_logo || '',
    logo_url: logoUrl,
    report_logo_url: reportLogoUrl,
    created: savedRecord.created,
    updated: savedRecord.updated,
  }
  setCachedDesignSettings(result)
  return result
}

/**
 * Validação de tamanho e formato de arquivo de logotipo
 */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2MB
export const LOGO_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
]

export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return {
      valid: false,
      error: `O arquivo excede o limite máximo permitido de 2MB (${(file.size / (1024 * 1024)).toFixed(2)}MB). Escolha uma imagem menor.`,
    }
  }
  const type = file.type?.toLowerCase() || ''
  const isAllowedExt = /\.(png|jpe?g|svg|webp)$/i.test(file.name)
  if (!LOGO_ALLOWED_TYPES.includes(type) && !isAllowedExt) {
    return {
      valid: false,
      error: 'Formato inválido. Por favor envie uma imagem nos formatos aceitos: PNG, JPG ou SVG.',
    }
  }
  return { valid: true }
}

/**
 * Envia um arquivo de logotipo (geral do sistema ou de relatórios) usando FormData
 */
export async function uploadLogo(
  file: File,
  type: 'logo' | 'report_logo',
): Promise<DesignSettings> {
  const validation = validateLogoFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const current = await getDesignSettings()
  const formData = new FormData()
  formData.append(type, file)

  let savedRecord: any
  if (current.id) {
    savedRecord = await pb.collection('design_settings').update(current.id, formData)
  } else {
    try {
      const existing = await pb.collection('design_settings').getFirstListItem('scope = "global"')
      savedRecord = await pb.collection('design_settings').update(existing.id, formData)
    } catch (_) {
      formData.append('scope', 'global')
      savedRecord = await pb.collection('design_settings').create(formData)
    }
  }

  const logoUrl = savedRecord.logo ? pb.files.getURL(savedRecord, savedRecord.logo) : ''
  const reportLogoUrl = savedRecord.report_logo
    ? pb.files.getURL(savedRecord, savedRecord.report_logo)
    : ''

  const result: DesignSettings = {
    id: savedRecord.id,
    sidebar_bg_color: savedRecord.sidebar_bg_color,
    sidebar_text_color: savedRecord.sidebar_text_color,
    system_theme_variant: savedRecord.system_theme_variant,
    scope: 'global',
    logo: savedRecord.logo || '',
    report_logo: savedRecord.report_logo || '',
    logo_url: logoUrl,
    report_logo_url: reportLogoUrl,
    created: savedRecord.created,
    updated: savedRecord.updated,
  }
  setCachedDesignSettings(result)
  return result
}

/**
 * Remove um logotipo (geral ou de relatórios) passando null/string vazia
 */
export async function removeLogo(type: 'logo' | 'report_logo'): Promise<DesignSettings> {
  const current = await getDesignSettings()
  if (!current.id) {
    const updated = { ...current, [type]: '', [`${type}_url`]: '' }
    setCachedDesignSettings(updated)
    return updated
  }

  const savedRecord = await pb.collection('design_settings').update(current.id, {
    [type]: null,
  })

  const logoUrl = savedRecord.logo ? pb.files.getURL(savedRecord, savedRecord.logo) : ''
  const reportLogoUrl = savedRecord.report_logo
    ? pb.files.getURL(savedRecord, savedRecord.report_logo)
    : ''

  const result: DesignSettings = {
    id: savedRecord.id,
    sidebar_bg_color: savedRecord.sidebar_bg_color,
    sidebar_text_color: savedRecord.sidebar_text_color,
    system_theme_variant: savedRecord.system_theme_variant,
    scope: 'global',
    logo: savedRecord.logo || '',
    report_logo: savedRecord.report_logo || '',
    logo_url: logoUrl,
    report_logo_url: reportLogoUrl,
    created: savedRecord.created,
    updated: savedRecord.updated,
  }
  setCachedDesignSettings(result)
  return result
}

/**
 * Copia o logotipo principal para o logotipo de relatórios/documentos
 */
export async function copySystemLogoToReports(): Promise<DesignSettings> {
  const current = await getDesignSettings()
  if (!current.id || !current.logo) {
    throw new Error('Não há logotipo do sistema configurado para replicar.')
  }

  // Baixa o blob do logo do sistema e envia como report_logo
  const logoUrl =
    current.logo_url ||
    pb.files.getURL({ id: current.id, collectionName: 'design_settings' } as any, current.logo)
  const response = await fetch(logoUrl)
  if (!response.ok) {
    throw new Error('Falha ao obter o logotipo do sistema.')
  }
  const blob = await response.blob()
  const ext = current.logo.split('.').pop() || 'png'
  const file = new File([blob], `report_logo.${ext}`, { type: blob.type })
  return uploadLogo(file, 'report_logo')
}

// Alias de retrocompatibilidade
export const useSystemLogoForReports = copySystemLogoToReports

/**
 * Aplica as propriedades CSS no elemento raiz (:root / document.documentElement)
 */
export function applyDesignToDOM(settings: DesignSettings, isDark: boolean = true): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // 1. Variação do tema do sistema (Primária, Acento, Gráficos, Background, Foreground, etc.)
  const normalized = normalizeThemeVariant(settings.system_theme_variant)
  const variant = THEME_VARIANTS.find((v) => v.id === normalized) || THEME_VARIANTS[0]

  // Atributo no elemento HTML para facilitar seletores CSS específicos de variante se necessário
  root.setAttribute('data-theme-variant', variant.id)

  // 2. Variáveis CSS da Barra Lateral
  if (settings.sidebar_bg_color) {
    root.style.setProperty('--custom-sidebar-bg', settings.sidebar_bg_color)
  }
  if (settings.sidebar_text_color) {
    root.style.setProperty('--custom-sidebar-text', settings.sidebar_text_color)
  }
  // Cor do item ativo na barra lateral (no tema amber_light o item ativo tem letras/ícones em #D97706)
  root.style.setProperty(
    '--sidebar-active-color',
    variant.id === 'amber_light'
      ? '#d97706'
      : settings.sidebar_text_color || variant.sidebarTextHex,
  )

  // Determina se o modo do variant é claro ou escuro
  const isThemeVariantLight = variant.mode === 'light' || (!isDark && normalized === 'amber_alert')
  if (isThemeVariantLight) {
    root.classList.remove('dark')
  } else {
    root.classList.add('dark')
  }

  // Aplicação de variáveis HSL do variant
  root.style.setProperty('--primary', variant.hslVariables.primary)
  root.style.setProperty('--primary-foreground', variant.hslVariables.primaryForeground)
  root.style.setProperty('--accent', variant.hslVariables.accent)
  root.style.setProperty('--accent-foreground', variant.hslVariables.accentForeground)
  root.style.setProperty('--ring', variant.hslVariables.ring)
  root.style.setProperty('--sidebar-primary', variant.hslVariables.primary)
  root.style.setProperty('--sidebar-primary-foreground', variant.hslVariables.primaryForeground)
  root.style.setProperty('--sidebar-ring', variant.hslVariables.ring)
  root.style.setProperty('--sidebar-accent-foreground', variant.hslVariables.primary)
  root.style.setProperty('--chart-1', variant.hslVariables.chart1)
  root.style.setProperty('--chart-2', variant.hslVariables.chart2)
  root.style.setProperty('--chart-3', variant.hslVariables.chart3)
  root.style.setProperty('--chart-4', variant.hslVariables.chart4)
  root.style.setProperty('--chart-5', variant.hslVariables.chart5)

  // Variáveis semânticas estruturais: background, foreground, card, border, muted, secondary
  if (variant.hslVariables.background) {
    root.style.setProperty('--background', variant.hslVariables.background)
  }
  if (variant.hslVariables.foreground) {
    root.style.setProperty('--foreground', variant.hslVariables.foreground)
  }
  if (variant.hslVariables.card) {
    root.style.setProperty('--card', variant.hslVariables.card)
  }
  if (variant.hslVariables.cardForeground) {
    root.style.setProperty('--card-foreground', variant.hslVariables.cardForeground)
  }
  if (variant.hslVariables.popover) {
    root.style.setProperty('--popover', variant.hslVariables.popover)
  }
  if (variant.hslVariables.popoverForeground) {
    root.style.setProperty('--popover-foreground', variant.hslVariables.popoverForeground)
  }
  if (variant.hslVariables.border) {
    root.style.setProperty('--border', variant.hslVariables.border)
  }
  if (variant.hslVariables.input) {
    root.style.setProperty('--input', variant.hslVariables.input)
  }
  if (variant.hslVariables.muted) {
    root.style.setProperty('--muted', variant.hslVariables.muted)
  }
  if (variant.hslVariables.mutedForeground) {
    root.style.setProperty('--muted-foreground', variant.hslVariables.mutedForeground)
  }
  if (variant.hslVariables.secondary) {
    root.style.setProperty('--secondary', variant.hslVariables.secondary)
  }
  if (variant.hslVariables.secondaryForeground) {
    root.style.setProperty('--secondary-foreground', variant.hslVariables.secondaryForeground)
  }
  if (variant.hslVariables.sidebarBackground) {
    root.style.setProperty('--sidebar-background', variant.hslVariables.sidebarBackground)
  }
  if (variant.hslVariables.sidebarForeground) {
    root.style.setProperty('--sidebar-foreground', variant.hslVariables.sidebarForeground)
  }
  if (variant.hslVariables.sidebarBorder) {
    root.style.setProperty('--sidebar-border', variant.hslVariables.sidebarBorder)
  }
}

/**
 * Calcula luminância relativa para avaliar contraste (WCAG)
 */
export function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return 0.5
  let r = 0,
    g = 0,
    b = 0
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16)
    g = parseInt(cleanHex[1] + cleanHex[1], 16)
    b = parseInt(cleanHex[2] + cleanHex[2], 16)
  } else {
    r = parseInt(cleanHex.substring(0, 2), 16)
    g = parseInt(cleanHex.substring(2, 4), 16)
    b = parseInt(cleanHex.substring(4, 6), 16)
  }
  const toLinear = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Calcula ratio de contraste entre duas cores hexadecimais (ex: 4.5:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1)
  const l2 = getRelativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
