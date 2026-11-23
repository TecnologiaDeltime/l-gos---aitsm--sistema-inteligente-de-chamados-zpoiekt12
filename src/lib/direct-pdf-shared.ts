/**
 * Infra compartilhada para download DIRETO de PDF (sem diálogo de impressão).
 *
 * Escopo RESTRICTO (regra permanente do projeto): apenas as exportações da
 * Apresentação Executiva (/apresentacao → direct-pdf-presentation.ts) e do
 * relatório Funcionalidades do Sistema (/reports/implemented-features →
 * direct-pdf-report.ts). Nenhuma outra tela/exportação usa este módulo.
 *
 * Bibliotecas carregadas sob demanda de CDN — mesmo padrão de
 * export-monthly-client-pdf.ts (v0.0.491), pois o package.json é protegido
 * contra edição (.skip.config.json preventAI). Escolha da dupla:
 *  - html2canvas-pro: rasteriza oklch (Tailwind v4), SVG (lucide/Recharts) e
 *    preserva cores exatas do DOM — requisito dos temas oficiais;
 *  - jsPDF (2.5.2, UMD): monta A4 paisagem/retrato paginado e salva via
 *    download direto (pdf.save) — sem window.print.
 */

const CDN_HTML2CANVAS =
  'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js'
const CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'

export type Progress = (stage: 'load' | 'capture' | 'compose' | 'download') => void

declare global {
  interface Window {
    html2canvas?: any
    jspdf?: { jsPDF: any }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar ' + src)), {
        once: true,
      })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.src = src
    s.addEventListener('load', () => {
      s.dataset.loaded = '1'
      resolve()
    })
    s.addEventListener('error', () => reject(new Error('Falha ao carregar ' + src)))
    document.head.appendChild(s)
  })
}

export async function ensurePdfLibs(): Promise<{ html2canvas: any; jsPDF: any }> {
  if (!window.html2canvas) await loadScript(CDN_HTML2CANVAS)
  if (!window.jspdf?.jsPDF) await loadScript(CDN_JSPDF)
  const html2canvas = window.html2canvas
  const jsPDF = window.jspdf?.jsPDF
  if (!html2canvas || !jsPDF) {
    throw new Error(
      'Não foi possível carregar as bibliotecas de geração de PDF (CDN indisponível). Verifique sua conexão e tente novamente.',
    )
  }
  return { html2canvas, jsPDF }
}

/** Espera fonts/imagens terminarem de carregar antes da captura. */
export async function waitForRender(el: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* noop */
    }
  }
  const images = Array.from(el.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
  // Duas frames para garantir layout estável.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

/** Libera a memória de um canvas após gerar o data URL. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}
