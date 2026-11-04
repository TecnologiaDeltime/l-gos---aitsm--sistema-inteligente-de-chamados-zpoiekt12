import { useState, useEffect, useRef } from 'react'
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
  Info,
  Users,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  createClientContact,
  updateClientContact,
  type ClientContactRecord,
} from '@/services/client-contacts'
import {
  generateProfessionalXlsxTemplate,
  InstructionItem,
  TemplateColumn,
} from '@/lib/bulk-import-templates'

export interface CollaboratorBulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
  companyId?: string
  companyName?: string
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

interface ValidCollaboratorRow {
  rowNumber: number
  payload: Partial<ClientContactRecord>
  raw: Record<string, string>
  companyId: string
  companyName: string
  unitId?: string
  unitName?: string
  departmentId?: string
  departmentName?: string
  email: string
}

type DuplicateMode = 'update' | 'skip'

const COLUMNS = [
  { key: 'nome', label: 'Nome Completo', required: true, example: 'Carlos Eduardo Oliveira' },
  { key: 'email', label: 'E-mail', required: true, example: 'carlos.oliveira@empresa.com.br' },
  { key: 'empresa', label: 'Empresa / Cliente', required: true, example: 'Empresa Exemplo LTDA' },
  { key: 'cargo', label: 'Cargo / Função', required: false, example: 'Analista Financeiro Sênior' },
  { key: 'telefone', label: 'Telefone / Ramal', required: false, example: '(11) 98765-4321' },
  { key: 'filial', label: 'Filial / Unidade', required: false, example: 'Matriz' },
  { key: 'setor', label: 'Setor da Empresa', required: false, example: 'Financeiro' },
  { key: 'ponto_focal', label: 'Ponto Focal (Sim/Não)', required: false, example: 'Não' },
  {
    key: 'observacoes',
    label: 'Observações',
    required: false,
    example: 'Horário comercial das 08h às 17h',
  },
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

function parseBooleanValue(val: string): boolean {
  const norm = normalizeKey(val)
  return (
    norm === 'sim' ||
    norm === 's' ||
    norm === 'true' ||
    norm === '1' ||
    norm === 'yes' ||
    norm === 'y'
  )
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function CollaboratorBulkImportDialog({
  open,
  onOpenChange,
  clientId,
  companyId: presetCompanyIdProp,
  companyName: presetCompanyName,
  onImportComplete,
}: CollaboratorBulkImportDialogProps) {
  const presetCompanyId = presetCompanyIdProp || clientId
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('update')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const [fileName, setFileName] = useState('')
  const [validationErrors, setValidationErrors] = useState<RowValidationError[]>([])
  const [validRows, setValidRows] = useState<ValidCollaboratorRow[]>([])
  const [totalRows, setTotalRows] = useState(0)

  const [importSummary, setImportSummary] = useState<{
    imported: number
    updated: number
    skipped: number
    failed: number
    errors: string[]
  } | null>(null)

  // Metadados
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [existingContacts, setExistingContacts] = useState<ClientContactRecord[]>([])

  useEffect(() => {
    if (open) {
      setStep('upload')
      setValidationErrors([])
      setValidRows([])
      setTotalRows(0)
      setImportSummary(null)
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      Promise.allSettled([
        pb.collection('companies').getFullList({ sort: 'trade_name,legal_name' }),
        pb.collection('company_units').getFullList({ sort: 'name' }),
        pb.collection('company_departments').getFullList({ sort: 'name' }),
        pb.collection('client_contacts').getFullList<ClientContactRecord>({ sort: '-created' }),
      ]).then(([compRes, unitRes, deptRes, contRes]) => {
        if (compRes.status === 'fulfilled') setCompanies(compRes.value)
        if (unitRes.status === 'fulfilled') setUnits(unitRes.value)
        if (deptRes.status === 'fulfilled') setDepartments(deptRes.value)
        if (contRes.status === 'fulfilled') setExistingContacts(contRes.value)
      })
    }
  }, [open])

  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const exampleCompany =
      presetCompanyName ||
      (presetCompanyId ? companies.find((c) => c.id === presetCompanyId)?.trade_name : null) ||
      companies[0]?.trade_name ||
      'Empresa Exemplo LTDA'

    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      const headers = COLUMNS.map((c) => c.label)
      const exampleRow = COLUMNS.map((c) => (c.key === 'empresa' ? exampleCompany : c.example))
      const instructionsRow = COLUMNS.map((c) => (c.required ? 'Obrigatório' : 'Opcional'))
      const wsData = [headers, instructionsRow, exampleRow]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Colaboradores')
      XLSX.writeFile(wb, `modelo_importacao_colaboradores_${dateStr}.csv`, { bookType: 'csv' })
    } else {
      const exampleRows = [
        {
          nome: 'Carlos Eduardo Oliveira',
          email: 'carlos.oliveira@empresa.com.br',
          empresa: exampleCompany,
          cargo: 'Analista Financeiro Sênior',
          telefone: '(11) 98765-4321',
          filial: 'Matriz',
          setor: 'Financeiro',
          ponto_focal: 'Sim',
          observacoes: 'Horário comercial das 08h às 17h. Ponto focal para aprovação de acessos.',
        },
        {
          nome: 'Mariana Santos Costa',
          email: 'mariana.costa@empresa.com.br',
          empresa: exampleCompany,
          cargo: 'Coordenadora de Recursos Humanos',
          telefone: '(11) 91234-5678',
          filial: 'Matriz',
          setor: 'Recursos Humanos',
          ponto_focal: 'Não',
          observacoes: 'Responsável pela admissão de novos colaboradores',
        },
        {
          nome: 'Rodrigo Albuquerque',
          email: 'rodrigo.albuquerque@empresa.com.br',
          empresa: exampleCompany,
          cargo: 'Gerente de Operações',
          telefone: '(11) 97777-8888',
          filial: 'Matriz',
          setor: 'Operações',
          ponto_focal: 'Sim',
          observacoes: 'Contato para autorização de manutenções fora de expediente',
        },
      ]

      const instructions: InstructionItem[] = [
        {
          campo: 'Nome Completo',
          obrigatorio: 'Sim',
          descricao: 'Nome e sobrenome do colaborador / contato do cliente.',
          exemplo: 'Carlos Eduardo Oliveira',
          valoresAceitos: 'Texto livre (obrigatório)',
        },
        {
          campo: 'E-mail',
          obrigatorio: 'Sim',
          descricao:
            'Endereço de e-mail corporativo válido. Utilizado na checagem de duplicidade e para abertura/acompanhamento de chamados.',
          exemplo: 'carlos.oliveira@empresa.com.br',
          valoresAceitos: 'E-mail em formato válido (nome@dominio.com.br)',
        },
        {
          campo: 'Empresa / Cliente',
          obrigatorio: 'Sim',
          descricao:
            'Nome fantasia ou razão social da empresa contratante. Deve coincidir com uma empresa previamente cadastrada.',
          exemplo: exampleCompany,
          valoresAceitos: 'Deve coincidir com um cliente cadastrado no sistema',
        },
        {
          campo: 'Cargo / Função',
          obrigatorio: 'Não',
          descricao: 'Cargo ou ocupação profissional exercida no cliente.',
          exemplo: 'Analista Financeiro Sênior, Coordenador de TI, Diretor',
          valoresAceitos: 'Texto livre',
        },
        {
          campo: 'Telefone / Ramal',
          obrigatorio: 'Não',
          descricao: 'Telefone fixo, celular corporativo ou ramal de contato.',
          exemplo: '(11) 98765-4321 ou Ramal 2045',
          valoresAceitos: 'Texto livre / números',
        },
        {
          campo: 'Filial / Unidade',
          obrigatorio: 'Não',
          descricao:
            'Filial ou unidade onde o colaborador atua. Se informada, DEVE existir cadastrada na respectiva empresa cliente.',
          exemplo: 'Matriz, Unidade Alphaville, Filial Rio',
          valoresAceitos: 'Deve coincidir com filial cadastrada do cliente (ou deixe em branco)',
        },
        {
          campo: 'Setor da Empresa',
          obrigatorio: 'Não',
          descricao:
            'Setor ou departamento do colaborador. Se informado, DEVE existir cadastrado na respectiva empresa cliente.',
          exemplo: 'Financeiro, Recursos Humanos, Tecnologia, Vendas',
          valoresAceitos: 'Deve coincidir com setor cadastrado do cliente (ou deixe em branco)',
        },
        {
          campo: 'Ponto Focal (Sim/Não)',
          obrigatorio: 'Não',
          descricao:
            'Indica se este contato tem perfil de interlocutor/ponto focal para aprovações e relatórios executivos.',
          exemplo: 'Sim ou Não',
          valoresAceitos: 'Sim, Não (ou S / N / 1 / 0 / True / False)',
        },
        {
          campo: 'Observações',
          obrigatorio: 'Não',
          descricao: 'Informações adicionais de atendimento, horários ou particularidades.',
          exemplo: 'Horário das 08h às 17h. Ponto focal prioritário.',
          valoresAceitos: 'Texto livre',
        },
      ]

      const templateCols: TemplateColumn[] = COLUMNS.map((c) => ({
        key: c.key,
        label: c.label,
        required: c.required,
        example: c.key === 'empresa' ? exampleCompany : c.example,
      }))

      generateProfessionalXlsxTemplate({
        filename: `modelo_importacao_colaboradores_${dateStr}.xlsx`,
        sheetName: 'Colaboradores',
        columns: templateCols,
        exampleRows,
        instructionsTitle: 'Importação em Massa de Colaboradores',
        instructions,
        extraNotes: [
          '5. O arquivo possui duas abas: "Colaboradores" para os dados e "Instruções e Valores" como guia de preenchimento.',
          '6. O tratamento de duplicados verifica o endereço de e-mail (case-insensitive). Se já existir, você escolhe se deseja atualizar ou pular no diálogo de importação.',
        ],
      })
    }

    toast({
      title: 'Modelo XLSX baixado com sucesso!',
      description:
        'O arquivo contém colunas formatadas, exemplos claros e aba de instruções de preenchimento.',
    })
  }

  const findValue = (data: Record<string, string>, aliases: string[]): string => {
    for (const [k, v] of Object.entries(data)) {
      const norm = normalizeKey(k)
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        if (v) return v
      }
    }
    return ''
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

      // Encontra linha de cabeçalho
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
              k.includes('email') ||
              k.includes('colaborador') ||
              k.includes('cargo') ||
              k.includes('empresa'),
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

        // Ignora linha de instrução
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
        throw new Error('Nenhuma linha de colaborador encontrada após o cabeçalho.')
      }

      validateRows(dataRows)
      setStep('preview')
    } catch (err: any) {
      console.error('Erro ao ler planilha de colaboradores:', err)
      toast({
        title: 'Erro ao processar planilha',
        description: err?.message || 'Verifique o formato do arquivo e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setParsing(false)
    }
  }

  const validateRows = (rows: RawRow[]) => {
    const errors: RowValidationError[] = []
    const valid: ValidCollaboratorRow[] = []

    rows.forEach((row) => {
      const { rowNumber, data } = row

      const nome = findValue(data, ['nome', 'nome_completo', 'colaborador', 'contato', 'name'])
      const email = findValue(data, ['email', 'e_mail', 'correio_eletronico', 'mail'])
      const empresaInput = findValue(data, ['empresa', 'cliente', 'empresa_cliente', 'company'])
      const cargo = findValue(data, ['cargo', 'funcao', 'position', 'role', 'ocupacao'])
      const telefone = findValue(data, ['telefone', 'fone', 'celular', 'phone', 'ramal'])
      const filial = findValue(data, ['filial', 'unidade', 'unit', 'branch'])
      const setor = findValue(data, ['setor', 'departamento', 'department'])
      const pontoFocalRaw = findValue(data, [
        'ponto_focal',
        'focal_point',
        'is_focal_point',
        'focal',
      ])
      const observacoes = findValue(data, ['observacoes', 'obs', 'notes', 'notas'])

      let hasRowError = false

      // 1. Nome obrigatório
      if (!nome) {
        errors.push({
          rowNumber,
          column: 'Nome Completo',
          reason: 'Campo obrigatório em branco.',
        })
        hasRowError = true
      }

      // 2. E-mail obrigatório e formato válido
      if (!email) {
        errors.push({
          rowNumber,
          column: 'E-mail',
          reason: 'Campo obrigatório em branco.',
        })
        hasRowError = true
      } else if (!isValidEmail(email)) {
        errors.push({
          rowNumber,
          column: 'E-mail',
          reason: `Formato de e-mail inválido: "${email}".`,
        })
        hasRowError = true
      }

      // 3. Empresa/Cliente
      let matchedCompany: any = null
      const targetCompanyInput =
        empresaInput ||
        (presetCompanyId ? companies.find((c) => c.id === presetCompanyId)?.trade_name : '')

      if (!targetCompanyInput && !presetCompanyId) {
        errors.push({
          rowNumber,
          column: 'Empresa / Cliente',
          reason: 'Campo obrigatório em branco.',
        })
        hasRowError = true
      } else {
        if (presetCompanyId && (!empresaInput || empresaInput === presetCompanyId)) {
          matchedCompany = companies.find((c) => c.id === presetCompanyId)
        } else if (empresaInput) {
          const normEmp = normalizeKey(empresaInput)
          matchedCompany = companies.find((c) => {
            const normTrade = normalizeKey(c.trade_name || '')
            const normLegal = normalizeKey(c.legal_name || '')
            const normCode = normalizeKey(c.code || '')
            return (
              normTrade === normEmp ||
              normLegal === normEmp ||
              normCode === normEmp ||
              c.id === empresaInput
            )
          })
        }

        if (!matchedCompany) {
          errors.push({
            rowNumber,
            column: 'Empresa / Cliente',
            reason: `Empresa "${empresaInput}" não encontrada no cadastro de clientes.`,
          })
          hasRowError = true
        }
      }

      // 4. Filial opcional - se informada, deve existir vinculada
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

      // 5. Setor opcional - se informado, deve existir vinculado
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
            column: 'Setor da Empresa',
            reason: `Setor "${setor}" não encontrado para o cliente "${matchedCompany.trade_name || matchedCompany.legal_name}".`,
          })
          hasRowError = true
        }
      }

      if (!hasRowError && matchedCompany) {
        const isFocal = pontoFocalRaw ? parseBooleanValue(pontoFocalRaw) : false

        const payload: Partial<ClientContactRecord> = {
          full_name: nome,
          email: email.toLowerCase().trim(),
          client: matchedCompany.id,
          unit: matchedUnit?.id || undefined,
          departments: matchedDepartment?.id ? [matchedDepartment.id] : undefined,
          phone: telefone || undefined,
          is_focal_point: isFocal,
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
          email: email.toLowerCase().trim(),
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

    let currentContacts = [...existingContacts]

    for (const item of validRows) {
      try {
        const { payload, email } = item

        // Tratamento de duplicados por e-mail (case-insensitive)
        const normEmail = email.toLowerCase().trim()
        const existingMatch = currentContacts.find(
          (c) => c.email && c.email.toLowerCase().trim() === normEmail,
        )

        if (existingMatch) {
          if (duplicateMode === 'skip') {
            skippedCount++
            continue
          } else {
            // Atualizar os campos preenchidos
            const updatePayload: Partial<ClientContactRecord> = {}
            for (const [k, v] of Object.entries(payload)) {
              if (v !== undefined && v !== '') {
                ;(updatePayload as any)[k] = v
              }
            }
            // Garantir vínculo com o cliente atual
            if (!updatePayload.client && payload.client) {
              updatePayload.client = payload.client
            }
            const updated = await updateClientContact(existingMatch.id, updatePayload)
            updatedCount++
            currentContacts = currentContacts.map((c) => (c.id === updated.id ? updated : c))
          }
        } else {
          const created = await createClientContact(payload)
          importedCount++
          currentContacts.push(created)
        }
      } catch (err: any) {
        failedCount++
        const msg = err?.data?.message || err?.message || 'Erro ao gravar registro'
        failureMessages.push(`Linha ${item.rowNumber} (${item.payload.full_name}): ${msg}`)
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
      title: 'Importação de colaboradores finalizada!',
      description: `${importedCount} novos, ${updatedCount} atualizados, ${skippedCount} pulados, ${failedCount} falhas.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Importação em Massa de Colaboradores
          </DialogTitle>
          <DialogDescription>
            Importe colaboradores de clientes via planilha Excel (.xlsx) ou CSV, com casamento de
            empresa/filial/setor e tratamento de duplicidade por e-mail.
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
                    1. Baixe o Modelo Oficial de Colaboradores
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    O modelo inclui as colunas Nome, E-mail, Empresa, Cargo, Telefone, Filial, Setor
                    e Ponto Focal (Sim/Não).
                    {presetCompanyName && (
                      <span className="block mt-1 font-medium text-amber-900 dark:text-amber-100">
                        Contexto atual: <strong>{presetCompanyName}</strong>
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm"
                    onClick={() => handleDownloadTemplate('xlsx')}
                  >
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                    Baixar Modelo XLSX
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 text-xs"
                    onClick={() => handleDownloadTemplate('csv')}
                    title="Baixar em formato CSV caso prefira editar em modo texto"
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
                <h4 className="text-sm font-semibold">2. Tratamento de Duplicados por E-mail</h4>
              </div>
              <p className="text-xs text-slate-500">
                Se já existir um colaborador cadastrado com o mesmo endereço de e-mail:
              </p>
              <RadioGroup
                value={duplicateMode}
                onValueChange={(v) => setDuplicateMode(v as DuplicateMode)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1"
              >
                <div className="flex items-start space-x-2 rounded-lg border p-3 bg-white dark:bg-slate-950">
                  <RadioGroupItem value="update" id="collab-dup-update" className="mt-0.5" />
                  <Label htmlFor="collab-dup-update" className="text-xs cursor-pointer space-y-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100">
                      Atualizar existentes
                    </span>
                    <span className="text-slate-500 block font-normal">
                      Atualiza cargo, telefone, filial, setor e ponto focal do colaborador
                      correspondente.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border p-3 bg-white dark:bg-slate-950">
                  <RadioGroupItem value="skip" id="collab-dup-skip" className="mt-0.5" />
                  <Label htmlFor="collab-dup-skip" className="text-xs cursor-pointer space-y-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100">
                      Pular duplicados
                    </span>
                    <span className="text-slate-500 block font-normal">
                      Mantém o colaborador existente intocado e não cria duplicatas.
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
                id="collaborator-file-upload"
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
                    : 'Selecione sua planilha de colaboradores'}
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
                  prosseguir com as {validRows.length} válidas ou reenviar a planilha corrigida.
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

            {/* Linhas Válidas Prontas */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Colaboradores Prontos para Importação ({validRows.length})
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
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Filial / Setor</TableHead>
                        <TableHead>Ponto Focal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 100).map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-slate-500">{r.rowNumber}</TableCell>
                          <TableCell className="font-medium">{r.payload.full_name}</TableCell>
                          <TableCell className="font-mono">{r.email}</TableCell>
                          <TableCell>{r.companyName}</TableCell>
                          <TableCell>{r.raw?.cargo || '—'}</TableCell>
                          <TableCell className="text-slate-500">
                            {[r.unitName, r.departmentName].filter(Boolean).join(' • ') || '—'}
                          </TableCell>
                          <TableCell>
                            {r.payload.is_focal_point ? (
                              <Badge className="bg-amber-500 text-white text-[10px]">Sim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Não
                              </Badge>
                            )}
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
                  `Confirmar Importação (${validRows.length} colaboradores)`
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
