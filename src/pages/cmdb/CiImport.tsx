import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCompanies } from '@/services/companies'
import { getEquipments, createEquipment } from '@/services/equipments'
import { useToast } from '@/hooks/use-toast'

const TEMPLATE_HEADERS = [
  'name',
  'type',
  'manufacturer',
  'model',
  'serial_number',
  'patrimony_number',
  'ip_address',
  'operating_system',
  'location',
  'responsible_user',
  'supplier',
  'acquisition_date',
  'warranty_until',
  'status',
]

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

  useState(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  })

  const downloadTemplate = () => {
    const sample = [
      'Servidor DB-01',
      'Servidor',
      'Dell',
      'PowerEdge R750',
      'SRV001',
      'PAT001',
      '192.168.1.10',
      'Linux Ubuntu 22.04',
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
    a.download = 'modelo_importacao_ativos.csv'
    a.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const [headers, ...dataRows] = parseCSV(text)
    const existing = await getEquipments().catch(() => [])
    const serials = new Set(existing.map((e) => e.serial_number).filter(Boolean))
    const pats = new Set(existing.map((e) => e.patrimony_number).filter(Boolean))
    const eqMap = new Map(existing.map((e) => [e.serial_number, e.name]))

    const parsed: ParsedRow[] = dataRows.map((cells) => {
      const data: Record<string, string> = {}
      headers.forEach((h, i) => {
        data[h.trim()] = (cells[i] || '').trim()
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
      )
        errors.push('Status inválido')
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
        <h2 className="text-lg font-bold">Importar Ativos (CSV)</h2>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1.5 h-4 w-4" /> Baixar Modelo
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Selecionar Arquivo
        </Button>
      </div>

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
