/**
 * Extração de BLOCOS do DOM textual (buildMonthlyClientTextDom) para o motor
 * de layout do PDF rico. Cada bloco é uma unidade de paginação.
 */

import type { CoverLine } from '@/lib/monthly-client-pdf-brand'

export type Block =
  | { type: 'cover'; lines: CoverLine[] }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'para'; text: string }
  | { type: 'note'; text: string }
  | {
      type: 'table'
      caption: string
      headers: string[]
      rows: string[][]
      source: string
    }

function hasClass(el: Element, cls: string): boolean {
  return el.classList.contains(cls)
}

function directText(wrap: Element, selector: string): string {
  const node = wrap.querySelector(selector)
  return node ? (node.textContent || '').trim() : ''
}

function parseAvoidBreak(wrap: Element): Block | null {
  const caption = directText(wrap, ':scope > p.abnt-caption-top')
  const table = wrap.querySelector(':scope > table.abnt-table')
  const source = directText(wrap, ':scope > p.abnt-source-bottom')
  const h4 = wrap.querySelector(':scope > h4')
  if (h4) return { type: 'h3', text: (h4.textContent || '').trim() }
  if (table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
      (th.textContent || '').trim(),
    )
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
    )
    return { type: 'table', caption, headers, rows, source }
  }
  if (caption) return { type: 'note', text: caption }
  return null
}

/**
 * Percorre o DOM textual e devolve a sequência de blocos. Título de seção
 * (h3.abnt-section-title) e parágrafos (p.abnt-paragraph) são reconhecidos
 * apenas como filhos DIRETOS de section.abnt-section.
 */
export function extractBlocks(container: HTMLElement): Block[] {
  const out: Block[] = []
  const walk = (parent: Element) => {
    Array.from(parent.children).forEach((child) => {
      if (child.tagName === 'STYLE') return
      if (hasClass(child, 'abnt-cover')) {
        const lines: CoverLine[] = []
        Array.from(child.querySelectorAll('p')).forEach((p) => {
          const text = (p.textContent || '').trim()
          if (!text) return
          const kind = hasClass(p, 'abnt-cover-header')
            ? 'header'
            : hasClass(p, 'abnt-cover-title')
              ? 'title'
              : hasClass(p, 'abnt-cover-subtitle')
                ? 'subtitle'
                : hasClass(p, 'abnt-cover-footer')
                  ? 'footer'
                  : 'sub'
          lines.push({ text, kind })
        })
        out.push({ type: 'cover', lines })
        return
      }
      if (hasClass(child, 'abnt-section')) {
        Array.from(child.children).forEach((secChild) => {
          if (hasClass(secChild, 'abnt-section-title') && secChild.tagName === 'H3') {
            out.push({ type: 'h2', text: (secChild.textContent || '').trim() })
            return
          }
          if (hasClass(secChild, 'abnt-paragraph')) {
            const text = (secChild.textContent || '').trim()
            if (text) out.push({ type: 'para', text })
            return
          }
          if (hasClass(secChild, 'abnt-avoid-break')) {
            const block = parseAvoidBreak(secChild)
            if (block) out.push(block)
            return
          }
          walk(secChild)
        })
        return
      }
      if (hasClass(child, 'abnt-avoid-break')) {
        const block = parseAvoidBreak(child)
        if (block) out.push(block)
        return
      }
      if (hasClass(child, 'abnt-paragraph')) {
        const text = (child.textContent || '').trim()
        if (text) out.push({ type: 'para', text })
        return
      }
      walk(child)
    })
  }
  walk(container)
  return out
}
