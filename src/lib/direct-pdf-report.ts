/**
 * Download direto do RELATÓRIO DE FUNCIONALIDADES IMPLANTADAS
 * (/reports/implemented-features) — sem diálogo de impressão.
 *
 * Captura os BLOCOS do .report-container com html2canvas-pro e monta um PDF
 * A4 RETRATO paginado com jsPDF. Cada card de categoria é capturado INTEIRO
 * (nunca cortado no meio); card mais alto que a página útil é fatiado apenas
 * nas fronteiras das linhas de funcionalidade (.divide-y > div), repetindo o
 * cabeçalho do card no topo de cada página de continuação.
 *
 * O tema de PAPEL claro é aplicado com a classe .report-capture (ver
 * direct-pdf-capture.css — html2canvas não avalia @media print, então a folha
 * implemented-features-print.css é replicada sem o media query) e removida ao
 * final: a tela NÃO muda.
 */

import { ensurePdfLibs, waitForRender, releaseCanvas, type Progress } from './direct-pdf-shared'
import { REPORT_CAPTURE_CSS } from './direct-pdf-capture'

// A4 retrato: 210×297 mm.
const PAGE_W_MM = 210
const PAGE_H_MM = 297
const MARGIN_MM = 12
const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2
const FOOTER_MM = 6
const USABLE_H_MM = PAGE_H_MM - MARGIN_MM * 2 - FOOTER_MM
const BLOCK_GAP_MM = 3

interface Piece {
  url: string
  hMm: number
  yMm: number
}

export async function exportImplementedFeaturesPdf(
  container: HTMLElement | null,
  onProgress?: Progress,
): Promise<string> {
  if (!container) {
    throw new Error('Relatório não está renderizado. Tente novamente.')
  }

  onProgress?.('load')
  const { html2canvas, jsPDF } = await ensurePdfLibs()

  // Tema de papel claro apenas durante a captura (classe temporária).
  const style = document.createElement('style')
  style.textContent = REPORT_CAPTURE_CSS
  document.head.appendChild(style)
  container.classList.add('report-capture')

  try {
    await waitForRender(container)
    onProgress?.('capture')

    const capture = async (el: HTMLElement): Promise<string | null> => {
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: Math.max(window.innerWidth, 1280),
          windowHeight: el.scrollHeight + 64,
        })
        if (!canvas || !canvas.width || !canvas.height) return null
        const url = canvas.toDataURL('image/jpeg', 0.92)
        releaseCanvas(canvas)
        return url
      } catch {
        return null
      }
    }

    // Unidades de paginação: filhos diretos visíveis do container (cabeçalho,
    // cards de resumo, barra de filtros, cards de categoria, rodapé).
    const blocks = (Array.from(container.children) as HTMLElement[]).filter(
      (el) => el.offsetParent !== null,
    )

    const pages: Piece[][] = []
    let current: Piece[] = []
    let cursorMm = 0
    const pushPage = () => {
      if (current.length > 0) pages.push(current)
      current = []
      cursorMm = 0
    }
    const pushPiece = (url: string, hMm: number, atTop = false) => {
      if (atTop) {
        pushPage()
        current.push({ url, hMm, yMm: MARGIN_MM })
        cursorMm = hMm
        return
      }
      if (hMm > USABLE_H_MM - cursorMm) {
        pushPage()
        current.push({ url, hMm, yMm: MARGIN_MM })
        cursorMm = hMm
        return
      }
      current.push({ url, hMm, yMm: MARGIN_MM + cursorMm })
      cursorMm += hMm
    }

    const widthRef = blocks[0]?.getBoundingClientRect().width || CONTENT_W_MM * 4
    const pxPerMm = widthRef / CONTENT_W_MM

    for (const block of blocks) {
      const url = await capture(block)
      if (!url) continue
      const rect = block.getBoundingClientRect()
      const hMmTotal = rect.height / pxPerMm

      if (hMmTotal <= USABLE_H_MM) {
        pushPiece(url, hMmTotal)
        cursorMm += BLOCK_GAP_MM
        if (cursorMm >= USABLE_H_MM - 4) pushPage()
        continue
      }

      // Card de categoria mais alto que a página útil: fatia nas LINHAS de
      // funcionalidade (.divide-y > div), repetindo o header do card.
      const card = block.querySelector<HTMLElement>('[data-slot="card"]') || block
      const header = card.querySelector<HTMLElement>('[data-slot="card-header"]')
      const rows = card.querySelectorAll<HTMLElement>('.divide-y > div')

      const headerUrl = header ? await capture(header) : null
      const headerHmm = header ? header.getBoundingClientRect().height / pxPerMm : 0

      if (headerUrl && headerHmm > 0) {
        pushPiece(headerUrl, headerHmm)
      }

      for (const row of rows) {
        const rowUrl = await capture(row)
        if (!rowUrl) continue
        const rowHmm = row.getBoundingClientRect().height / pxPerMm
        if (rowHmm > USABLE_H_MM - cursorMm) {
          // Página de continuação: repete o cabeçalho do card no topo.
          pushPage()
          if (headerUrl && headerHmm > 0 && headerHmm < USABLE_H_MM) {
            current.push({ url: headerUrl, hMm: headerHmm, yMm: MARGIN_MM })
            cursorMm = headerHmm + BLOCK_GAP_MM
          }
        }
        current.push({ url: rowUrl, hMm: rowHmm, yMm: MARGIN_MM + cursorMm })
        cursorMm += rowHmm
      }
      pushPage()
    }
    pushPage()

    if (pages.length === 0) {
      throw new Error('Falha ao capturar o conteúdo do relatório.')
    }

    onProgress?.('compose')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({
      title: 'Relatório de Funcionalidades Implantadas — LÓGOS AITSM',
      creator: 'LÓGOS AITSM',
    })
    const totalPages = pages.length
    pages.forEach((pieces, pageIndex) => {
      if (pageIndex > 0) pdf.addPage('a4', 'portrait')
      for (const piece of pieces) {
        pdf.addImage(
          piece.url,
          'JPEG',
          MARGIN_MM,
          piece.yMm,
          CONTENT_W_MM,
          piece.hMm,
          undefined,
          'FAST',
        )
      }
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(120)
      pdf.text('Lógos AITSM — Funcionalidades Implantadas', MARGIN_MM, PAGE_H_MM - MARGIN_MM + 4)
      pdf.text(
        `Página ${pageIndex + 1} de ${totalPages}`,
        PAGE_W_MM - MARGIN_MM,
        PAGE_H_MM - MARGIN_MM + 4,
        { align: 'right' },
      )
    })

    onProgress?.('download')
    const fileName = `relatorio-funcionalidades-implantadas-logos-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
    return fileName
  } finally {
    container.classList.remove('report-capture')
    document.head.removeChild(style)
  }
}
