import pb from '@/lib/pocketbase/client'

export type SystemThemeVariant = 'teal_ops' | 'corporate_blue' | 'amber_alert'

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
  sidebar_bg_color: '#101E20',
  sidebar_text_color: '#2DD4BF',
  system_theme_variant: 'teal_ops',
  scope: 'global',
  logo: '',
  report_logo: '',
  logo_url: '',
  report_logo_url: '',
}

export interface ThemeVariantDefinition {
  id: SystemThemeVariant
  name: string
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
 * Os 3 únicos temas definidos pela consultoria de Design ITSM:
 * 1. Teal Ops (Padrão recomendado): Fundo grafite-petróleo #101E20, primária #2DD4BF (teal)
 * 2. Corporate Blue Pro: Fundo azul-marinho profundo #0F1B33, primária #0052CC (azul Atlassian)
 * 3. Amber Alert: Fundo grafite neutro #17181C, primária #F59E0B (âmbar operacional)
 */
export const THEME_VARIANTS: ThemeVariantDefinition[] = [
  {
    id: 'teal_ops',
    name: 'Teal Ops (Recomendado)',
    subtitle: 'Grafite Petróleo & Teal Funcional',
    description:
      'Conforto visual extremo para longas jornadas de operação ITSM. Tons frios e sóbrios, reservando vermelho e âmbar exclusivamente para riscos de SLA.',
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
  {
    id: 'corporate_blue',
    name: 'Corporate Blue Pro',
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
    id: 'amber_alert',
    name: 'Amber Alert',
    subtitle: 'Grafite Neutro & Âmbar Operacional',
    description:
      'Visual industrial de alto contraste e linguagem funcional. Acentos em âmbar de advertência com vermelho estritamente reservado para SLA crítico.',
    primaryHex: '#F59E0B',
    accentHex: '#FB923C',
    sidebarBgHex: '#17181C',
    sidebarTextHex: '#F59E0B',
    previewBg: 'linear-gradient(135deg, #17181C 0%, #202227 55%, #292B32 100%)',
    chips: ['#F59E0B', '#D97706', '#FB923C', '#17181C'],
    hslVariables: {
      primary: '38 92% 50%', // #F59E0B
      primaryForeground: '225 15% 10%', // #17181C
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
      sidebarBackground: '230 12% 9%', // #131417
      sidebarForeground: '38 92% 50%', // #F59E0B
      sidebarBorder: '230 9% 17%',
      chart1: '38 92% 50%',
      chart2: '27 96% 61%',
      chart3: '45 93% 58%',
      chart4: '172 66% 50%',
      chart5: '0 84% 60%',
    },
  },
]

/**
 * Valida e normaliza um tema qualquer (incluindo migração de temas legados)
 * para um dos 3 temas suportados, garantindo compatibilidade.
 */
export function normalizeThemeVariant(raw: any): SystemThemeVariant {
  if (raw === 'teal_ops' || raw === 'corporate_blue' || raw === 'amber_alert') {
    return raw
  }
  // Mapeamento semântico de legados para os 3 novos:
  if (raw === 'emerald_teal' || raw === 'cyber_cyan') {
    return 'teal_ops'
  }
  if (raw === 'ice_blue' || raw === 'neon_purple') {
    return 'corporate_blue'
  }
  if (raw === 'solar_amber' || raw === 'candy') {
    return 'amber_alert'
  }
  return 'teal_ops'
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

      return {
        ...DEFAULT_DESIGN_SETTINGS,
        ...parsed,
        system_theme_variant: normalizedVariant,
        sidebar_bg_color: parsed.sidebar_bg_color || matchedTheme.sidebarBgHex,
        sidebar_text_color: parsed.sidebar_text_color || matchedTheme.sidebarTextHex,
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

      const merged: DesignSettings = {
        id: first.id,
        sidebar_bg_color: first.sidebar_bg_color || matchedTheme.sidebarBgHex,
        sidebar_text_color: first.sidebar_text_color || matchedTheme.sidebarTextHex,
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

  // 1. Variáveis CSS da Barra Lateral
  if (settings.sidebar_bg_color) {
    root.style.setProperty('--custom-sidebar-bg', settings.sidebar_bg_color)
  }
  if (settings.sidebar_text_color) {
    root.style.setProperty('--custom-sidebar-text', settings.sidebar_text_color)
  }

  // 2. Variação do tema do sistema (Primária, Acento, Gráficos, Background, Foreground, etc.)
  const normalized = normalizeThemeVariant(settings.system_theme_variant)
  const variant = THEME_VARIANTS.find((v) => v.id === normalized) || THEME_VARIANTS[0]

  // Todos os 3 novos temas são dark tech de alta performance e contraste
  root.classList.add('dark')

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
