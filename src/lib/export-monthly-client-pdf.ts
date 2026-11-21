/**
 * Exportação REAL de PDF (download direto) do Relatório Mensal do Cliente.
 *
 * Estratégia (v0.0.491): capturar a própria árvore ABNT já renderizada em tela
 * (.abnt-report-root) com html2canvas-pro — que rasteriza SVG (Recharts),
 * imagens e cores modernas (oklch do Tailwind v4) — capturando BLOCO a BLOCO
 * (cada .abnt-avoid-break: legenda + gráfico/tabela + fonte; cada parágrafo)
 * e montar um PDF A4 paginado com jsPDF.
 *
 * REGRA DE OURO da paginação (correção do "gráficos e escritas cortados"):
 * a quebra de página acontece apenas ENTRE blocos atômicos — um gráfico,
 * tabela ou parágrafo NUNCA é dividido no meio. Bloco que não cabe no
 * restante da página vai inteiro para a página seguinte; bloco mais alto que
 * a página útil é ESCALADO para caber (nunca achatado abaixo de 55% — nesse
 * caso, e só nesse caso, o bloco de fallback é fatiado).
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

/** Escala mínima aceita antes de partir para o fatiamento de emergência. */
const MIN_SCALE = 0.55

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
  /** true quando a captura veio da raiz/seção sem blocos ABNT reconhecidos. */
  isFallback?: boolean
}

/**
 * Coleta os BLOCOS ATÔMICOS de uma seção — a menor unidade de paginação.
 * Regras:
 *  - um `abnt-avoid-break` (legenda + gráfico + fonte; legenda + tabela + fonte)
 *    é UM bloco: nunca dividido no meio;
 *  - um parágrafo (abnt-paragraph ou <p> com texto) é um bloco;
 *  - um bloco declarado dentro de outro bloco conta só na instância mais
 *    externa;
 *  - containers "neutros" (space-y-4/space-y-6 usados como fragmento de vários
 *    blocos) são atravessados um nível;
 *  - qualquer outro filho direto visível da seção vira um bloco próprio.
 */
