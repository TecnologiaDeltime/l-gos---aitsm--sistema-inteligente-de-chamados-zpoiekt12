/**
 * Exportação REAL de PDF (download direto) do Relatório Mensal do Cliente.
 *
 * Estratégia (v0.0.491): capturar a própria árvore ABNT já renderizada em tela
 * (.abnt-report-root) com html2canvas-pro — que rasteriza SVG (Recharts),
 * imagens e cores modernas (oklch do Tailwind v4) — seção por seção, e montar
 * um PDF A4 paginado com jsPDF. Seções mais altas que uma página são fatiadas
 * verticalmente em recortes exatos (canvas intermediário por recorte) — nunca
 * reduzidas nem deixadas em folhas em branco.
 *
 * Sem window.print, sem diálogo de impressão. O tema é temporariamente forçado
 * para CLARO durante a captura (o tema escuro padrão produziria um PDF
 * grafite ilegível para documento ABNT) e restaurado ao final. Bibliotecas
 * carregadas sob demanda de CDN (package.json é protegido contra edição;
 * jsPDF/html2canvas não estão no bundle do projeto).
 */

const CDN_HTML2CANVAS =
  'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js'
const CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'

type Progress = (stage: 'load' | 'capture' | 'compose' | 'download') => void

export interface ExportMonthlyClientPdfOptions {
  rootElement: HTMLElement | null
  monthKey: string
  reportData: {
    periodLabel?: string
    company?: { trade_name?: string; legal_name?: string }
  } | null
  onProgress?: Progress
}

// Paleta oficial (âmbar/grafite, zero azul)
const AMBER = '#D97706'
const GRAPHITE = '#17181C'

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

