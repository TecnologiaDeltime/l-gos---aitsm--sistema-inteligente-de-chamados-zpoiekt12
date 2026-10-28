import pb from '@/lib/pocketbase/client'

export type SystemThemeVariant = 'amber_alert'

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

export const OFFICIAL_THEME = {
  id: 'amber_alert' as const,
  name: 'Amber Alert',
  mode: 'dark' as const,
  subtitle: 'Fundo Grafite Neutro & Barra Lateral Grafite #17181C',
  description:
    'Tema oficial único do sistema: fundo e barra lateral em grafite escuro (#17181C), com tipografia e ícones em âmbar suave (#FCD34D / #F5F3EF), item ativo em destaque âmbar (#D97706) e ação primária âmbar (#F59E0B).',
  primaryHex: '#F59E0B',
  accentHex: '#D97706',
  sidebarBgHex: '#17181C',
  sidebarTextHex: '#FCD34D',
  sidebarActiveHex: '#D97706',
  hslVariables: {
    primary: '38 92% 50%', // #F59E0B
    primaryForeground: '24 80% 12%', // texto escuro de alto contraste sobre botão âmbar
    accent: '38 92% 44%', // #D97706
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
    sidebarBackground: '230 10% 10%', // #17181C (Barra grafite escuro)
    sidebarForeground: '45 93% 65%', // #FCD34D (Âmbar suave legível sobre grafite)
    sidebarBorder: '230 8% 20%', // Borda sutil grafite escuro
    chart1: '38 92% 50%',
    chart2: '27 96% 50%',
    chart3: '45 93% 58%',
    chart4: '142 71% 45%', // funcional verde
    chart5: '0 72% 51%', // funcional vermelho
  },
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  sidebar_bg_color: '#17181C',
  sidebar_text_color: '#FCD34D',
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
  mode: 'dark'
  subtitle: string
  description: string
  primaryHex: string
  accentHex: string
  sidebarBgHex: string
  sidebarTextHex: string
  previewBg: string
  chips: string[]
  hslVariables: typeof OFFICIAL_THEME.hslVariables
}

/**
 * Tema único oficial do sistema ITSM.
 */
export const THEME_VARIANTS: ThemeVariantDefinition[] = [
  {
    id: 'amber_alert',
    name: 'Amber Alert (Oficial)',
    mode: 'dark',
    subtitle: OFFICIAL_THEME.subtitle,
    description: OFFICIAL_THEME.description,
    primaryHex: OFFICIAL_THEME.primaryHex,
    accentHex: OFFICIAL_THEME.accentHex,
    sidebarBgHex: OFFICIAL_THEME.sidebarBgHex,
    sidebarTextHex: OFFICIAL_THEME.sidebarTextHex,
    previewBg: 'linear-gradient(135deg, #17181C 0%, #202227 55%, #292B32 100%)',
    chips: ['#F59E0B', '#FCD34D', '#D97706', '#17181C', '#23252B'],
    hslVariables: OFFICIAL_THEME.hslVariables,
  },
]

/**
 * Valida e normaliza qualquer tema para o único tema oficial Amber Alert.
 * Qualquer registro salvo anteriormente (amber_light, corporate_blue, teal_ops, etc.)
 * é automaticamente normalizado para 'amber_alert'.
 */
export function normalizeThemeVariant(_raw?: any): SystemThemeVariant {
  return 'amber_alert'
}

const STORAGE_KEY = 'itsm-design-settings'

/**
 * Lê configurações de design do cache local primeiro para carregamento instantâneo sem flash.
 */
export function getCachedDesignSettings(): DesignSettings {
  if (typeof window === 'undefined') return DEFAULT_DESIGN_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_DESIGN_SETTINGS,
        ...parsed,
        system_theme_variant: 'amber_alert',
        sidebar_bg_color: '#17181C',
        sidebar_text_color: '#FCD34D',
      }
    }
  } catch {
    /* intentionally ignored */
  }
  return DEFAULT_DESIGN_SETTINGS
}

/**
 * Salva no localStorage para carregamento offline/instantâneo.
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
 * Qualquer tema diferente de amber_alert é normalizado imediatamente.
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

      const merged: DesignSettings = {
        id: first.id,
        sidebar_bg_color: '#17181C',
        sidebar_text_color: '#FCD34D',
        system_theme_variant: 'amber_alert',
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
 * Salva configurações de design no banco e atualiza cache.
 * Fixa o tema em amber_alert e a barra lateral no padrão oficial.
 */
