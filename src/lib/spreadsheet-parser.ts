/**
 * Utilitário para leitura de planilhas CSV e XLSX no navegador, 100% client-side.
 * Suporta RFC 4180 (aspas, quebras de linha, vírgula, ponto-e-vírgula e tabulações)
 * e arquivos .xlsx descompactados nativamente com DecompressionStream ('deflate-raw').
 */

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, string>[]
  rawRows: string[][]
  warnings?: string[]
}

export interface ColumnDefinition {
  key: string
  label: string
  required?: boolean
  description?: string
  example?: string
}

/**
 * Normaliza o cabeçalho para comparação flexível (minúsculas, sem acentos, sem pontuação)
 */
export function normalizeHeaderKey(header: string): string {
  return (header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Divide uma linha CSV respeitando aspas
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Detecta delimitador (, ; ou \t)
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const semicolons = (firstLine.match(/;/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length

  if (semicolons > commas && semicolons > tabs) return ';'
  if (tabs > commas && tabs > semicolons) return '\t'
  return ','
}

/**
 * Parser de texto CSV
 */
export function parseCsvText(text: string): { headers: string[]; rawRows: string[][] } {
  // Remove BOM se presente
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return { headers: [], rawRows: [] }

  const delimiter = detectDelimiter(clean)
  const rawLines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (rawLines.length === 0) return { headers: [], rawRows: [] }

  const parsedLines = rawLines.map((line) => parseCsvLine(line, delimiter))
  const headers = parsedLines[0].map((h) => h.replace(/^["']|["']$/g, '').trim())
  const rawRows = parsedLines.slice(1)

  return { headers, rawRows }
}

/* ─────────────────────────────────────────────────────────────
   Parser nativo de XLSX (Zero dependências externas)
   ───────────────────────────────────────────────────────────── */

const ZIP_CD_SIG = 0x02014b50
const ZIP_EOCD_SIG = 0x06054b50
const ZIP_LOCAL_SIG = 0x04034b50

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  const noop = () => {}
  writer.write(bytes.slice()).catch(noop)
  writer.close().catch(noop)

  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.length
    }
  }

  const out = new Uint8Array(total)
  let p = 0
  for (const c of chunks) {
    out.set(c, p)
    p += c.length
  }
  return out
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

function findEocd(view: DataView, length: number): number {
  const min = Math.max(0, length - 22 - 0xffff)
  for (let p = length - 22; p >= min; p -= 1) {
    if (view.getUint32(p, true) === ZIP_EOCD_SIG) return p
  }
  return -1
}

function decodeXmlEntities(s: string): string {
  if (!s || !s.includes('&')) return s ?? ''
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (whole, e) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole
      return String.fromCodePoint(code)
    }
    const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
    return map[e] ?? whole
  })
}

function colIndex(ref: string): number {
  let n = 0
  for (let i = 0; i < ref.length; i += 1) {
    const c = ref.charCodeAt(i)
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64)
    else if (c >= 97 && c <= 122) n = n * 26 + (c - 96)
    else break
  }
  return n - 1
}

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rawRows: string[][] }> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const eocd = findEocd(view, bytes.length)
  if (eocd < 0) {
    throw new Error('Arquivo não é uma planilha XLSX válida (índice zip corrompido).')
  }

  const count = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  const entries = new Map<string, { method: number; compressedSize: number; localOffset: number }>()

  let p = cdOffset
  for (let i = 0; i < count && p + 46 <= bytes.length; i += 1) {
    if (view.getUint32(p, true) !== ZIP_CD_SIG) break
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = utf8(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.set(name, { method, compressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }

  const readZipText = async (name: string): Promise<string> => {
    const e = entries.get(name)
    if (!e) return ''
    if (view.getUint32(e.localOffset, true) !== ZIP_LOCAL_SIG) return ''
    const nameLen = view.getUint16(e.localOffset + 26, true)
    const extraLen = view.getUint16(e.localOffset + 28, true)
    const start = e.localOffset + 30 + nameLen + extraLen
    const raw = bytes.subarray(start, start + e.compressedSize)

    if (e.method === 0) return utf8(raw)
    if (e.method === 8) return utf8(await inflateRaw(raw))
    return ''
  }

  // Shared strings
  const sharedXml = await readZipText('xl/sharedStrings.xml')
  const sharedStrings: string[] = []
  if (sharedXml) {
    const siRegex = /<si>([\s\S]*?)<\/si>/g
    let siMatch
    while ((siMatch = siRegex.exec(sharedXml)) !== null) {
      const inner = siMatch[1]
      const tRegex = /<t(?: [^>]*)?>([\s\S]*?)<\/t>/g
      let tMatch
      let s = ''
      while ((tMatch = tRegex.exec(inner)) !== null) {
        s += decodeXmlEntities(tMatch[1])
      }
      sharedStrings.push(s)
    }
  }

  // Worksheets
  let sheetXml = await readZipText('xl/worksheets/sheet1.xml')
  if (!sheetXml) {
    // Procura por qualquer worksheet existente
    for (const key of entries.keys()) {
      if (key.startsWith('xl/worksheets/sheet') && key.endsWith('.xml')) {
        sheetXml = await readZipText(key)
        break
      }
    }
  }

  if (!sheetXml) {
    throw new Error('Nenhuma aba com dados encontrada na planilha XLSX.')
  }

  const rows: string[][] = []
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowInner = rowMatch[1]
    const cells: string[] = []
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
    let cellMatch
    let autoCol = 0

    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      const attrs = cellMatch[1]
      const cellContent = cellMatch[2]

      const rMatch = attrs.match(/r="([A-Za-z]+[0-9]+)"/)
      const colIdx = rMatch ? colIndex(rMatch[1]) : autoCol
      autoCol = colIdx + 1

      while (cells.length < colIdx) {
        cells.push('')
      }

      const isString = /t="s"/.test(attrs)
      const isInline = /t="inlineStr"/.test(attrs)

      let val = ''
      if (isInline) {
        const tMatch = cellContent.match(/<t[^>]*>([\s\S]*?)<\/t>/)
        if (tMatch) val = decodeXmlEntities(tMatch[1])
      } else {
        const vMatch = cellContent.match(/<v>([\s\S]*?)<\/v>/)
        if (vMatch) {
          const rawV = vMatch[1].trim()
          if (isString) {
            const idx = Number(rawV)
            val = sharedStrings[idx] ?? ''
          } else {
            val = rawV
          }
        }
      }

      cells.push(val.trim())
    }

    if (cells.some((c) => c !== '')) {
      rows.push(cells)
    }
  }

  if (rows.length === 0) {
    return { headers: [], rawRows: [] }
  }

  const headers = rows[0]
  const rawRows = rows.slice(1)
  return { headers, rawRows }
}

