/**
 * Tema de CAPTURA para o download direto do Relatório de Funcionalidades
 * (src/lib/direct-pdf-report.ts).
 *
 * O html2canvas NÃO avalia @media print — as regras de papel de
 * implemented-features-print.css (que resolvem o "PDF em branco" do tema
 * escuro) não se aplicam durante a captura. Elas são replicadas aqui sem o
 * media query e escopadas à classe .report-capture, que o exportador adiciona
 * temporariamente ao .report-container e remove ao final: nada muda na tela.
 *
 * Importado como string inline pelo Vite (?inline) — não vira <style> global.
 */
import captureCss from './direct-pdf-capture.css?inline'

export const REPORT_CAPTURE_CSS: string = captureCss
