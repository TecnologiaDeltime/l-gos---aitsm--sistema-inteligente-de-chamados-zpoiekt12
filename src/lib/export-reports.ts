/**
 * Utilitários para exportação de relatórios em XLSX e PDF no cliente.
 * Paleta oficial: Grafite (#17181C) + Âmbar (#D97706 / #FCD34D)
 */

export interface ExportColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
  align?: 'left' | 'center' | 'right'
  width?: string // Para PDF, ex: '80px', '120px'
}

export interface ExportReportOptions<T> {
  filename: string // sem extensão
  reportTitle?: string // padrão: "Relatório Detalhado de Chamados"
  clientName?: string // ex: "Todos os clientes" ou o nome do cliente selecionado
  logoUrl?: string
  columns: ExportColumn<T>[]
  rows: T[]
  totalSummary?: {
    label: string
    value: string | number
  }
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Exporta para arquivo XLSX compatível (HTML Spreadsheet format aceito nativamente pelo Excel e LibreOffice Calc).
 * Mantém formatação com cores oficiais (grafite e âmbar), totalizadores e quebra de texto legível.
 */
export function exportReportToXlsx<T>(options: ExportReportOptions<T>): void {
  const {
    filename,
    reportTitle = 'Relatório Detalhado de Chamados',
    clientName = 'Todos os clientes',
    columns,
    rows,
    totalSummary,
  } = options

  const now = new Date().toLocaleString('pt-BR')

  const theadHtml = columns
    .map(
      (c) =>
        `<th style="background-color:#17181C;color:#FCD34D;font-weight:bold;padding:10px 8px;border:1px solid #31333A;text-align:${c.align || 'left'};font-size:11px;">${escapeHtml(c.header)}</th>`,
    )
    .join('')

  const tbodyHtml = rows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
      const cells = columns
        .map((c) => {
          const val = c.accessor(row)
          const text = val === null || val === undefined ? '—' : String(val)
          return `<td style="padding:6px 8px;border:1px solid #E5E7EB;text-align:${c.align || 'left'};font-size:11px;vertical-align:top;background-color:${bg};">${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  let tfootHtml = ''
  if (totalSummary) {
    const colspan = Math.max(1, columns.length - 1)
    tfootHtml = `
      <tr>
        <td colspan="${colspan}" style="background-color:#F3F4F6;color:#17181C;font-weight:bold;padding:8px;border:1px solid #D1D5DB;text-align:right;font-size:11px;">
          ${escapeHtml(totalSummary.label)}
        </td>
        <td style="background-color:#FEF3C7;color:#D97706;font-weight:bold;padding:8px;border:1px solid #D1D5DB;text-align:right;font-size:11px;font-family:monospace;">
          ${escapeHtml(totalSummary.value)}
        </td>
      </tr>
    `
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Relatorio</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #17181C; }
    table { border-collapse: collapse; width: 100%; mso-displayed-decimal-separator: ","; mso-displayed-thousand-separator: "."; }
    .header-box { margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header-box">
    <table style="border:none;margin-bottom:12px;">
      <tr>
        <td colspan="${columns.length}" style="font-size:16px;font-weight:bold;color:#D97706;padding:4px 0;">${escapeHtml(reportTitle)}</td>
      </tr>
      <tr>
        <td colspan="${columns.length}" style="font-size:11px;color:#4B5563;padding:2px 0;"><strong>Cliente:</strong> ${escapeHtml(clientName)}</td>
      </tr>
      <tr>
        <td colspan="${columns.length}" style="font-size:10px;color:#6B7280;padding:2px 0;"><strong>Data e hora de extração:</strong> ${escapeHtml(now)}</td>
      </tr>
      <tr>
        <td colspan="${columns.length}" style="font-size:10px;color:#6B7280;padding:2px 0;"><strong>Total de registros:</strong> ${rows.length}</td>
      </tr>
    </table>
  </div>
  <table>
    <thead>
      <tr>${theadHtml}</tr>
    </thead>
    <tbody>
      ${tbodyHtml}
    </tbody>
    ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ''}
  </table>
</body>
</html>`

  const blob = new Blob(['\ufeff' + html], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Exporta para PDF via iframe de impressão isolado com estilo ABNT/ITSM.
 * Inclui cabeçalho com logotipo da empresa, data/hora da extração, título e cliente,
 * tabela paginada com colunas visíveis e total de horas.
 */
export function exportReportToPdf<T>(options: ExportReportOptions<T>): void {
  const {
    filename,
    reportTitle = 'Relatório Detalhado de Chamados',
    clientName = 'Todos os clientes',
    logoUrl,
    columns,
    rows,
    totalSummary,
  } = options

  const now = new Date().toLocaleString('pt-BR')

  const logoHtml = logoUrl
    ? `<div class="logo-container"><img src="${escapeHtml(logoUrl)}" alt="Logotipo da Empresa" class="company-logo" /></div>`
    : `<div class="logo-fallback"><span class="logo-text">Lógos AITILSM</span></div>`

  const theadHtml = columns
    .map(
      (c) =>
        `<th class="${c.align || 'left'}" style="${c.width ? `width:${c.width};` : ''}">${escapeHtml(c.header)}</th>`,
    )
    .join('')

  const tbodyHtml = rows
    .map((row, idx) => {
      const isEven = idx % 2 === 1
      const cells = columns
        .map((c) => {
          const val = c.accessor(row)
          const text = val === null || val === undefined ? '—' : String(val)
          return `<td class="${c.align || 'left'}">${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr class="${isEven ? 'even' : ''}">${cells}</tr>`
    })
    .join('')

  let tfootHtml = ''
  if (totalSummary) {
    const colspan = Math.max(1, columns.length - 1)
    tfootHtml = `
      <tr class="summary-row">
        <td colspan="${colspan}" class="right font-bold">${escapeHtml(totalSummary.label)}</td>
        <td class="right font-bold summary-val">${escapeHtml(totalSummary.value)}</td>
      </tr>
    `
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(reportTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      color: #17181C;
      background: #FFFFFF;
      padding: 0;
    }
    .report-header {
      border-bottom: 2px solid #D97706;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .company-logo {
      max-height: 44px;
      max-width: 180px;
      object-fit: contain;
    }
    .logo-fallback {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #17181C;
      color: #FCD34D;
      border-radius: 6px;
      font-weight: bold;
      font-size: 11pt;
    }
    .logo-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #D97706;
    }
    .title-box h1 {
      font-size: 14pt;
      font-weight: 800;
      color: #17181C;
      letter-spacing: -0.3px;
    }
    .title-box p {
      font-size: 8.5pt;
      color: #4B5563;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      color: #4B5563;
      line-height: 1.4;
    }
    .meta-badge {
      display: inline-block;
      background: #FEF3C7;
      color: #B45309;
      border: 1px solid #FCD34D;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 7.5pt;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .table-container {
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th {
      background-color: #17181C;
      color: #FCD34D;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 6px 5px;
      border: 1px solid #31333A;
      vertical-align: middle;
    }
    td {
      padding: 4.5px 5px;
      font-size: 7.5pt;
      border: 1px solid #E5E7EB;
      vertical-align: top;
      color: #1F2937;
      line-height: 1.25;
      word-break: break-word;
    }
    tr.even td {
      background-color: #F9FAFB;
    }
    .left { text-align: left; }
    .center { text-align: center; }
    .right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .summary-row td {
      background-color: #FEF3C7;
      color: #92400E;
      border-top: 2px solid #D97706;
      border-bottom: 2px solid #D97706;
      padding: 6px 8px;
      font-size: 8pt;
    }
    .summary-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      color: #B45309;
    }
    .footer-note {
      margin-top: 10px;
      font-size: 7pt;
      color: #9CA3AF;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #E5E7EB;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="header-left">
      ${logoHtml}
      <div class="title-box">
        <h1>${escapeHtml(reportTitle)}</h1>
        <p>Cliente: <strong>${escapeHtml(clientName)}</strong></p>
      </div>
    </div>
    <div class="header-meta">
      <div><span class="meta-badge">Extração Oficial ITSM</span></div>
      <div><strong>Data/Hora:</strong> ${escapeHtml(now)}</div>
      <div><strong>Registros:</strong> ${rows.length} itens</div>
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>${theadHtml}</tr>
      </thead>
      <tbody>
        ${tbodyHtml}
      </tbody>
      ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ''}
    </table>
  </div>

  <div class="footer-note">
    <span>Lógos AITILSM • Documento confidencial para fins de auditoria e controle de serviços</span>
    <span>Arquivo: ${escapeHtml(filename)}.pdf</span>
  </div>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '1024px'
  iframe.style.height = '768px'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(html)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 1000)
    }, 350)
  }
}