export async function saveDesignSettings(
  data: Partial<Omit<DesignSettings, 'id' | 'created' | 'updated'>>,
): Promise<DesignSettings> {
  const current = await getDesignSettings()
  const payload: Record<string, any> = {
    sidebar_bg_color: '#17181C',
    sidebar_text_color: '#FCD34D',
    system_theme_variant: 'amber_alert',
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

  const result: DesignSettings = {
    id: savedRecord.id,
    sidebar_bg_color: '#17181C',
    sidebar_text_color: '#FCD34D',
    system_theme_variant: 'amber_alert',
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
  formData.append('system_theme_variant', 'amber_alert')
  formData.append('sidebar_bg_color', '#17181C')
  formData.append('sidebar_text_color', '#FCD34D')

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
    sidebar_bg_color: '#17181C',
    sidebar_text_color: '#FCD34D',
    system_theme_variant: 'amber_alert',
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
    sidebar_bg_color: '#17181C',
    sidebar_text_color: '#FCD34D',
    system_theme_variant: 'amber_alert',
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
 * Aplica o tema único Amber Alert escuro e a barra lateral branca no DOM.
 */
export function applyDesignToDOM(_settings?: DesignSettings, _isDark?: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const v = OFFICIAL_THEME

  // Força sempre o tema Amber Alert no DOM
  root.setAttribute('data-theme-variant', 'amber_alert')
  root.classList.add('dark')

  // Barra lateral GRAFITE ESCURO #17181C com letras âmbar suave #FCD34D e item ativo #D97706
  root.style.setProperty('--custom-sidebar-bg', '#17181C')
  root.style.setProperty('--custom-sidebar-text', '#FCD34D')
  root.style.setProperty('--sidebar-active-color', '#D97706')

  // Variáveis HSL semânticas
  root.style.setProperty('--primary', v.hslVariables.primary)
  root.style.setProperty('--primary-foreground', v.hslVariables.primaryForeground)
  root.style.setProperty('--accent', v.hslVariables.accent)
  root.style.setProperty('--accent-foreground', v.hslVariables.accentForeground)
  root.style.setProperty('--ring', v.hslVariables.ring)

  root.style.setProperty('--background', v.hslVariables.background)
  root.style.setProperty('--foreground', v.hslVariables.foreground)
  root.style.setProperty('--card', v.hslVariables.card)
  root.style.setProperty('--card-foreground', v.hslVariables.cardForeground)
  root.style.setProperty('--popover', v.hslVariables.popover)
  root.style.setProperty('--popover-foreground', v.hslVariables.popoverForeground)
  root.style.setProperty('--border', v.hslVariables.border)
  root.style.setProperty('--input', v.hslVariables.input)
  root.style.setProperty('--muted', v.hslVariables.muted)
  root.style.setProperty('--muted-foreground', v.hslVariables.mutedForeground)
  root.style.setProperty('--secondary', v.hslVariables.secondary)
  root.style.setProperty('--secondary-foreground', v.hslVariables.secondaryForeground)

  // Sidebar variáveis HSL
  root.style.setProperty('--sidebar-background', v.hslVariables.sidebarBackground)
  root.style.setProperty('--sidebar-foreground', v.hslVariables.sidebarForeground)
  root.style.setProperty('--sidebar-border', v.hslVariables.sidebarBorder)
  root.style.setProperty('--sidebar-primary', v.hslVariables.primary)
  root.style.setProperty('--sidebar-primary-foreground', v.hslVariables.primaryForeground)
  root.style.setProperty('--sidebar-ring', v.hslVariables.ring)
  root.style.setProperty('--sidebar-accent', '230 9% 16%') // Fundo sutil para hover na barra grafite escuro (#202227)
  root.style.setProperty('--sidebar-accent-foreground', '45 93% 65%')

  // Gráficos
  root.style.setProperty('--chart-1', v.hslVariables.chart1)
  root.style.setProperty('--chart-2', v.hslVariables.chart2)
  root.style.setProperty('--chart-3', v.hslVariables.chart3)
  root.style.setProperty('--chart-4', v.hslVariables.chart4)
  root.style.setProperty('--chart-5', v.hslVariables.chart5)
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
