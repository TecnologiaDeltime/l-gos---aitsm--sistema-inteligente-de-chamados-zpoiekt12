import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import {
  DesignSettings,
  DEFAULT_DESIGN_SETTINGS,
  getCachedDesignSettings,
  getDesignSettings,
  saveDesignSettings,
  applyDesignToDOM,
} from '@/services/design-settings'

type Theme = 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  designSettings: DesignSettings
  updateDesignSettings: (newSettings: Partial<DesignSettings>) => Promise<DesignSettings>
  applyDesignPreview: (previewSettings: Partial<DesignSettings>) => void
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
  const theme: Theme = 'dark'

  const [designSettings, setDesignSettings] = useState<DesignSettings>(getCachedDesignSettings)
  const [isDesignLoading, setIsDesignLoading] = useState<boolean>(true)

  // Aplicar tema escuro Amber Alert e variáveis imediatamente
  useEffect(() => {
    localStorage.setItem('itsm-theme', 'dark')
    applyDesignToDOM(designSettings)
  }, [designSettings])

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

  // O sistema utiliza exclusivamente o tema Amber Alert oficial escuro com menu branco.
  // toggleTheme mantido como no-op para compatibilidade de API de chamadas existentes.
  const toggleTheme = useCallback(() => {
    applyDesignToDOM(designSettings)
  }, [designSettings])

  const setTheme = useCallback(
    (_t: Theme) => {
      applyDesignToDOM(designSettings)
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

  // Aplicar preview em tempo real (ex: logos)
  const applyDesignPreview = useCallback(
    (preview: Partial<DesignSettings>) => {
      const merged = { ...designSettings, ...preview }
      applyDesignToDOM(merged)
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
