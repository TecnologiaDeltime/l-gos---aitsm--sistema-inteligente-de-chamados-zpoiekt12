import pb from '@/lib/pocketbase/client'

export type SystemThemeVariant =
  | 'cyber_cyan'
  | 'neon_purple'
  | 'emerald_teal'
  | 'ice_blue'
  | 'solar_amber'
  | 'candy'

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
  sidebar_bg_color: '#070b14',
  sidebar_text_color: '#22d3ee',
  system_theme_variant: 'cyber_cyan',
  scope: 'global',
  logo: '',
  report_logo: '',
  logo_url: '',
  report_logo_url: '',
}

export interface SidebarSwatch {
  label: string
  value: string
  desc: string
  tone: 'dark' | 'light'
  defaultText: string
}

// Swatches predefinidos harmoniosos para a barra lateral (combinando opções escuras e claras)
export const SIDEBAR_BG_SWATCHES: SidebarSwatch[] = [
  // Swatches Escuros (Dark Tech)
  {
    label: 'Dark Tech Original',
    value: '#070b14',
    desc: 'Preto slate tecnológico profundo',
    tone: 'dark',
    defaultText: '#22d3ee',
  },
  {
    label: 'Azul Marinho Tech',
    value: '#0a1628',
    desc: 'Marinho aeroespacial com tom azulado',
    tone: 'dark',
    defaultText: '#38bdf8',
  },
  {
    label: 'Grafite Ônix',
    value: '#121824',
    desc: 'Cinza grafite escuro com alto contraste',
    tone: 'dark',
    defaultText: '#ffffff',
  },
  {
    label: 'Violeta Escuro',
    value: '#130d24',
    desc: 'Roxo sideral escuro cyberpunk',
    tone: 'dark',
    defaultText: '#c084fc',
  },
  {
    label: 'Verde Petróleo Escuro',
    value: '#071b18',
    desc: 'Teal esmeralda escuro profundo',
    tone: 'dark',
    defaultText: '#34d399',
  },
  {
    label: 'Carvão Neutro',
    value: '#18181b',
    desc: 'Cinza carvão neutro zinc/slate',
    tone: 'dark',
    defaultText: '#e2e8f0',
  },
  // Swatches Claros (Light / Soft) - combinando harmoniosamente com o sistema
  {
    label: 'Azul Claro Sky',
    value: '#E8F1FA',
    desc: 'Azul céu suave e arejado',
    tone: 'light',
    defaultText: '#1e293b',
  },
  {
    label: 'Cinza Perla',
    value: '#F1F3F5',
    desc: 'Neutro contemporâneo elegante',
    tone: 'light',
    defaultText: '#0f172a',
  },
  {
    label: 'Lavanda Suave',
    value: '#EDE9F7',
    desc: 'Lavanda pastel refinada e calma',
    tone: 'light',
    defaultText: '#2e1065',
  },
  {
    label: 'Verde Menta Claro',
    value: '#E6F6F0',
    desc: 'Menta bio-tech refrescante e limpa',
    tone: 'light',
    defaultText: '#064e3b',
  },
  {
    label: 'Âmbar Claro / Bege',
    value: '#F5EFE3',
    desc: 'Bege quente sofisticado e acolhedor',
    tone: 'light',
    defaultText: '#451a03',
  },
]

// Swatches predefinidos para letras e ícones da barra lateral
export const SIDEBAR_TEXT_SWATCHES = [
  { label: 'Ciano Neon', value: '#22d3ee', desc: 'Ciano elétrico padrão ServiceOne' },
  { label: 'Branco Puro', value: '#ffffff', desc: 'Contraste máximo e leitura cristalina' },
  { label: 'Cinza Prateado', value: '#e2e8f0', desc: 'Slate prateado suave e elegante' },
  { label: 'Violeta Magenta', value: '#c084fc', desc: 'Roxo neon elétrico' },
  { label: 'Esmeralda Neon', value: '#34d399', desc: 'Verde esmeralda vibrante' },
  { label: 'Âmbar Elétrico', value: '#fbbf24', desc: 'Dourado tecnológico de alta visibilidade' },
]

