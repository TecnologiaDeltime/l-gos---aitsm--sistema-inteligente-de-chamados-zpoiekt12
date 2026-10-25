import pb from '@/lib/pocketbase/client'

export type SystemThemeVariant =
  | 'cyber_cyan'
  | 'neon_purple'
  | 'emerald_teal'
  | 'ice_blue'
  | 'solar_amber'

export interface DesignSettings {
  id?: string
  sidebar_bg_color: string
  sidebar_text_color: string
  system_theme_variant: SystemThemeVariant
  scope?: 'global'
  created?: string
  updated?: string
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  sidebar_bg_color: '#070b14',
  sidebar_text_color: '#22d3ee',
  system_theme_variant: 'cyber_cyan',
  scope: 'global',
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
    primaryHex: '#38bdf8',
    accentHex: '#0284c7',
    previewBg: 'linear-gradient(135deg, #0a1e36 0%, #0c3359 50%, #164e63 100%)',
    chips: ['#38bdf8', '#0284c7', '#22d3ee'],
    hslVariables: {
      primary: '199 89% 48%',
      primaryForeground: '204 80% 6%',
      accent: '217 91% 60%',
      accentForeground: '0 0% 100%',
      ring: '199 89% 48%',
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
      chart1: '38 92% 50%',
      chart2: '24 95% 53%',
      chart3: '45 93% 58%',
      chart4: '142 71% 45%',
      chart5: '280 80% 65%',
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
      const merged: DesignSettings = {
        id: first.id,
        sidebar_bg_color: first.sidebar_bg_color || DEFAULT_DESIGN_SETTINGS.sidebar_bg_color,
        sidebar_text_color: first.sidebar_text_color || DEFAULT_DESIGN_SETTINGS.sidebar_text_color,
        system_theme_variant:
          first.system_theme_variant || DEFAULT_DESIGN_SETTINGS.system_theme_variant,
        scope: 'global',
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
  const payload = {
    sidebar_bg_color: data.sidebar_bg_color ?? current.sidebar_bg_color,
    sidebar_text_color: data.sidebar_text_color ?? current.sidebar_text_color,
    system_theme_variant: data.system_theme_variant ?? current.system_theme_variant,
    scope: 'global',
  }

  let savedRecord: any
  if (current.id) {
    savedRecord = await pb.collection('design_settings').update(current.id, payload)
  } else {
    // Tenta encontrar caso tenha sido criado por outro
    try {
      const existing = await pb.collection('design_settings').getFirstListItem('scope = "global"')
      savedRecord = await pb.collection('design_settings').update(existing.id, payload)
    } catch (_) {
      savedRecord = await pb.collection('design_settings').create(payload)
    }
  }

  const result: DesignSettings = {
    id: savedRecord.id,
    sidebar_bg_color: savedRecord.sidebar_bg_color,
    sidebar_text_color: savedRecord.sidebar_text_color,
    system_theme_variant: savedRecord.system_theme_variant,
    scope: 'global',
    created: savedRecord.created,
    updated: savedRecord.updated,
  }
  setCachedDesignSettings(result)
  return result
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

  // 2. Variação do tema do sistema (Primária, Acento, Gráficos)
  const variant =
    THEME_VARIANTS.find((v) => v.id === settings.system_theme_variant) || THEME_VARIANTS[0]

  if (isDark) {
    root.style.setProperty('--primary', variant.hslVariables.primary)
    root.style.setProperty('--primary-foreground', variant.hslVariables.primaryForeground)
    root.style.setProperty('--accent', variant.hslVariables.accent)
    root.style.setProperty('--accent-foreground', variant.hslVariables.accentForeground)
    root.style.setProperty('--ring', variant.hslVariables.ring)
    root.style.setProperty('--chart-1', variant.hslVariables.chart1)
    root.style.setProperty('--chart-2', variant.hslVariables.chart2)
    root.style.setProperty('--chart-3', variant.hslVariables.chart3)
    root.style.setProperty('--chart-4', variant.hslVariables.chart4)
    root.style.setProperty('--chart-5', variant.hslVariables.chart5)
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
