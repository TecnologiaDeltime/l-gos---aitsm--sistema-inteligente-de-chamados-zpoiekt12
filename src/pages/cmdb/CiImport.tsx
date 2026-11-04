import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCompanies } from '@/services/companies'
import {
  getEquipments,
  createEquipment,
  AVAILABILITY_STATUSES,
  CI_STATUSES,
} from '@/services/equipments'
import { useToast } from '@/hooks/use-toast'
import * as XLSX from 'xlsx'
import {
  generateProfessionalXlsxTemplate,
  InstructionItem,
  TemplateColumn,
} from '@/lib/bulk-import-templates'
import { AssetBulkImportDialog } from '@/components/cmdb/AssetBulkImportDialog'

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { key: 'name', label: 'Nome do Ativo', required: true, example: 'Servidor DB-01' },
  { key: 'hostname', label: 'Hostname', required: false, example: 'db-01' },
  { key: 'device_type', label: 'Tipo de Dispositivo', required: false, example: 'Servidor' },
  { key: 'type', label: 'Categoria', required: false, example: 'Servidor' },
  { key: 'manufacturer', label: 'Fabricante', required: false, example: 'Dell' },
  { key: 'model', label: 'Modelo', required: false, example: 'PowerEdge R750' },
  { key: 'serial_number', label: 'Número de Série', required: false, example: 'SRV001' },
  { key: 'patrimony_number', label: 'Patrimônio', required: false, example: 'PAT001' },
  { key: 'ip_address', label: 'Endereço IP', required: false, example: '192.168.1.10' },
  {
    key: 'operating_system',
    label: 'Sistema Operacional',
    required: false,
    example: 'Linux Ubuntu 22.04',
  },
  { key: 'processor', label: 'Processador', required: false, example: 'Intel Xeon Silver 4310' },
  { key: 'processor_cores', label: 'Cores de Processador', required: false, example: '12' },
  { key: 'ram_total', label: 'Memória RAM', required: false, example: '64GB' },
  { key: 'storage', label: 'Armazenamento', required: false, example: '2TB' },
  { key: 'storage_type', label: 'Tipo de Armazenamento', required: false, example: 'SSD' },
  { key: 'owner', label: 'Proprietário', required: false, example: 'TI / Infraestrutura' },
  { key: 'location', label: 'Localização', required: false, example: 'Data Center' },
  { key: 'responsible_user', label: 'Usuário Responsável', required: false, example: 'João Silva' },
  { key: 'supplier', label: 'Fornecedor', required: false, example: 'Dell Brasil' },
  { key: 'acquisition_date', label: 'Data de Aquisição', required: false, example: '2024-01-15' },
  { key: 'warranty_until', label: 'Garantia Até', required: false, example: '2027-01-15' },
  { key: 'status', label: 'Status Operacional', required: false, example: 'Ativo' },
]

const TEMPLATE_HEADERS = TEMPLATE_COLUMNS.map((c) => c.key)

