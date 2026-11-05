import type { TicketAttachmentRecord } from '@/services/attachments'
import pb from '@/lib/pocketbase/client'

/**
 * Tags permitidas para formatação de e-mail limpa e segura.
 * Rejeita explicitamente tags perigosas como <script>, <iframe>, <object>, <embed>, <form>, <input>, etc.
 */
const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

/**
 * Atributos globais permitidos
 */
const ALLOWED_ATTRS = new Set([
  'align',
  'alt',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
  'color',
  'colspan',
  'dir',
  'height',
  'href',
  'id',
  'rowspan',
  'src',
  'style',
  'target',
  'title',
  'valign',
  'width',
])

/**
 * Validação de URLs seguras (http, https, mailto, tel, data:image/..., cid: temporário)
 */
function isSafeUrl(url: string): boolean {
  const clean = url.trim().toLowerCase()
  if (clean.startsWith('http://') || clean.startsWith('https://')) return true
  if (clean.startsWith('mailto:') || clean.startsWith('tel:')) return true
  if (clean.startsWith('data:image/')) return true
  if (clean.startsWith('cid:')) return true
  if (clean.startsWith('/') || clean.startsWith('#')) return true
  return false
}

/**
 * Sanitiza propriedades CSS inline (remove behaviors, expression, javascript:, url(javascript:))
 * e neutraliza animações/transições vindas do e-mail (assinaturas piscando, blink, marquee).
 */
const ANIMATION_STYLE_PROPERTIES = [
  'animation',
  'animation-name',
  'animation-duration',
  'animation-iteration-count',
  'animation-delay',
  'animation-timing-function',
  'animation-direction',
  'animation-play-state',
  'animation-fill-mode',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
]

function sanitizeStyle(styleStr: string): string {
  if (!styleStr) return ''
  const lower = styleStr.toLowerCase()
  if (
    lower.includes('javascript:') ||
    lower.includes('expression(') ||
    lower.includes('-moz-binding') ||
    lower.includes('behavior:')
  ) {
    return ''
  }
  // Remove declarações de animation/transition do estilo inline
  let cleaned = styleStr
  for (const prop of ANIMATION_STYLE_PROPERTIES) {
    // Ex.: "animation: blink 1s infinite;", "transition: all .2s;"
    const pattern = new RegExp(`(?:^|;)\\s*${prop}\\s*:[^;]*(?:;|$)`, 'gi')
    cleaned = cleaned.replace(pattern, (match) => (match.trim().endsWith(';') ? ';' : ''))
  }
  // Normaliza separadores duplicados após remoções
  cleaned = cleaned.replace(/;+/g, ';').replace(/^\s*;|;\s*$/g, '')
  return cleaned.trim() ? cleaned : ''
}

/**
 * Mapeia content_id ou nome de arquivo para a URL do anexo PocketBase
 */
export function buildAttachmentMap(attachments?: TicketAttachmentRecord[]): Map<string, string> {
  const map = new Map<string, string>()
  if (!attachments || attachments.length === 0) return map

  for (const att of attachments) {
    if (!att.file) continue
    const fileUrl = pb.files.getURL(att, att.file)
    if (!fileUrl) continue

    if (att.content_id) {
      const cleanCid = att.content_id.replace(/[<>]/g, '').trim().toLowerCase()
      map.set(cleanCid, fileUrl)
    }

    if (att.file_name) {
      const cleanName = att.file_name.trim().toLowerCase()
      map.set(cleanName, fileUrl)
    }
  }

  return map
}

/**
 * Substitui fontes cid:foo por URLs de anexos reais se disponíveis
 */
export function resolveCidUrls(html: string, attachmentMap: Map<string, string>): string {
  if (!html || attachmentMap.size === 0) return html

  return html.replace(/\bsrc=(["'])cid:([^"']+)\1/gi, (match, quote, cidValue) => {
    const cleanCid = (cidValue || '').replace(/[<>]/g, '').trim().toLowerCase()
    const foundUrl = attachmentMap.get(cleanCid)
    if (foundUrl) {
      return `src=${quote}${foundUrl}${quote}`
    }
    // Procura por nome de arquivo parcial
    for (const [key, url] of attachmentMap.entries()) {
      if (cleanCid.includes(key) || key.includes(cleanCid)) {
        return `src=${quote}${url}${quote}`
      }
    }
    return match
  })
}

/**
 * Sanitiza HTML de forma segura usando o DOMParser nativo do navegador
 */
export function sanitizeEmailHtml(rawHtml: string, attachments?: TicketAttachmentRecord[]): string {
  if (!rawHtml || typeof rawHtml !== 'string') return ''

  // 1. Resolver imagens inline (cid:)
  const attachmentMap = buildAttachmentMap(attachments)
  const resolvedHtml = resolveCidUrls(rawHtml, attachmentMap)

  // 2. Parse via DOMParser nativo do navegador
  if (typeof window === 'undefined' || !window.DOMParser) {
    return resolvedHtml
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(resolvedHtml, 'text/html')

  // Remove tags proibidas diretamente
  const forbiddenTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'form',
    'link',
    'meta',
    'base',
  ]
  forbiddenTags.forEach((tagName) => {
    const elements = doc.querySelectorAll(tagName)
    elements.forEach((el) => el.remove())
  })

  // Função recursiva de sanitização de nós
  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tagName = el.tagName.toLowerCase()

      // Se a tag não for permitida, converte em span ou remove
      if (!ALLOWED_TAGS.has(tagName)) {
        // Se for estilo global <style>, removemos
        if (tagName === 'style') {
          el.remove()
          return
        }
        // Substitui por span preservando filhos
        const span = doc.createElement('span')
        while (el.firstChild) {
          span.appendChild(el.firstChild)
        }
        el.parentNode?.replaceChild(span, el)
        sanitizeNode(span)
        return
      }

      // Sanitiza atributos
      const attrs = Array.from(el.attributes)
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase()
        const attrValue = attr.value

        // Remove handlers de eventos (onclick, onload, onerror, on*, etc.)
        if (attrName.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }

        // Remove atributos que não estão na lista branca
        if (!ALLOWED_ATTRS.has(attrName)) {
          el.removeAttribute(attr.name)
          continue
        }

        // Validação de URLs seguras
        if (attrName === 'src' || attrName === 'href') {
          if (!isSafeUrl(attrValue)) {
            el.removeAttribute(attr.name)
            continue
          }
        }

        // Sanitização de estilos inline
        if (attrName === 'style') {
          const cleanStyle = sanitizeStyle(attrValue)
          if (cleanStyle) {
            el.setAttribute('style', cleanStyle)
          } else {
            el.removeAttribute('style')
          }
        }
      }

      // Para links (<a>), garantir target="_blank" e rel="noopener noreferrer"
      if (tagName === 'a') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }

      // Para imagens (<img>), garantir max-w-full e display seguro
      if (tagName === 'img') {
        el.setAttribute('loading', 'lazy')
        const currentStyle = el.getAttribute('style') || ''
        el.setAttribute('style', `max-width: 100%; height: auto; ${currentStyle}`)
      }

      // Processar nós filhos recursivamente
      const children = Array.from(el.childNodes)
      for (const child of children) {
        sanitizeNode(child)
      }
    }
  }

  // Sanitizar a partir do body
  if (doc.body) {
    const bodyChildren = Array.from(doc.body.childNodes)
    for (const child of bodyChildren) {
      sanitizeNode(child)
    }
    return doc.body.innerHTML
  }

  return ''
}