async function ensureLibs(): Promise<{ html2canvas: any; jsPDF: any }> {
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
async function waitForRender(el: HTMLElement): Promise<void> {
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
  // Duas frames para garantir layout estável (gráficos Recharts animados).
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

interface SectionCanvas {
  canvas: HTMLCanvasElement
  widthPx: number
  heightPx: number
}

function sliceToDataUrl(src: HTMLCanvasElement, sy: number, sh: number): string | null {
  if (sh < 1 || src.height < 1) return null
  const slice = document.createElement('canvas')
  slice.width = src.width
  slice.height = sh
  const ctx = slice.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, slice.width, slice.height)
  ctx.drawImage(src, 0, sy, src.width, sh, 0, 0, src.width, sh)
  const url = slice.toDataURL('image/jpeg', 0.92)
  slice.width = 0
  slice.height = 0
  return url
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    à: 'a',
    á: 'a',
    â: 'a',
    ã: 'a',
    ä: 'a',
    è: 'e',
    é: 'e',
    ê: 'e',
    ë: 'e',
    ì: 'i',
    í: 'i',
    î: 'i',
    ï: 'i',
    ò: 'o',
    ó: 'o',
    ô: 'o',
    õ: 'o',
    ö: 'o',
    ù: 'u',
    ú: 'u',
    û: 'u',
    ü: 'u',
    ç: 'c',
    ñ: 'n',
  }
  return text
    .toLowerCase()
    .replace(/[àáâãäèéêëìíîïòóôõöùúûüçñ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function exportMonthlyClientPdf(
  options: ExportMonthlyClientPdfOptions,
): Promise<string> {
  const { rootElement, monthKey, reportData, onProgress } = options
  if (!rootElement) {
    throw new Error('Relatório não está renderizado na tela. Gere o relatório antes de exportar.')
  }

  onProgress?.('load')
  const { html2canvas, jsPDF } = await ensureLibs()

  // Página A4: 210×297 mm.
  const pageWmm = 210
  const pageHmm = 297
  const marginMm = 14
  const contentWmm = pageWmm - marginMm * 2
  const contentHmm = pageHmm - marginMm * 2
  const headerHmm = 12
  const footerHmm = 8
  const usableHmm = contentHmm - headerHmm - footerHmm
  const sectionGapMm = 6
  const scale = 2

  onProgress?.('capture')
  await waitForRender(rootElement)

  // Força tema claro durante a captura (documento ABNT legível) e restaura ao
  // final — a troca é só de classe CSS no <html>, sem re-render do React.
  const html = document.documentElement
  const hadDark = html.classList.contains('dark')
  if (hadDark) html.classList.remove('dark')
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // Captura seção por seção (filhos diretos visíveis da raiz ABNT): evita o
    // canvas gigante único, que estoura o limite de altura do Chromium em
    // relatórios longos e saía em branco.
    const sections = Array.from(rootElement.children).filter(
      (child) => (child as HTMLElement).offsetParent !== null,
    ) as HTMLElement[]
    if (sections.length === 0) sections.push(rootElement)

    const sectionCanvases: SectionCanvas[] = []
    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: Math.max(section.scrollWidth, rootElement.scrollWidth),
        windowHeight: section.scrollHeight,
      })
      if (!canvas || !canvas.width || !canvas.height) continue
      sectionCanvases.push({ canvas, widthPx: canvas.width, heightPx: canvas.height })
    }
    if (sectionCanvases.length === 0) {
      throw new Error('Falha ao capturar o conteúdo do relatório (nenhuma seção capturada).')
    }

    onProgress?.('compose')
    // Plano de páginas: cada página é uma lista de recortes
    // { canvasFonte, sy, sh (px), yMm (posição na página) }. Seções mais altas
    // que uma página são fatiadas verticalmente — sem folhas em branco.
    interface Slice {
      src: HTMLCanvasElement
      syPx: number
      shPx: number
      yMm: number
    }
    const pages: Slice[][] = []
    let current: Slice[] = []
    let cursorMm = 0

    const pushPage = () => {
      if (current.length > 0) pages.push(current)
      current = []
      cursorMm = 0
    }

    for (const sec of sectionCanvases) {
      const mmPerPx = contentWmm / sec.widthPx
      let remainingHmm = sec.heightPx * mmPerPx
      let syPx = 0

      while (remainingHmm > 0.5) {
        const spaceMm = usableHmm - cursorMm
        if (spaceMm <= 0.5) {
          pushPage()
          continue
        }
        const drawHmm = Math.min(remainingHmm, spaceMm)
        const drawPx = Math.floor(drawHmm / mmPerPx)
        if (drawPx < 1) break
        current.push({ src: sec.canvas, syPx, shPx: drawPx, yMm: marginMm + headerHmm + cursorMm })
        syPx += drawPx
        remainingHmm -= drawPx * mmPerPx
        cursorMm += drawPx * mmPerPx
        if (remainingHmm > 0.5) {
          // A seção continua na próxima página.
          pushPage()
        }
      }
      // Respiro entre seções.
      cursorMm += sectionGapMm
      if (cursorMm >= usableHmm - 0.5) pushPage()
    }
    pushPage()
    if (pages.length === 0) {
      throw new Error('Falha ao montar as páginas do PDF.')
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({
      title: `Relatório Mensal — ${reportData?.company?.trade_name || reportData?.company?.legal_name || 'Cliente'} (${reportData?.periodLabel || monthKey})`,
      subject: 'Relatório Mensal de Atendimento Técnico (ABNT)',
      creator: 'LÓGOS AITSM',
    })

    const companyLabel = reportData?.company?.trade_name || reportData?.company?.legal_name || ''
    const totalPages = pages.length

    pages.forEach((slices, pageIndex) => {
      if (pageIndex > 0) pdf.addPage()

      // Cabeçalho vetorial (independe da captura).
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(AMBER)
      pdf.text('RELATÓRIO MENSAL DE ATENDIMENTO', marginMm, marginMm + 3)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(GRAPHITE)
      pdf.setFontSize(7)
      if (companyLabel) pdf.text(companyLabel, marginMm, marginMm + 6.5)
      pdf.text(reportData?.periodLabel || monthKey, pageWmm - marginMm, marginMm + 3, {
        align: 'right',
      })
      pdf.setDrawColor(AMBER)
      pdf.setLineWidth(0.4)
      pdf.line(marginMm, marginMm + headerHmm - 2, pageWmm - marginMm, marginMm + headerHmm - 2)

      for (const slice of slices) {
        const dataUrl = sliceToDataUrl(slice.src, slice.syPx, slice.shPx)
        if (!dataUrl) continue
        pdf.addImage(
          dataUrl,
          'JPEG',
          marginMm,
          slice.yMm,
          contentWmm,
          slice.shPx * (contentWmm / slice.src.width),
          undefined,
          'FAST',
        )
      }

      // Rodapé vetorial.
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(120)
      pdf.text('Documento gerado por LÓGOS AITSM', marginMm, pageHmm - marginMm + 4)
      pdf.text(
        `Página ${pageIndex + 1} de ${totalPages}`,
        pageWmm - marginMm,
        pageHmm - marginMm + 4,
        { align: 'right' },
      )
    })

    // Libera os canvases de seção da memória.
    sectionCanvases.forEach((sec) => {
      sec.canvas.width = 0
      sec.canvas.height = 0
    })

    onProgress?.('download')
    const company = reportData?.company?.trade_name || reportData?.company?.legal_name || 'cliente'
    const fileName = `relatorio-mensal-${slugify(company)}-${monthKey}.pdf`
    pdf.save(fileName)
    return fileName
  } finally {
    if (hadDark) html.classList.add('dark')
  }
}
