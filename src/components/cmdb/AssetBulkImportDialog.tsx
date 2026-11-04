import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  createEquipment,
  updateEquipment,
  EquipmentRecord,
  AVAILABILITY_STATUSES,
  CI_STATUSES,
} from '@/services/equipments'

export interface AssetBulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

interface RawRow {
  rowNumber: number
  data: Record<string, string>
}

interface RowValidationError {
  rowNumber: number
  column: string
  reason: string
}

interface ValidAssetRow {
  rowNumber: number
  payload: Partial<EquipmentRecord>
  raw: Record<string, string>
  companyId: string
  companyName: string
  unitId?: string
  unitName?: string
  departmentId?: string
  departmentName?: string
  serialNumber?: string
  hostname?: string
}

type DuplicateMode = 'update' | 'skip'

const COLUMNS = [
  { key: 'nome', label: 'Nome do Ativo', required: true, example: 'Notebook Dell Latitude 5420' },
  { key: 'empresa', label: 'Empresa / Cliente', required: true, example: 'Empresa Exemplo LTDA' },
  { key: 'hostname', label: 'Hostname', required: false, example: 'NB-FIN-01' },
  { key: 'tipo', label: 'Tipo / Dispositivo', required: false, example: 'Notebook' },
  { key: 'marca', label: 'Marca / Fabricante', required: false, example: 'Dell' },
  { key: 'modelo', label: 'Modelo', required: false, example: 'Latitude 5420' },
  { key: 'serial', label: 'Número de Série', required: false, example: 'BR12345678' },
  { key: 'patrimonio', label: 'Patrimônio', required: false, example: 'PAT-00452' },
  { key: 'ip', label: 'Endereço IP', required: false, example: '192.168.1.150' },
  { key: 'so', label: 'Sistema Operacional', required: false, example: 'Windows 11 Pro' },
  { key: 'filial', label: 'Filial / Unidade', required: false, example: 'Matriz' },
  { key: 'setor', label: 'Setor / Departamento', required: false, example: 'Financeiro' },
  { key: 'localizacao', label: 'Localização', required: false, example: '2º Andar - Sala 204' },
  {
    key: 'usuario_responsavel',
    label: 'Usuário Responsável',
    required: false,
    example: 'Maria da Silva',
  },
  {
    key: 'status_disponibilidade',
    label: 'Status Disponibilidade',
    required: false,
    example: 'Em uso',
  },
  { key: 'status_operacional', label: 'Status Operacional', required: false, example: 'Ativo' },
  { key: 'processador', label: 'Processador', required: false, example: 'Intel Core i7 11th Gen' },
  { key: 'memoria_ram', label: 'Memória RAM', required: false, example: '16GB' },
  { key: 'armazenamento', label: 'Armazenamento', required: false, example: '512GB SSD' },
  { key: 'tipo_armazenamento', label: 'Tipo Armazenamento', required: false, example: 'SSD' },
  { key: 'proprietario', label: 'Dono / Proprietário', required: false, example: 'TI Corporativa' },
  { key: 'fornecedor', label: 'Fornecedor', required: false, example: 'Dell Computadores' },
  { key: 'observacoes', label: 'Observações', required: false, example: 'Adquirido em locação' },
]

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

