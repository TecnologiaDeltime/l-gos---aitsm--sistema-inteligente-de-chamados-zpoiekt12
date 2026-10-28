import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { applyDesignToDOM, getCachedDesignSettings } from './services/design-settings.ts'

// Aplica imediatamente as variáveis e classes do tema Amber Alert oficial escuro antes da montagem
try {
  applyDesignToDOM(getCachedDesignSettings())
} catch {
  /* intentionally ignored */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
