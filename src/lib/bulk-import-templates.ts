import * as XLSX from 'xlsx'

export interface TemplateColumn {
  key: string
  label: string
  required?: boolean
  example?: string
  description?: string
  acceptedValues?: string[]
}

export interface InstructionItem {
  campo: string
  obrigatorio: 'Sim' | 'Não'
  descricao: string
  exemplo: string
  valoresAceitos?: string
}

export interface BuildXlsxTemplateOptions {
  filename: string
  sheetName: string
  columns: TemplateColumn[]
  exampleRows: Record<string, string>[]
  instructionsTitle: string
  instructions: InstructionItem[]
  extraNotes?: string[]
}

/**
 * Gera um arquivo XLSX profissional com duas abas:
 * 1. Aba principal com colunas padronizadas, linha de orientação (Obrigatório/Opcional), linhas de exemplo e larguras formatadas
 * 2. Aba "Instruções e Valores Aceitos" explicando regras de preenchimento e listas de opções permitidas
 */
export function generateProfessionalXlsxTemplate(options: BuildXlsxTemplateOptions): void {
  const {
    filename,
    sheetName,
    columns,
    exampleRows,
    instructionsTitle,
    instructions,
    extraNotes = [],
  } = options

  const wb = XLSX.utils.book_new()

  // ─────────────────────────────────────────────────────────────
  // 1. Aba Principal (Dados)
  // ─────────────────────────────────────────────────────────────
  const headerLabels = columns.map((c) => c.label)
  const reqLabels = columns.map((c) => (c.required ? 'Obrigatório' : 'Opcional'))

  const dataMatrix: (string | number)[][] = [headerLabels, reqLabels]

  for (const row of exampleRows) {
    const rowValues = columns.map((c) => row[c.key] ?? '')
    dataMatrix.push(rowValues)
  }

  const wsData = XLSX.utils.aoa_to_sheet(dataMatrix)

  // Configura larguras de coluna com folga legível
  wsData['!cols'] = columns.map((c) => {
    const maxValLen = Math.max(c.label.length, c.example ? String(c.example).length : 0, 14)
    return { wch: Math.min(Math.max(maxValLen + 4, 18), 45) }
  })

  // Congelar a linha de cabeçalho (linha 1 e linha 2 de orientação)
  wsData['!freeze'] = { xSplit: 0, ySplit: 2 }

  XLSX.utils.book_append_sheet(wb, wsData, sheetName.slice(0, 31))

  // ─────────────────────────────────────────────────────────────
  // 2. Aba de Instruções e Valores Aceitos
  // ─────────────────────────────────────────────────────────────
  const instructionsMatrix: (string | number)[][] = [
    [`LÓGOS AITSM - GUIA DE PREENCHIMENTO: ${instructionsTitle.toUpperCase()}`],
    ['Orientações gerais para importação em massa sem inconsistências:'],
    ['1. Não altere o nome ou a ordem das colunas da aba de dados.'],
    [
      '2. Linhas de instrução na segunda linha (Obrigatório / Opcional) são detectadas e ignoradas automaticamente pelo importador.',
    ],
    ['3. Você pode apagar as linhas de exemplo ou substituí-las pelos seus registros reais.'],
    ['4. Campos de Empresa, Filial e Setor são casados com cadastros existentes no Lógos AITSM.'],
  ]

  if (extraNotes.length > 0) {
    for (const note of extraNotes) {
      instructionsMatrix.push([note])
    }
  }

  instructionsMatrix.push([]) // Linha em branco
  instructionsMatrix.push([
    'Campo / Coluna',
    'Obrigatório?',
    'Descrição e Regras',
    'Exemplo de Preenchimento',
    'Valores Aceitos / Opções',
  ])

  for (const inst of instructions) {
    instructionsMatrix.push([
      inst.campo,
      inst.obrigatorio,
      inst.descricao,
      inst.exemplo,
      inst.valoresAceitos || 'Texto livre',
    ])
  }

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsMatrix)

  wsInstructions['!cols'] = [
    { wch: 28 }, // Campo
    { wch: 14 }, // Obrigatório
    { wch: 48 }, // Descrição
    { wch: 32 }, // Exemplo
    { wch: 50 }, // Valores Aceitos
  ]

  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções e Valores')

  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, finalName)
}