export interface ThemeVariantDefinition {
  id: SystemThemeVariant
  name: string
  subtitle: string
  description: string
  primaryHex: string
  accentHex: string
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

export const THEME_VARIANTS: ThemeVariantDefinition[] = [
  {
    id: 'cyber_cyan',
    name: 'Cyber Cyan (Padrão)',
    subtitle: 'Azul Elétrico & Ciano Neon',
    description: 'Visual dark tech original com destaque ciano e azul elétrico.',
    primaryHex: '#06b6d4',
    accentHex: '#8b5cf6',
    previewBg: 'linear-gradient(135deg, #070b14 0%, #0e2439 50%, #161a33 100%)',
    chips: ['#06b6d4', '#3b82f6', '#8b5cf6'],
    hslVariables: {
      primary: '200 98% 50%',
      primaryForeground: '225 50% 6%',
      accent: '250 85% 65%',
      accentForeground: '0 0% 100%',
      ring: '200 98% 50%',
      background: '228 35% 6%',
      foreground: '214 32% 95%',
      card: '226 30% 9.5%',
      cardForeground: '214 32% 95%',
      popover: '226 32% 11%',
      popoverForeground: '214 32% 95%',
      border: '226 24% 18%',
      input: '226 24% 18%',
      muted: '226 28% 12.5%',
      mutedForeground: '217 19% 68%',
      secondary: '226 26% 14%',
      secondaryForeground: '214 32% 92%',
      sidebarBackground: '228 38% 5%',
      sidebarForeground: '214 32% 94%',
      sidebarBorder: '226 24% 15%',
      chart1: '200 98% 50%',
      chart2: '152 80% 48%',
      chart3: '260 90% 66%',
      chart4: '38 96% 54%',
      chart5: '340 85% 60%',
    },
  },
  {
    id: 'neon_purple',
    name: 'Neon Purple & Magenta',
    subtitle: 'Violeta Profundo & Magenta Elétrico',
    description: 'Variação elegante com acentos em roxo neon, fúcsia e azul índigo.',
    primaryHex: '#a855f7',
    accentHex: '#ec4899',
    previewBg: 'linear-gradient(135deg, #0d0a1a 0%, #201138 50%, #2d0f36 100%)',
    chips: ['#a855f7', '#c084fc', '#ec4899'],
    hslVariables: {
      primary: '272 90% 65%',
      primaryForeground: '270 50% 6%',
      accent: '320 85% 60%',
      accentForeground: '0 0% 100%',
      ring: '272 90% 65%',
      background: '265 40% 6%',
      foreground: '270 30% 96%',
      card: '265 32% 9.5%',
      cardForeground: '270 30% 96%',
      popover: '265 34% 11%',
      popoverForeground: '270 30% 96%',
      border: '265 25% 18%',
      input: '265 25% 18%',
      muted: '265 28% 13%',
      mutedForeground: '265 18% 70%',
      secondary: '265 26% 15%',
      secondaryForeground: '270 30% 92%',
      sidebarBackground: '265 45% 5%',
      sidebarForeground: '270 30% 95%',
      sidebarBorder: '265 25% 15%',
      chart1: '272 90% 65%',
      chart2: '320 85% 60%',
      chart3: '220 90% 65%',
      chart4: '45 95% 55%',
      chart5: '160 85% 45%',
    },
  },
  {
    id: 'emerald_teal',
    name: 'Emerald Teal Tech',
    subtitle: 'Verde Esmeralda & Menta Futurista',
    description: 'Variação equilibrada com tecnologia bio-verde, teal e acentos menta brilhante.',
    primaryHex: '#10b981',
    accentHex: '#06b6d4',
    previewBg: 'linear-gradient(135deg, #061513 0%, #0d2823 50%, #0f303a 100%)',
    chips: ['#10b981', '#34d399', '#06b6d4'],
    hslVariables: {
      primary: '160 84% 45%',
      primaryForeground: '165 60% 5%',
      accent: '190 95% 48%',
      accentForeground: '0 0% 100%',
      ring: '160 84% 45%',
      background: '168 40% 5.5%',
      foreground: '160 30% 95%',
      card: '168 32% 9%',
      cardForeground: '160 30% 95%',
      popover: '168 34% 11%',
      popoverForeground: '160 30% 95%',
      border: '168 25% 17%',
      input: '168 25% 17%',
      muted: '168 26% 12.5%',
      mutedForeground: '165 18% 68%',
      secondary: '168 25% 14%',
      secondaryForeground: '160 30% 92%',
      sidebarBackground: '168 45% 4.5%',
      sidebarForeground: '160 30% 94%',
      sidebarBorder: '168 25% 14%',
      chart1: '160 84% 45%',
      chart2: '190 95% 48%',
      chart3: '215 90% 60%',
      chart4: '38 96% 54%',
      chart5: '280 80% 65%',
    },
  },
  {
    id: 'ice_blue',
    name: 'Ice Blue Light',
    subtitle: 'Azul Glacial & Ciano Cristal',
    description:
      'Variação gelada e luminosa com acentos azul-royal e ciano cristal para alta clareza visual.',
    primaryHex: '#0284c7',
    accentHex: '#0ea5e9',
    previewBg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
    chips: ['#0284c7', '#0ea5e9', '#38bdf8'],
    hslVariables: {
      primary: '199 89% 48%',
      primaryForeground: '0 0% 100%',
      accent: '217 91% 60%',
      accentForeground: '0 0% 100%',
      ring: '199 89% 48%',
      background: '204 45% 98%',
      foreground: '215 28% 17%',
      card: '0 0% 100%',
      cardForeground: '215 28% 17%',
      popover: '0 0% 100%',
      popoverForeground: '215 28% 17%',
      border: '205 30% 88%',
      input: '205 30% 88%',
      muted: '204 35% 94%',
      mutedForeground: '215 16% 40%',
      secondary: '204 40% 95%',
      secondaryForeground: '215 28% 17%',
      sidebarBackground: '204 35% 94%',
      sidebarForeground: '215 28% 17%',
      sidebarBorder: '205 30% 86%',
      chart1: '199 89% 48%',
      chart2: '217 91% 60%',
      chart3: '172 75% 46%',
      chart4: '262 83% 68%',
      chart5: '38 92% 50%',
    },
  },
  {
    id: 'solar_amber',
    name: 'Solar Amber',
    subtitle: 'Âmbar Dourado & Laranja Quente',
    description:
      'Acentos âmbar, dourado e laranja energéticos sobre o fundo grafite escuro com alto contraste.',
    primaryHex: '#f59e0b',
    accentHex: '#f97316',
    previewBg: 'linear-gradient(135deg, #1c1407 0%, #291b07 50%, #362208 100%)',
    chips: ['#f59e0b', '#fbbf24', '#f97316'],
    hslVariables: {
      primary: '38 92% 50%',
      primaryForeground: '30 50% 6%',
      accent: '24 95% 53%',
      accentForeground: '0 0% 100%',
      ring: '38 92% 50%',
      background: '30 35% 6%',
      foreground: '38 30% 95%',
      card: '30 28% 9.5%',
      cardForeground: '38 30% 95%',
      popover: '30 30% 11%',
      popoverForeground: '38 30% 95%',
      border: '30 22% 18%',
      input: '30 22% 18%',
      muted: '30 25% 13%',
      mutedForeground: '35 18% 68%',
      secondary: '30 24% 15%',
      secondaryForeground: '38 30% 92%',
      sidebarBackground: '30 40% 5%',
      sidebarForeground: '38 30% 94%',
      sidebarBorder: '30 22% 15%',
      chart1: '38 92% 50%',
      chart2: '24 95% 53%',
      chart3: '45 93% 58%',
      chart4: '142 71% 45%',
      chart5: '280 80% 65%',
    },
  },
  {
    id: 'candy',
    name: 'Candy Neon (Doce Vibrante)',
    subtitle: 'Rosa Chiclete & Lilás Neon',
    description:
      'Acentos em rosa chiclete vibrante e lilás suave sobre fundo escuro grafite, com contraste otimizado.',
    primaryHex: '#ec4899',
    accentHex: '#c084fc',
    previewBg: 'linear-gradient(135deg, #18111e 0%, #29122e 100%)',
    chips: ['#ec4899', '#f472b6', '#c084fc', '#e879f9', '#fbcfe8'],
    hslVariables: {
      primary: '330 81% 60%',
      primaryForeground: '330 50% 6%',
      accent: '270 95% 75%',
      accentForeground: '0 0% 100%',
      ring: '330 81% 60%',
      background: '320 35% 6.5%',
      foreground: '330 30% 96%',
      card: '320 28% 10%',
      cardForeground: '330 30% 96%',
      popover: '320 30% 11.5%',
      popoverForeground: '330 30% 96%',
      border: '320 22% 19%',
      input: '320 22% 19%',
      muted: '320 25% 13.5%',
      mutedForeground: '325 18% 70%',
      secondary: '320 24% 15.5%',
      secondaryForeground: '330 30% 93%',
      sidebarBackground: '320 40% 5.5%',
      sidebarForeground: '330 30% 95%',
      sidebarBorder: '320 22% 15.5%',
      chart1: '330 81% 60%',
      chart2: '270 95% 75%',
      chart3: '315 90% 70%',
      chart4: '290 85% 65%',
      chart5: '340 82% 52%',
    },
  },
]

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
      return {
        ...DEFAULT_DESIGN_SETTINGS,
        ...parsed,
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

      const merged: DesignSettings = {
        id: first.id,
        sidebar_bg_color: first.sidebar_bg_color || DEFAULT_DESIGN_SETTINGS.sidebar_bg_color,
        sidebar_text_color: first.sidebar_text_color || DEFAULT_DESIGN_SETTINGS.sidebar_text_color,
        system_theme_variant:
          first.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
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
export async function useSystemLogoForReports(): Promise<DesignSettings> {
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
  const variant =
    THEME_VARIANTS.find((v) => v.id === settings.system_theme_variant) || THEME_VARIANTS[0]

  // Se o tema for ice_blue (modo claro característico), remove a classe .dark se o usuário estiver usando ice_blue
  // mas se o usuário estiver no modo dark padrão ou outro variant, segue a regra:
  const isIceBlue = variant.id === 'ice_blue'
  if (isIceBlue) {
    root.classList.remove('dark')
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