export function AssetBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: AssetBulkImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('update')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const [fileName, setFileName] = useState('')
  const [validationErrors, setValidationErrors] = useState<RowValidationError[]>([])
  const [validRows, setValidRows] = useState<ValidAssetRow[]>([])
  const [totalRows, setTotalRows] = useState(0)

  const [importSummary, setImportSummary] = useState<{
    imported: number
    updated: number
    skipped: number
    failed: number
    errors: string[]
  } | null>(null)

  // Cache de cadastros para casamento exato/case-insensitive
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [existingEquipments, setExistingEquipments] = useState<EquipmentRecord[]>([])

  useEffect(() => {
    if (open) {
      setStep('upload')
      setValidationErrors([])
      setValidRows([])
      setTotalRows(0)
      setImportSummary(null)
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Pré-carrega metadados
      Promise.allSettled([
        pb.collection('companies').getFullList({ sort: 'trade_name,legal_name' }),
        pb.collection('company_units').getFullList({ sort: 'name' }),
        pb.collection('company_departments').getFullList({ sort: 'name' }),
        pb.collection('equipments').getFullList<EquipmentRecord>({ sort: '-created' }),
      ]).then(([compRes, unitRes, deptRes, eqRes]) => {
        if (compRes.status === 'fulfilled') setCompanies(compRes.value)
        if (unitRes.status === 'fulfilled') setUnits(unitRes.value)
        if (deptRes.status === 'fulfilled') setDepartments(deptRes.value)
        if (eqRes.status === 'fulfilled') setExistingEquipments(eqRes.value)
      })
    }
  }, [open])

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const headers = COLUMNS.map((c) => c.label)
    const exampleRow = COLUMNS.map((c) => c.example)
    const instructionsRow = COLUMNS.map((c) => (c.required ? 'Obrigatório' : 'Opcional'))

    const wsData = [headers, instructionsRow, exampleRow]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Ajusta larguras de coluna
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(c.label.length + 4, 18) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Ativos_CMDB')

    const dateStr = new Date().toISOString().slice(0, 10)
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `modelo_importacao_ativos_${dateStr}.xlsx`)
    } else {
      XLSX.writeFile(wb, `modelo_importacao_ativos_${dateStr}.csv`, { bookType: 'csv' })
    }

    toast({
      title: 'Modelo baixado com sucesso!',
      description: `Preencha o arquivo com seus ativos e envie para validação.`,
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParsing(true)
    setValidationErrors([])
    setValidRows([])
    setTotalRows(0)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('A planilha está vazia ou não possui abas.')
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' })

      if (!rawMatrix || rawMatrix.length === 0) {
        throw new Error('A planilha não possui dados.')
      }

      // Encontrar a linha de cabeçalho
      let headerRowIndex = 0
      let headerMap: Record<number, string> = {}

      for (let r = 0; r < Math.min(rawMatrix.length, 5); r++) {
        const row = rawMatrix[r]
        if (!Array.isArray(row)) continue
        const normalized = row.map((cell) => normalizeKey(String(cell)))
        if (
          normalized.some(
            (k) =>
              k.includes('nome') ||
              k.includes('ativo') ||
              k.includes('empresa') ||
              k.includes('cliente') ||
              k.includes('hostname'),
          )
        ) {
          headerRowIndex = r
          row.forEach((cell, idx) => {
            const norm = normalizeKey(String(cell))
            if (norm) headerMap[idx] = norm
          })
          break
        }
      }

      // Processar linhas de dados
      const dataRows: RawRow[] = []
      for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r]
        if (!Array.isArray(row)) continue

        const rowObj: Record<string, string> = {}
        let hasAnyValue = false

        row.forEach((cell, idx) => {
          const colKey = headerMap[idx]
          const val = cleanString(cell)
          if (colKey) {
            rowObj[colKey] = val
          }
          if (val) hasAnyValue = true
        })

        // Ignora linha descritiva de instrução (ex: "Obrigatório" / "Opcional")
        const firstVals = Object.values(rowObj).slice(0, 3).join(' ').toLowerCase()
        if (firstVals.includes('obrigatorio') && firstVals.includes('opcional')) {
          continue
        }

        if (hasAnyValue) {
          dataRows.push({
            rowNumber: r + 1,
            data: rowObj,
          })
        }
      }

      setTotalRows(dataRows.length)

      if (dataRows.length === 0) {
        throw new Error('Nenhuma linha de ativo válida foi encontrada após o cabeçalho.')
      }

      // Validação das linhas contra regras do CMDB e relacionamentos
      validateRows(dataRows)
      setStep('preview')
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err)
      toast({
        title: 'Erro ao processar planilha',
        description: err?.message || 'Verifique o formato do arquivo e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setParsing(false)
    }
  }

  // Mapeador flexível de aliases
  const findValue = (data: Record<string, string>, aliases: string[]): string => {
    for (const [k, v] of Object.entries(data)) {
      const norm = normalizeKey(k)
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        if (v) return v
      }
    }
    return ''
  }

  const validateRows = (rows: RawRow[]) => {
    const errors: RowValidationError[] = []
    const valid: ValidAssetRow[] = []

    rows.forEach((row) => {
      const { rowNumber, data } = row

      const nome = findValue(data, ['nome', 'nome_do_ativo', 'ativo', 'equipamento', 'asset_name'])
      const empresa = findValue(data, ['empresa', 'cliente', 'empresa_cliente', 'company'])
      const hostname = findValue(data, ['hostname', 'host', 'nome_host'])
      const tipo = findValue(data, ['tipo', 'dispositivo', 'device_type', 'tipo_dispositivo'])
      const marca = findValue(data, ['marca', 'fabricante', 'manufacturer'])
      const modelo = findValue(data, ['modelo', 'model'])
      const serial = findValue(data, [
        'serial',
        'numero_de_serie',
        'serial_number',
        'sn',
        'n_serie',
      ])
      const patrimonio = findValue(data, [
        'patrimonio',
        'numero_de_patrimonio',
        'patrimony_number',
        'tag',
      ])
      const ip = findValue(data, ['ip', 'endereco_ip', 'ip_address'])
      const so = findValue(data, ['so', 'sistema_operacional', 'operating_system', 'os'])
      const filial = findValue(data, ['filial', 'unidade', 'unit', 'branch'])
      const setor = findValue(data, ['setor', 'departamento', 'department'])
      const localizacao = findValue(data, ['localizacao', 'local', 'location', 'sala'])
      const usuarioResp = findValue(data, [
        'usuario_responsavel',
        'responsavel',
        'responsible_user',
        'usuario',
      ])
      const statusDispRaw = findValue(data, [
        'status_disponibilidade',
        'disponibilidade',
        'availability_status',
      ])
      const statusOperRaw = findValue(data, ['status_operacional', 'status', 'status_oper'])
      const processador = findValue(data, ['processador', 'cpu', 'processor'])
      const ram = findValue(data, ['memoria_ram', 'ram', 'ram_total', 'memoria'])
      const armazenamento = findValue(data, ['armazenamento', 'disco', 'hd', 'ssd', 'storage'])
      const tipoArmazenamento = findValue(data, ['tipo_armazenamento', 'storage_type'])
      const proprietario = findValue(data, ['proprietario', 'dono', 'owner'])
      const fornecedor = findValue(data, ['fornecedor', 'supplier'])
      const observacoes = findValue(data, ['observacoes', 'obs', 'notes', 'notas'])

      let hasRowError = false

      // 1. Nome obrigatório
      if (!nome) {
        errors.push({
          rowNumber,
          column: 'Nome do Ativo',
          reason: 'Campo obrigatório em branco.',
        })
        hasRowError = true
      }

      // 2. Empresa/Cliente obrigatória e com casamento existente
      if (!empresa) {
        errors.push({
          rowNumber,
          column: 'Empresa / Cliente',
          reason: 'Campo obrigatório em branco.',
        })
        hasRowError = true
      }

      let matchedCompany: any = null
      if (empresa) {
        const normEmpresa = normalizeKey(empresa)
        matchedCompany = companies.find((c) => {
          const normTrade = normalizeKey(c.trade_name || '')
          const normLegal = normalizeKey(c.legal_name || '')
          const normCode = normalizeKey(c.code || '')
          return (
            normTrade === normEmpresa ||
            normLegal === normEmpresa ||
            normCode === normEmpresa ||
            c.id === empresa
          )
        })

        if (!matchedCompany) {
          errors.push({
            rowNumber,
            column: 'Empresa / Cliente',
            reason: `Empresa "${empresa}" não encontrada no cadastro de clientes.`,
          })
          hasRowError = true
        }
      }

      // 3. Filial opcional - se informada, DEVE existir vinculada à empresa
      let matchedUnit: any = null
      if (filial && matchedCompany) {
        const normFilial = normalizeKey(filial)
        matchedUnit = units.find(
          (u) =>
            u.company === matchedCompany.id &&
            (normalizeKey(u.name || '') === normFilial || u.id === filial),
        )

        if (!matchedUnit) {
          errors.push({
            rowNumber,
            column: 'Filial / Unidade',
            reason: `Filial "${filial}" não encontrada para o cliente "${matchedCompany.trade_name || matchedCompany.legal_name}".`,
          })
          hasRowError = true
        }
      }

      // 4. Setor opcional - se informado, DEVE existir vinculado à empresa
      let matchedDepartment: any = null
      if (setor && matchedCompany) {
        const normSetor = normalizeKey(setor)
        matchedDepartment = departments.find(
          (d) =>
            d.company === matchedCompany.id &&
            (normalizeKey(d.name || '') === normSetor || d.id === setor),
        )

        if (!matchedDepartment) {
          errors.push({
            rowNumber,
            column: 'Setor / Departamento',
            reason: `Setor "${setor}" não encontrado para o cliente "${matchedCompany.trade_name || matchedCompany.legal_name}".`,
          })
          hasRowError = true
        }
      }

      // 5. Validação de status de disponibilidade (se informado)
      let resolvedAvailability: string = 'Em uso'
      if (statusDispRaw) {
        const match = AVAILABILITY_STATUSES.find(
          (s) => normalizeKey(s) === normalizeKey(statusDispRaw),
        )
        if (match) {
          resolvedAvailability = match
        } else {
          errors.push({
            rowNumber,
            column: 'Status Disponibilidade',
            reason: `Valor inválido "${statusDispRaw}". Valores permitidos: ${AVAILABILITY_STATUSES.join(', ')}.`,
          })
          hasRowError = true
        }
      }

      // 6. Validação de status operacional (se informado)
      let resolvedStatus: string = 'Ativo'
      if (statusOperRaw) {
        const match = CI_STATUSES.find((s) => normalizeKey(s) === normalizeKey(statusOperRaw))
        if (match) {
          resolvedStatus = match
        } else {
          errors.push({
            rowNumber,
            column: 'Status Operacional',
            reason: `Valor inválido "${statusOperRaw}". Valores permitidos: ${CI_STATUSES.join(', ')}.`,
          })
          hasRowError = true
        }
      }

      if (!hasRowError && matchedCompany) {
        const payload: Partial<EquipmentRecord> = {
          name: nome,
          company: matchedCompany.id,
          unit: matchedUnit?.id || undefined,
          department: matchedDepartment?.id || undefined,
          hostname: hostname || undefined,
          type: tipo || undefined,
          device_type: tipo || undefined,
          manufacturer: marca || undefined,
          model: modelo || undefined,
          serial_number: serial || undefined,
          patrimony_number: patrimonio || undefined,
          ip_address: ip || undefined,
          operating_system: so || undefined,
          location: localizacao || undefined,
          responsible_user: usuarioResp || undefined,
          availability_status: resolvedAvailability,
          status: resolvedStatus,
          processor: processador || undefined,
          ram_total: ram || undefined,
          storage: armazenamento || undefined,
          storage_type: tipoArmazenamento || undefined,
          owner: proprietario || undefined,
          supplier: fornecedor || undefined,
          notes: observacoes || undefined,
        }

        valid.push({
          rowNumber,
          payload,
          raw: data,
          companyId: matchedCompany.id,
          companyName: matchedCompany.trade_name || matchedCompany.legal_name,
          unitId: matchedUnit?.id,
          unitName: matchedUnit?.name,
          departmentId: matchedDepartment?.id,
          departmentName: matchedDepartment?.name,
          serialNumber: serial || undefined,
          hostname: hostname || undefined,
        })
      }
    })

    setValidationErrors(errors)
    setValidRows(valid)
  }

  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros apontados na planilha e tente novamente.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    let importedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const failureMessages: string[] = []

    // Atualiza lista em memória dos equipamentos para conferir duplicidades
    let currentEquipments = [...existingEquipments]

    for (const item of validRows) {
      try {
        const { payload, companyId, serialNumber, hostname, rowNumber } = item

        // Regra de duplicidade: mesmo serial OU mesmo hostname + cliente
        let existingMatch: EquipmentRecord | undefined

        if (serialNumber) {
          const normSerial = normalizeKey(serialNumber)
          existingMatch = currentEquipments.find(
            (e) => e.serial_number && normalizeKey(e.serial_number) === normSerial,
          )
        }

        if (!existingMatch && hostname) {
          const normHost = normalizeKey(hostname)
          existingMatch = currentEquipments.find(
            (e) => e.company === companyId && e.hostname && normalizeKey(e.hostname) === normHost,
          )
        }

        if (existingMatch) {
          if (duplicateMode === 'skip') {
            skippedCount++
            continue
          } else {
            // Atualizar os campos preenchidos
            const updatePayload: Partial<EquipmentRecord> = {}
            for (const [k, v] of Object.entries(payload)) {
              if (v !== undefined && v !== '') {
                ;(updatePayload as any)[k] = v
              }
            }
            const updated = await updateEquipment(existingMatch.id, updatePayload)
            updatedCount++
            // atualiza no cache local
            currentEquipments = currentEquipments.map((e) => (e.id === updated.id ? updated : e))
          }
        } else {
          // Criar novo ativo
          const created = await createEquipment(payload)
          importedCount++
          currentEquipments.push(created)
        }
      } catch (err: any) {
        failedCount++
        const msg = err?.data?.message || err?.message || 'Erro ao gravar registro'
        failureMessages.push(`Linha ${item.rowNumber} (${item.payload.name}): ${msg}`)
      }
    }

    setImportSummary({
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
      errors: failureMessages,
    })

    setImporting(false)
    setStep('result')

    if (onImportComplete) {
      onImportComplete()
    }

    toast({
      title: 'Importação finalizada!',
      description: `${importedCount} novos, ${updatedCount} atualizados, ${skippedCount} pulados, ${failedCount} falhas.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileSpreadsheet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Importação em Massa de Ativos (CMDB)
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos ativos através de planilha Excel (.xlsx) ou CSV, com validação prévia
            de vínculos e tratamento de duplicidade.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-2">
            {/* Bloco 1: Download de modelo */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    1. Baixe o Modelo Oficial de Planilha
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    O modelo já contém todas as colunas suportadas (Nome, Empresa, Hostname, Marca,
                    Modelo, Serial, Filial, Setor, Status de Disponibilidade etc.) e uma linha de
                    exemplo.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 text-xs"
                    onClick={() => handleDownloadTemplate('xlsx')}
                  >
                    Baixar XLSX
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 text-xs"
                    onClick={() => handleDownloadTemplate('csv')}
                  >
                    Baixar CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Bloco 2: Regra de duplicidade */}
            <div className="rounded-xl border p-4 space-y-3 bg-slate-50/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-slate-500" />
                <h4 className="text-sm font-semibold">2. Regra para Ativos Duplicados</h4>
              </div>
              <p className="text-xs text-slate-500">
                A duplicidade é detectada se o <strong>Número de Série</strong> coincidir OU se o
                par <strong>Hostname + Empresa</strong> já existir no CMDB.
              </p>
              <RadioGroup
                value={duplicateMode}
                onValueChange={(v) => setDuplicateMode(v as DuplicateMode)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1"
              >
                <div className="flex items-start space-x-2 rounded-lg border p-3 bg-white dark:bg-slate-950">
                  <RadioGroupItem value="update" id="dup-update" className="mt-0.5" />
                  <Label htmlFor="dup-update" className="text-xs cursor-pointer space-y-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100">
                      Atualizar existentes
                    </span>
                    <span className="text-slate-500 block font-normal">
                      Sobrescreve os campos preenchidos na planilha mantendo o histórico e os IDs
                      existentes.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border p-3 bg-white dark:bg-slate-950">
                  <RadioGroupItem value="skip" id="dup-skip" className="mt-0.5" />
                  <Label htmlFor="dup-skip" className="text-xs cursor-pointer space-y-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100">
                      Pular duplicados
                    </span>
                    <span className="text-slate-500 block font-normal">
                      Ignora qualquer linha que já exista no cadastro sem fazer alterações nela.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Bloco 3: Upload do arquivo */}
            <div className="rounded-xl border-2 border-dashed p-6 text-center space-y-3 bg-white dark:bg-slate-950">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="asset-file-upload"
              />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                {parsing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {parsing
                    ? 'Processando e validando planilha...'
                    : 'Selecione ou arraste sua planilha'}
                </p>
                <p className="text-xs text-slate-500">
                  Formatos aceitos: <strong>.XLSX</strong> ou <strong>.CSV</strong>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
              >
                {parsing ? 'Lendo...' : 'Procurar Arquivo'}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-5 py-2">
            {/* Header com métricas */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 bg-slate-50 dark:bg-slate-900 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                <span className="font-semibold truncate max-w-xs">{fileName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Total de Linhas: <strong>{totalRows}</strong>
                </span>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                  {validRows.length} Válidas
                </Badge>
                {validationErrors.length > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-3 w-3 mr-1 inline" />
                    {validationErrors.length} Erro(s)
                  </Badge>
                )}
                <Badge variant="secondary">
                  Modo: {duplicateMode === 'update' ? 'Atualizar existentes' : 'Pular duplicados'}
                </Badge>
              </div>
            </div>

            {/* Relatório de Erros Pré-Importação */}
            {validationErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-2 dark:border-red-900/50 dark:bg-red-950/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                  Linhas com Inconsistências ({validationErrors.length})
                </div>
                <p className="text-xs text-red-700 dark:text-red-400">
                  As linhas abaixo <strong>não serão importadas silenciosamente</strong>. Você pode
                  prosseguir com as {validRows.length} linhas válidas ou corrigir a planilha e
                  reenviar.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-white dark:bg-slate-950 text-xs">
                  <Table>
                    <TableHeader className="bg-red-100/50 dark:bg-red-950/50">
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead className="w-40">Coluna</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationErrors.map((err, idx) => (
                        <TableRow key={idx} className="hover:bg-red-50/50">
                          <TableCell className="font-mono font-bold text-red-600">
                            {err.rowNumber}
                          </TableCell>
                          <TableCell className="font-medium">{err.column}</TableCell>
                          <TableCell className="text-red-700 dark:text-red-400">
                            {err.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Tabela de Linhas Válidas Prontas */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Linhas Prontas para Importação ({validRows.length})
              </h4>
              {validRows.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center border rounded-lg">
                  Nenhuma linha válida pronta. Corrija a planilha e envie novamente.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-lg border text-xs">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800">
                      <TableRow>
                        <TableHead className="w-14">Linha</TableHead>
                        <TableHead>Nome do Ativo</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Hostname</TableHead>
                        <TableHead>Serial</TableHead>
                        <TableHead>Filial / Setor</TableHead>
                        <TableHead>Disponibilidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 100).map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-slate-500">{r.rowNumber}</TableCell>
                          <TableCell className="font-medium">{r.payload.name}</TableCell>
                          <TableCell>{r.companyName}</TableCell>
                          <TableCell className="font-mono">{r.hostname || '—'}</TableCell>
                          <TableCell className="font-mono">{r.serialNumber || '—'}</TableCell>
                          <TableCell className="text-slate-500">
                            {[r.unitName, r.departmentName].filter(Boolean).join(' • ') || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {r.payload.availability_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 100 && (
                    <p className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900 border-t">
                      Exibindo as primeiras 100 de {validRows.length} linhas válidas.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'result' && importSummary && (
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  Novos Importados
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {importSummary.imported}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-center dark:border-blue-900 dark:bg-blue-950/20">
                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">Atualizados</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                  {importSummary.updated}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Pulados (Duplicados)
                </p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                  {importSummary.skipped}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-center dark:border-red-900 dark:bg-red-950/20">
                <p className="text-xs text-red-800 dark:text-red-300 font-medium">Falhas</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
                  {importSummary.failed}
                </p>
              </div>
            </div>

            {importSummary.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs space-y-1">
                <p className="font-semibold text-red-800">Detalhe das falhas ao salvar:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  {importSummary.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => {
                  setStep('upload')
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              >
                Voltar e Trocar Arquivo
              </Button>
              <Button
                disabled={validRows.length === 0 || importing}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleConfirmImport}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Confirmar Importação (${validRows.length} linhas)`
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
