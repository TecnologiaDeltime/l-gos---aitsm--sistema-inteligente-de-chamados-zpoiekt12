import type { ContractRecord } from '@/services/contracts'
import { formatMinutes } from '@/lib/duration'

function fmt(value: any, fallback = 'N/A'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function fmtDate(value?: string): string {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('pt-BR')
}

function fmtArray(value: any): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return 'N/A'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function exportContractPdf(contract: ContractRecord, userName: string, logoUrl?: string) {
  const company = contract.expand?.company
  const now = new Date().toLocaleString('pt-BR')
  const logoHeader = logoUrl
    ? `<div style="margin-bottom:16px;text-align:left"><img src="${logoUrl}" alt="Logotipo da Empresa" style="max-height:48px;max-width:240px;object-fit:contain" /></div>`
    : `<div style="margin-bottom:16px;display:flex;align-items:center;gap:8px"><span style="font-size:16px;font-weight:800;color:#17181c;background:#fef3c7;border:1px solid #f59e0b;padding:4px 10px;border-radius:6px;font-family:sans-serif">Lógos AITSM</span></div>`
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Contrato ${contract.number}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;color:#1e293b}
h1{font-size:20px;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
h2{font-size:14px;color:#475569;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:8px}
td{padding:4px 8px;font-size:12px;vertical-align:top}
td:first-child{font-weight:bold;width:35%;color:#64748b}
.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
@media print{body{margin:20px}}</style></head><body>
${logoHeader}
<h1>Contrato de Serviços - ${fmt(contract.number)}</h1>
<h2>1. Dados do Contrato</h2><table>
<tr><td>Empresa (Razão Social)</td><td>${fmt(company?.legal_name)}</td></tr>
<tr><td>Nome Fantasia</td><td>${fmt(company?.trade_name)}</td></tr>
<tr><td>Número do Contrato</td><td>${fmt(contract.number)}</td></tr>
<tr><td>Data de Início</td><td>${fmtDate(contract.start_date)}</td></tr>
<tr><td>Data de Término</td><td>${fmtDate(contract.end_date)}</td></tr>
<tr><td>Status</td><td>${fmt(contract.status)}</td></tr>
<tr><td>Tipo</td><td>${fmt(contract.type)}</td></tr></table>
<h2>2. Horários e SLAs</h2><table>
<tr><td>Horário de Atendimento</td><td>${fmt(contract.service_hours_start)} - ${fmt(contract.service_hours_end)}</td></tr>
<tr><td>Dias de Serviço</td><td>${fmt(contract.service_days)}</td></tr>
<tr><td>SLA Resposta</td><td>${formatMinutes(Number(contract.sla_response_time) || 0)}</td></tr>
<tr><td>SLA Solução</td><td>${formatMinutes(Number(contract.sla_solution_time) || 0)}</td></tr>
<tr><td>SLA Atualização</td><td>${formatMinutes(Number(contract.sla_update_time) || 0)}</td></tr>
<tr><td>SLA Presencial</td><td>${formatMinutes(Number(contract.sla_field_service_time) || 0)}</td></tr>
<tr><td>Prioridades Disponíveis</td><td>${fmtArray(contract.priorities_available)}</td></tr></table>
<h2>3. Escopo</h2><table>
<tr><td>Serviços Incluídos</td><td>${fmt(contract.included_services)}</td></tr>
<tr><td>Serviços Excluídos</td><td>${fmt(contract.excluded_services)}</td></tr></table>
<h2>4. Políticas</h2><table>
<tr><td>Política de Hora Extra</td><td>${fmt(contract.overtime_policy)}</td></tr>
<tr><td>Política de Viagem</td><td>${fmt(contract.travel_policy)}</td></tr>
<tr><td>Política de Visita Técnica</td><td>${fmt(contract.technical_visit_policy)}</td></tr></table>
<h2>5. Observações</h2><table>
<tr><td>Observações</td><td>${fmt(contract.notes)}</td></tr></table>
<div class="footer">Gerado em ${now} por ${fmt(userName)} • Lógos AITSM</div>
</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '800px'
  iframe.style.height = '600px'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(html)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 500)
    }, 250)
  }
}
