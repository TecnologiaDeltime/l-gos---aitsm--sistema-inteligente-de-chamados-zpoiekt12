import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import {
  DesignSettings,
  DEFAULT_DESIGN_SETTINGS,
  getCachedDesignSettings,
  getDesignSettings,
  saveDesignSettings,
  applyDesignToDOM,
} from '@/services/design-settings'

export type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  designSettings: DesignSettings
  updateDesignSettings: (newSettings: Partial<DesignSettings>) => Promise<DesignSettings>
  applyDesignPreview: (previewSettings: Partial<DesignSettings>, previewTheme?: Theme) => void
  resetDesignPreview: () => void
  refreshDesignSettings: () => Promise<void>
  isDesignLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [designSettings, setDesignSettings] = useState<DesignSettings>(getCachedDesignSettings)
  const [isDesignLoading, setIsDesignLoading] = useState<boolean>(true)

  const theme: Theme = designSettings.system_theme_variant === 'amber_light' ? 'light' : 'dark'

  // Aplicar tema e variáveis sempre que as configurações mudarem
  useEffect(() => {
    localStorage.setItem('itsm-theme', theme)
    applyDesignToDOM(designSettings)
  }, [designSettings, theme])

  // Buscar configurações persistidas no PocketBase ao inicializar
  useEffect(() => {
    let mounted = true
    getDesignSettings()
      .then((settings) => {
        if (mounted) {
          setDesignSettings(settings)
          applyDesignToDOM(settings)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsDesignLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Alterna entre Modo Escuro (Amber Alert) e Modo Claro (Marrom & Branco)
  const toggleTheme = useCallback(() => {
    const nextVariant =
      designSettings.system_theme_variant === 'amber_light' ? 'amber_alert' : 'amber_light'
    const isLight = nextVariant === 'amber_light'
    const nextSettings: DesignSettings = {
      ...designSettings,
      system_theme_variant: nextVariant,
      sidebar_bg_color: isLight ? '#3D2314' : '#17181C',
      sidebar_text_color: isLight ? '#FFFFFF' : '#FCD34D',
    }
    setDesignSettings(nextSettings)
    applyDesignToDOM(nextSettings)
    saveDesignSettings({
      system_theme_variant: nextVariant,
      sidebar_bg_color: nextSettings.sidebar_bg_color,
      sidebar_text_color: nextSettings.sidebar_text_color,
    }).catch((err) => {
      console.warn('Falha ao salvar alternância de tema no backend:', err)
    })
  }, [designSettings])

  const setTheme = useCallback(
    (newTheme: Theme) => {
      const targetVariant = newTheme === 'light' ? 'amber_light' : 'amber_alert'
      if (designSettings.system_theme_variant === targetVariant) return
      const isLight = targetVariant === 'amber_light'
      const nextSettings: DesignSettings = {
        ...designSettings,
        system_theme_variant: targetVariant,
        sidebar_bg_color: isLight ? '#3D2314' : '#17181C',
        sidebar_text_color: isLight ? '#FFFFFF' : '#FCD34D',
      }
      setDesignSettings(nextSettings)
      applyDesignToDOM(nextSettings)
      saveDesignSettings({
        system_theme_variant: targetVariant,
        sidebar_bg_color: nextSettings.sidebar_bg_color,
        sidebar_text_color: nextSettings.sidebar_text_color,
      }).catch((err) => {
        console.warn('Falha ao salvar tema no backend:', err)
      })
    },
    [designSettings],
  )

  // Atualizar e persistir configurações no banco de dados (ex: logotipos)
  const updateDesignSettings = useCallback(
    async (newSettings: Partial<DesignSettings>): Promise<DesignSettings> => {
      const merged = { ...designSettings, ...newSettings }
      setDesignSettings(merged)
      applyDesignToDOM(merged)
      try {
        const saved = await saveDesignSettings(newSettings)
        setDesignSettings(saved)
        applyDesignToDOM(saved)
        return saved
      } catch (err) {
        console.error('Falha ao persistir configurações de design:', err)
        throw err
      }
    },
    [designSettings],
  )

  // Aplicar preview em tempo real (ex: logos ou temas)
  const applyDesignPreview = useCallback(
    (preview: Partial<DesignSettings>, previewTheme?: Theme) => {
      const merged = { ...designSettings, ...preview }
      applyDesignToDOM(merged, previewTheme ? previewTheme === 'dark' : undefined)
    },
    [designSettings],
  )

  // Cancelar preview e restaurar configurações ativas
  const resetDesignPreview = useCallback(() => {
    applyDesignToDOM(designSettings)
  }, [designSettings])

  const refreshDesignSettings = useCallback(async () => {
    try {
      const fresh = await getDesignSettings()
      setDesignSettings(fresh)
      applyDesignToDOM(fresh)
    } catch (err) {
      console.warn('Falha ao recarregar configurações de design:', err)
    }
  }, [])

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
        refreshDesignSettings,
        isDesignLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