function collectAtomicBlocks(section: HTMLElement): HTMLElement[] {
  const visible = (el: HTMLElement) => el.offsetParent !== null
  if (!visible(section)) return []

  const out: HTMLElement[] = []
  const walk = (parent: HTMLElement, nested: boolean) => {
    Array.from(parent.children).forEach((child) => {
      const el = child as HTMLElement
      if (!visible(el)) return
      const isAvoid = el.classList.contains('abnt-avoid-break')
      const isParagraph = el.classList.contains('abnt-paragraph')
      const isTextBlock =
        !isAvoid && !isParagraph && el.tagName === 'P' && (el.textContent || '').trim().length > 0
      if (isAvoid || isParagraph || isTextBlock) {
        if (!nested) out.push(el)
        return
      }
      const isNeutralFragment =
        !isAvoid &&
        el.tagName !== 'TABLE' &&
        el.tagName !== 'P' &&
        (el.classList.contains('space-y-4') || el.classList.contains('space-y-6')) &&
        el.children.length > 1
      if (isNeutralFragment && !nested) {
        walk(el, true)
        return
      }
      if (!nested) out.push(el)
    })
  }
  walk(section, false)

  if (out.length <= 1) {
    // Seção pequena (ou sem marcadores ABNT): captura cai na própria seção
    // (fallback — pode ser fatiada se for maior que a página útil).
    return [section]
  }
  return out
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
  const blockGapMm = 6
  const captureScale = 2

  onProgress?.('capture')
  await waitForRender(rootElement)

  // Força tema claro durante a captura (documento ABNT legível) e restaura ao
  // final — a troca é só de classe CSS no <html>, sem re-render do React.
  const html = document.documentElement
  const hadDark = html.classList.contains('dark')
  if (hadDark) html.classList.remove('dark')
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // Captura BLOCO a BLOCO (não mais seções inteiras): cada .abnt-avoid-break
    // (legenda + gráfico + fonte; legenda + tabela + fonte) e cada parágrafo é
    // uma captura independente — assim a paginação pode quebrar só entre eles.
    const sections = Array.from(rootElement.children).filter(
      (child) => (child as HTMLElement).offsetParent !== null,
    ) as HTMLElement[]
    if (sections.length === 0) sections.push(rootElement)

    const blockCanvases: SectionCanvas[] = []
    for (const section of sections) {
      const blocks = collectAtomicBlocks(section)
      const isFallbackBlock = blocks.length === 1 && blocks[0] === section
      for (const block of blocks) {
        const target = isFallbackBlock ? block : block
        const canvas = await html2canvas(target, {
          scale: captureScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: Math.max(target.scrollWidth, rootElement.scrollWidth),
          windowHeight: target.scrollHeight,
        }).catch(() => null)
        if (!canvas || !canvas.width || !canvas.height) continue
        blockCanvases.push({
          canvas,
          widthPx: canvas.width,
          heightPx: canvas.height,
          isFallback: isFallbackBlock,
        })
      }
    }
    if (blockCanvases.length === 0) {
      throw new Error('Falha ao capturar o conteúdo do relatório (nenhum bloco capturado).')
    }

    onProgress?.('compose')
    // Plano de páginas: cada página é uma lista de recortes
    // { canvasFonte, sy, sh (px), yMm (posição na página), escala }.
    interface Slice {
      src: HTMLCanvasElement
      syPx: number
      shPx: number
      yMm: number
      scale: number
    }
    const pages: Slice[][] = []
    let current: Slice[] = []
    let cursorMm = 0

    const pushPage = () => {
      if (current.length > 0) pages.push(current)
      current = []
      cursorMm = 0
    }

    for (const sec of blockCanvases) {
      const blockHmm = (sec.heightPx * contentWmm) / sec.widthPx
      const spaceMm = usableHmm - cursorMm
      const isFallback = sec.isFallback === true

      // 1. O bloco cabe no restante da página atual → coloca ali. Com pouco
      // espaço restante, exige uma folga para não colar no rodapé.
      if (blockHmm <= spaceMm - (spaceMm > 25 ? 0 : 4)) {
        current.push({
          src: sec.canvas,
          syPx: 0,
          shPx: sec.heightPx,
          yMm: marginMm + headerHmm + cursorMm,
          scale: 1,
        })
        cursorMm += blockHmm
      } else if (blockHmm <= usableHmm) {
        // 2. Cabe numa página INTEIRA, mas não no restante → página nova.
        pushPage()
        current.push({
          src: sec.canvas,
          syPx: 0,
          shPx: sec.heightPx,
          yMm: marginMm + headerHmm,
          scale: 1,
        })
        cursorMm = blockHmm
      } else {
        // 3. Mais alto que a página útil → ESCALA para caber (nunca fatia um
        // bloco marcado como atômico; só o fallback de emergência é fatiado).
        const fitScale = usableHmm / blockHmm
        if (!isFallback || fitScale >= MIN_SCALE) {
          pushPage()
          current.push({
            src: sec.canvas,
            syPx: 0,
            shPx: sec.heightPx,
            yMm: marginMm + headerHmm + Math.max(0, (usableHmm - blockHmm * fitScale) / 2),
            scale: fitScale,
          })
          cursorMm = usableHmm
        } else {
          // Fallback de emergência (bloco excepcional, sem marcador ABNT, mais
          // alto que 2 páginas): fatia — mesmo comportamento da v0.0.490.
          const mmPerPx = contentWmm / sec.widthPx
          let syPx = 0
          let remainingHmm = blockHmm
          while (remainingHmm > 0.5) {
            const space = usableHmm - cursorMm
            if (space <= 0.5) {
              pushPage()
              continue
            }
            const drawHmm = Math.min(remainingHmm, space)
            const drawPx = Math.max(1, Math.floor(drawHmm / mmPerPx))
            current.push({
              src: sec.canvas,
              syPx,
              shPx: drawPx,
              yMm: marginMm + headerHmm + cursorMm,
              scale: 1,
            })
            syPx += drawPx
            remainingHmm -= drawPx * mmPerPx
            cursorMm += drawPx * mmPerPx
            if (remainingHmm > 0.5) pushPage()
          }
        }
      }

      // Respiro ENTRE blocos (nunca depois do último da página).
      cursorMm += blockGapMm
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
        // Largura/altura já com a escala do bloco aplicada (escala < 1 só
        // acontece quando o bloco é mais alto que a página útil): a imagem
        // mantém a proporção (sem achatamento) e fica CENTRALIZADA.
        const drawHmm = slice.shPx * (contentWmm / slice.src.width) * slice.scale
        const drawWmm = contentWmm * slice.scale
        const xMm = marginMm + (contentWmm - drawWmm) / 2
        pdf.addImage(dataUrl, 'JPEG', xMm, slice.yMm, drawWmm, drawHmm, undefined, 'FAST')
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

    // Libera os canvases de bloco da memória.
    blockCanvases.forEach((sec) => {
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
