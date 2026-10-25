import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import {
  DesignSettings,
  DEFAULT_DESIGN_SETTINGS,
  getCachedDesignSettings,
  getDesignSettings,
  saveDesignSettings,
  applyDesignToDOM,
  SystemThemeVariant,
} from '@/services/design-settings'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  designSettings: DesignSettings
  updateDesignSettings: (newSettings: Partial<DesignSettings>) => Promise<DesignSettings>
  applyDesignPreview: (previewSettings: Partial<DesignSettings>) => void
  resetDesignPreview: () => void
  isDesignLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem('itsm-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
  })

  const [designSettings, setDesignSettings] = useState<DesignSettings>(getCachedDesignSettings)
  const [isDesignLoading, setIsDesignLoading] = useState<boolean>(true)

  // Aplicar tema claro/escuro e variáveis no DOM
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('itsm-theme', theme)
    applyDesignToDOM(designSettings, theme === 'dark')
  }, [theme, designSettings])

  // Buscar configurações persistidas no PocketBase ao inicializar
  useEffect(() => {
    let mounted = true
    getDesignSettings()
      .then((settings) => {
        if (mounted) {
          setDesignSettings(settings)
          applyDesignToDOM(settings, theme === 'dark')
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsDesignLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [theme])

  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  const setTheme = (t: Theme) => setThemeState(t)

  // Atualizar e persistir no banco de dados
  const updateDesignSettings = useCallback(
    async (newSettings: Partial<DesignSettings>): Promise<DesignSettings> => {
      const merged = { ...designSettings, ...newSettings }
      setDesignSettings(merged)
      applyDesignToDOM(merged, theme === 'dark')
      try {
        const saved = await saveDesignSettings(newSettings)
        setDesignSettings(saved)
        applyDesignToDOM(saved, theme === 'dark')
        return saved
      } catch (err) {
        console.error('Falha ao persistir configurações de design:', err)
        throw err
      }
    },
    [designSettings, theme],
  )

  // Aplicar preview em tempo real (sem salvar ainda no banco)
  const applyDesignPreview = useCallback(
    (preview: Partial<DesignSettings>) => {
      const merged = { ...designSettings, ...preview }
      applyDesignToDOM(merged, theme === 'dark')
    },
    [designSettings, theme],
  )

  // Cancelar preview e restaurar configurações ativas
  const resetDesignPreview = useCallback(() => {
    applyDesignToDOM(designSettings, theme === 'dark')
  }, [designSettings, theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        designSettings,
        updateDesignSettings,
        applyDesignPreview,
        resetDesignPreview,
        isDesignLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