interface ParsedRow {
  data: Record<string, string>
  errors: string[]
  duplicate?: string
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else cell += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') {
        row.push(cell)
        cell = ''
      } else if (c === '\n') {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
      } else if (c !== '\r') cell += c
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export default function CiImport() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState('')
  const [companies, setCompanies] = useState<any[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<{ ok: number; fail: number } | null>(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)

  useState(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  })

  const downloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      const sample = [
        'Servidor DB-01',
        'db-01',
        'Servidor',
        'Servidor',
        'Dell',
        'PowerEdge R750',
        'SRV001',
        'PAT001',
        '192.168.1.10',
        'Linux Ubuntu 22.04',
        'Intel Xeon Silver 4310',
        '12',
        '64GB',
        '2TB',
        'SSD',
        'TI / Infraestrutura',
        'Data Center',
        'João Silva',
        'Dell Brasil',
        '2024-01-15',
        '2027-01-15',
        'Ativo',
      ]
      const csv = [TEMPLATE_HEADERS.join(','), sample.join(',')].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `modelo_importacao_ativos_${dateStr}.csv`
      a.click()
    } else {
      const exampleRows = [
        {
          name: 'Servidor DB-01',
          hostname: 'db-01',
          device_type: 'Servidor',
          type: 'Servidor',
          manufacturer: 'Dell',
          model: 'PowerEdge R750',
          serial_number: 'SRV001',
          patrimony_number: 'PAT001',
          ip_address: '192.168.1.10',
          operating_system: 'Linux Ubuntu 22.04',
          processor: 'Intel Xeon Silver 4310',
          processor_cores: '12',
          ram_total: '64GB',
          storage: '2TB',
          storage_type: 'SSD',
          owner: 'TI / Infraestrutura',
          location: 'Data Center',
          responsible_user: 'João Silva',
          supplier: 'Dell Brasil',
          acquisition_date: '2024-01-15',
          warranty_until: '2027-01-15',
          status: 'Ativo',
        },
        {
          name: 'Notebook Dell Latitude 5420',
          hostname: 'nb-fin-01',
          device_type: 'Notebook',
          type: 'Notebook',
          manufacturer: 'Dell',
          model: 'Latitude 5420',
          serial_number: 'BR12345678',
          patrimony_number: 'PAT002',
          ip_address: '192.168.1.150',
          operating_system: 'Windows 11 Pro',
          processor: 'Intel Core i7 11th Gen',
          processor_cores: '8',
          ram_total: '16GB',
          storage: '512GB',
          storage_type: 'SSD NVMe',
          owner: 'Financeiro',
          location: '2º Andar - Sala 204',
          responsible_user: 'Maria da Silva',
          supplier: 'Dell Brasil',
          acquisition_date: '2023-06-20',
          warranty_until: '2026-06-20',
          status: 'Ativo',
        },
      ]

      const instructions: InstructionItem[] = [
        {
          campo: 'Nome do Ativo (name)',
          obrigatorio: 'Sim',
          descricao: 'Identificação principal do item de configuração / ativo.',
          exemplo: 'Servidor DB-01',
          valoresAceitos: 'Texto livre (obrigatório)',
        },
        {
          campo: 'Hostname (hostname)',
          obrigatorio: 'Não',
          descricao: 'Nome de rede ou DNS.',
          exemplo: 'db-01',
          valoresAceitos: 'Texto livre',
        },
        {
          campo: 'Status Operacional (status)',
          obrigatorio: 'Não',
          descricao: 'Situação de ciclo de vida do item.',
          exemplo: 'Ativo',
          valoresAceitos: CI_STATUSES.join(', '),
        },
        {
          campo: 'Número de Série (serial_number)',
          obrigatorio: 'Não',
          descricao: 'Serial do fabricante.',
          exemplo: 'SRV001',
          valoresAceitos: 'Alfanumérico único',
        },
        {
          campo: 'Patrimônio (patrimony_number)',
          obrigatorio: 'Não',
          descricao: 'Etiqueta de patrimônio.',
          exemplo: 'PAT001',
          valoresAceitos: 'Alfanumérico',
        },
      ]

      generateProfessionalXlsxTemplate({
        filename: `modelo_importacao_ativos_${dateStr}.xlsx`,
        sheetName: 'Ativos_CMDB',
        columns: TEMPLATE_COLUMNS,
        exampleRows,
        instructionsTitle: 'Importação de Itens de Configuração (CMDB)',
        instructions,
        extraNotes: [
          'Opções aceitas de Status: ' + CI_STATUSES.join(', '),
          'Opções aceitas de Status de Disponibilidade: ' + AVAILABILITY_STATUSES.join(', '),
        ],
      })
    }

    toast({
      title: 'Modelo XLSX baixado!',
      description: 'Preencha o arquivo com seus itens e envie para validação.',
    })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      let headers: string[] = []
      let dataRows: string[][] = []

      if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })
        if (matrix.length > 0) {
          headers = (matrix[0] || []).map((h) => String(h).trim())
          // Se a linha 2 for orientativa (Obrigatório/Opcional), pula
          const secondRow = matrix[1] || []
          const isGuide = secondRow.some((c) => /obrigat[oó]rio|opcional/i.test(String(c)))
          const startIdx = isGuide ? 2 : 1
          dataRows = matrix
            .slice(startIdx)
            .map((r) => (r || []).map((c: any) => String(c ?? '').trim()))
        }
      } else {
        const text = await file.text()
        const parsed = parseCSV(text)
        headers = parsed[0] || []
        dataRows = parsed.slice(1)
      }

      const existing = await getEquipments().catch(() => [])
      const serials = new Set(existing.map((eq) => eq.serial_number).filter(Boolean))
      const pats = new Set(existing.map((eq) => eq.patrimony_number).filter(Boolean))
      const eqMap = new Map<string, string>(
        existing
          .filter((eq) => !!eq.serial_number)
          .map((eq) => [eq.serial_number as string, eq.name || '']),
      )

      const headerMap: Record<number, string> = {}
      headers.forEach((h, idx) => {
        const clean = h.toLowerCase().trim()
        // Mapeia tanto o nome técnico quanto os rótulos em português
        const found = TEMPLATE_COLUMNS.find(
          (c) =>
            c.key.toLowerCase() === clean ||
            c.label.toLowerCase() === clean ||
            clean.includes(c.key.toLowerCase()),
        )
        if (found) {
          headerMap[idx] = found.key
        } else {
          headerMap[idx] = clean
        }
      })

      const parsed: ParsedRow[] = dataRows
        .filter((cells) => cells.some((c) => !!c))
        .map((cells) => {
          const data: Record<string, string> = {}
          cells.forEach((val, i) => {
            const k = headerMap[i] || `col_${i}`
            data[k] = val
          })
          const errors: string[] = []
          if (!data.name) errors.push('Nome é obrigatório')
          if (
            data.status &&
            ![
              'Planejado',
              'Ativo',
              'Inativo',
              'Em Manutenção',
              'Descartado',
              'Reserva',
              'Emprestado',
            ].includes(data.status)
          ) {
            errors.push('Status inválido')
          }
          let dup = ''
          if (data.serial_number && serials.has(data.serial_number)) {
            errors.push('Serial duplicado')
            dup = eqMap.get(data.serial_number) || ''
          }
          if (data.patrimony_number && pats.has(data.patrimony_number)) {
            errors.push('Patrimônio duplicado')
            dup = dup || 'CI existente'
          }
          return { data, errors, duplicate: dup }
        })
      setRows(parsed)
      setSummary(null)
    } catch (err: any) {
      toast({
        title: 'Erro ao ler arquivo',
        description: err?.message || 'Verifique se o arquivo está no formato XLSX ou CSV correto.',
        variant: 'destructive',
      })
    }
  }

  const handleImport = async () => {
    if (!companyId) {
      toast({ title: 'Selecione uma empresa' })
      return
    }
    setImporting(true)
    let ok = 0,
      fail = 0
    for (const row of rows) {
      if (row.errors.length > 0) {
        fail++
        continue
      }
      try {
        await createEquipment({
          ...row.data,
          company: companyId,
          status: row.data.status || 'Ativo',
        })
        ok++
      } catch {
        fail++
      }
    }
    setImporting(false)
    setSummary({ ok, fail })
    toast({ title: `${ok} ativos importados, ${fail} falhas` })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Importar Ativos (XLSX / CSV)</h2>
          <p className="text-xs text-slate-500">
            Envie sua planilha com equipamentos ou utilize o assistente de importação em massa
            avançado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
            onClick={() => setBulkImportOpen(true)}
          >
            <Layers className="mr-1.5 h-4 w-4" />
            Importação em Massa Avançada (Recomendado)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-900 dark:text-amber-200"
            onClick={() => downloadTemplate('xlsx')}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-amber-600" /> Baixar Modelo XLSX
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name || c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Selecionar Arquivo (XLSX ou CSV)
        </Button>
      </div>

      <AssetBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImportComplete={() => {
          navigate('/cmdb/assets')
        }}
      />

      {summary && (
        <div className="rounded-lg border bg-white p-4 dark:bg-slate-900 flex items-center gap-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium">{summary.ok} ativos importados com sucesso</span>
          {summary.fail > 0 && (
            <>
              <AlertCircle className="h-5 w-5 text-red-600 ml-4" />
              <span className="text-sm font-medium">{summary.fail} falhas</span>
            </>
          )}
          <Button variant="link" size="sm" onClick={() => navigate('/cmdb/assets')}>
            Ver Ativos
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing ? 'Importando...' : 'Confirmar Importação'}
            </Button>
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b font-semibold">
                <tr>
                  <th className="p-2">Linha</th>
                  {TEMPLATE_HEADERS.map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={row.errors.length > 0 ? 'bg-red-50' : ''}
                    title={row.errors.join(', ')}
                  >
                    <td className="p-2 font-medium">{i + 2}</td>
                    {TEMPLATE_HEADERS.map((h) => (
                      <td key={h} className="p-2">
                        {row.data[h] || '-'}
                      </td>
                    ))}
                    <td className="p-2">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600" title={row.errors.join(', ')}>
                          {row.errors[0]}
                        </span>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