/**
 * Lê um arquivo File (CSV ou XLSX) e devolve linhas estruturadas
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer()
    const { headers, rawRows } = await parseXlsxBuffer(buffer)
    const objects = rawRowsToObjects(headers, rawRows)
    return { headers, rawRows, rows: objects }
  }

  // Padrão CSV ou texto
  const text = await file.text()
  const { headers, rawRows } = parseCsvText(text)
  const objects = rawRowsToObjects(headers, rawRows)
  return { headers, rawRows, rows: objects }
}

function rawRowsToObjects(headers: string[], rawRows: string[][]): Record<string, string>[] {
  const normHeaders = headers.map((h) => normalizeHeaderKey(h))
  return rawRows.map((row) => {
    const obj: Record<string, string> = {}
    normHeaders.forEach((key, idx) => {
      if (key) {
        obj[key] = (row[idx] || '').trim()
      }
    })
    return obj
  })
}

/**
 * Faz download de modelo CSV com codificação UTF-8 e BOM
 */
export function downloadCsvTemplate(
  filename: string,
  columns: ColumnDefinition[],
  sampleRows: Record<string, string>[] = [],
): void {
  const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(';')
  const rows = sampleRows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key] || row[normalizeHeaderKey(col.label)] || ''
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(';'),
  )

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Faz download de modelo XLSX compatível (HTML Spreadsheet XML nativo do Excel)
 */
export function downloadXlsxTemplate(
  filename: string,
  sheetTitle: string,
  columns: ColumnDefinition[],
  sampleRows: Record<string, string>[] = [],
): void {
  const escapeXml = (str: any) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const thead = columns
    .map(
      (c) =>
        `<th style="background-color:#17181C;color:#FCD34D;font-weight:bold;padding:10px 8px;border:1px solid #31333A;text-align:left;font-size:11px;">${escapeXml(c.label)}</th>`,
    )
    .join('')

  const tbody = sampleRows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
      const cells = columns
        .map((col) => {
          const val = row[col.key] || row[normalizeHeaderKey(col.label)] || ''
          return `<td style="padding:6px 8px;border:1px solid #E5E7EB;text-align:left;font-size:11px;background-color:${bg};">${escapeXml(val)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #17181C; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>
  <div style="margin-bottom:12px;">
    <h2 style="color:#D97706;font-size:16px;margin:0 0 4px 0;">${escapeXml(sheetTitle)}</h2>
    <p style="color:#6B7280;font-size:11px;margin:0;">Modelo oficial de importação Lógos AITILSM. Preencha as linhas abaixo e mantenha os cabeçalhos intactos.</p>
  </div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`

  const blob = new Blob(['\ufeff' + html], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
