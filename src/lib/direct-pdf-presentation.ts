/**
 * Download direto do PDF da Apresentação Executiva (/apresentacao).
 *
 * Captura cada slide da versão de impressão (#apresentacao-print
 * .apresentacao-print-slide, caixa 16:9 de 1280×720 px) com html2canvas-pro e
 * monta um PDF A4 PAISAGEM com jsPDF: um slide por página, desenhado na área
 * útil com proporção preservada (contain, centrado) — sem cortes e sem diálogo
 * de impressão.
 *
 * O bloco #apresentacao-print fica display:none na tela (folha
 * ExecutivePresentationPrint.css) e html2canvas não renderiza elementos
 * ocultos: cada slide é CLONADO para um host off-screen (position:fixed fora
 * da viewport) com as dimensões nativas 1280×720 — sem o zoom 0.87 do papel,
 * que é @media print e não se aplica aqui — capturado e removido. O tema
 * Âmbar Alert da tela é preservado (as variáveis CSS vêm do <html>; o clone
 * herda tudo). Bibliotecas de CDN, mesmo padrão de export-monthly-client-pdf
 * (package.json é protegido).
 */

import { ensurePdfLibs, waitForRender, type Progress } from './direct-pdf-shared'

const SLIDE_W_PX = 1280
const SLIDE_H_PX = 720
// A4 paisagem: 297×210 mm.
const PAGE_W_MM = 297
const PAGE_H_MM = 210

export async function exportExecutivePresentationPdf(
  printRoot: HTMLElement | null,
  onProgress?: Progress,
): Promise<string> {
  if (!printRoot) {
    throw new Error('Apresentação não está renderizada. Tente novamente.')
  }

  onProgress?.('load')
  const { html2canvas, jsPDF } = await ensurePdfLibs()

  const slideElements = Array.from(
    printRoot.querySelectorAll<HTMLElement>('.apresentacao-print-slide'),
  )
  if (slideElements.length === 0) {
    throw new Error('Nenhum slide encontrado para exportar.')
  }

  onProgress?.('capture')
  await waitForRender(printRoot)

  // Host off-screen: invisível para o usuário, visível para o html2canvas.
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;width:1280px;height:720px;overflow:hidden;z-index:-1;pointer-events:none;'
  document.body.appendChild(host)

  const dataUrls: string[] = []
  try {
    for (const slide of slideElements) {
      const clone = slide.cloneNode(true) as HTMLElement
      clone.style.cssText =
        'position:static;width:1280px;height:720px;overflow:hidden;box-sizing:border-box;'
      host.replaceChildren(clone)
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#17181C',
        width: SLIDE_W_PX,
        height: SLIDE_H_PX,
        windowWidth: SLIDE_W_PX,
        windowHeight: SLIDE_H_PX,
      }).catch(() => null)
      if (!canvas || !canvas.width || !canvas.height) continue
      dataUrls.push(canvas.toDataURL('image/jpeg', 0.92))
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    host.remove()
  }
  if (dataUrls.length === 0) {
    throw new Error('Falha ao capturar os slides da apresentação.')
  }

  onProgress?.('compose')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({
    title: 'Apresentação Executiva — LÓGOS AITSM',
    creator: 'LÓGOS AITSM',
  })

  // Área útil com folga de 4 mm; slide 16:9 com proporção preservada
  // (contain), centrado — nunca esticado nem cortado.
  const marginMm = 4
  const usableW = PAGE_W_MM - marginMm * 2
  const usableH = PAGE_H_MM - marginMm * 2
  const drawW = Math.min(usableW, (usableH * SLIDE_W_PX) / SLIDE_H_PX)
  const drawH = (drawW * SLIDE_H_PX) / SLIDE_W_PX
  const xMm = (PAGE_W_MM - drawW) / 2
  const yMm = (PAGE_H_MM - drawH) / 2

  dataUrls.forEach((url, index) => {
    if (index > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(url, 'JPEG', xMm, yMm, drawW, drawH, undefined, 'FAST')
  })

  onProgress?.('download')
  const fileName = `apresentacao-executiva-logos-${new Date().toISOString().slice(0, 10)}.pdf`
  pdf.save(fileName)
  return fileName
}
