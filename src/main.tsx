/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { getCachedDesignSettings, applyDesignToDOM } from './services/design-settings'

// Aplicação imediata no boot a partir do cache local para evitar flicker
try {
  const cached = getCachedDesignSettings()
  applyDesignToDOM(cached)
} catch {
  // Ignora falhas no boot
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
