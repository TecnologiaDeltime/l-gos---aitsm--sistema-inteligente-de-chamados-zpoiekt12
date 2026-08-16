import { useState, useMemo } from 'react'
import { FileDown, Table2, Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/hooks/use-permissions'
import { Navigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import { getAllEmailDomains } from '@/services/client-email-domains'
import { CONTRACT_HOURS_LEVELS, type CustomAgreementEntry } from '@/services/contracts'

// Campos estáticos do relatório. Campos de acordos personalizados usam o
// prefixo `custom:` + slug e são gerados dinamicamente a partir dos acordos
// cadastrados nos contratos.
type FieldKey = string

const STATIC_FIELD_KEYS = [
  'legal_name',
  'trade_name',
  'document',
  'site',
  'phone',
  'email',
  'address_zipcode',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
  'unit_name',
  'unit_address',
  'unit_phone',
  'unit_manager',
  'department_name',
  'department_parent',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_department',
  'contact_unit',
  'focal_name',
  'focal_email',
  'focal_phone',
  'focal_unit',
  'email_domain',
  'email_domain_active',
  'contract_monthly_hours',
  'contract_period',
  'contract_type',
  ...CONTRACT_HOURS_LEVELS.map((l) => `contract_${l.key}`),
] as const

// Auxilia para identificar um campo de acordo personalizado (custom:<slug>).
const customFieldKey = (slug: string) => `custom:${slug}`
const isCustomFieldKey = (k: string) => k.startsWith('custom:')
const customSlugFromKey = (k: string) => k.slice('custom:'.length)

interface FieldGroup {
  title: string
  fields: { key: FieldKey; label: string }[]
}

const STATIC_FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Dados Básicos',
    fields: [
      { key: 'legal_name', label: 'Razão Social' },
      { key: 'trade_name', label: 'Nome Fantasia' },
      { key: 'document', label: 'CNPJ' },
      { key: 'site', label: 'Site' },
      { key: 'phone', label: 'Telefone' },
      { key: 'email', label: 'E-mail' },
    ],
  },
  {
    title: 'Endereço',
    fields: [
      { key: 'address_zipcode', label: 'CEP' },
      { key: 'address_street', label: 'Logradouro' },
      { key: 'address_number', label: 'Número' },
      { key: 'address_complement', label: 'Complemento' },
      { key: 'address_neighborhood', label: 'Bairro' },
      { key: 'address_city', label: 'Cidade' },
      { key: 'address_state', label: 'Estado' },
    ],
  },
  {
    title: 'Filiais',
    fields: [
      { key: 'unit_name', label: 'Nome da Filial' },
      { key: 'unit_address', label: 'Endereço da Filial' },
      { key: 'unit_phone', label: 'Telefone da Filial' },
      { key: 'unit_manager', label: 'Responsável' },
    ],
  },
  {
    title: 'Setores',
    fields: [
      { key: 'department_name', label: 'Nome do Setor' },
      { key: 'department_parent', label: 'Setor Pai' },
    ],
  },
  {
    title: 'Colaboradores',
    fields: [
      { key: 'contact_name', label: 'Nome' },
      { key: 'contact_email', label: 'E-mail' },
      { key: 'contact_phone', label: 'Telefone' },
      { key: 'contact_department', label: 'Setor' },
      { key: 'contact_unit', label: 'Filial' },
    ],
  },
  {
    title: 'Pontos Focais',
    fields: [
      { key: 'focal_name', label: 'Nome' },
      { key: 'focal_email', label: 'E-mail' },
      { key: 'focal_phone', label: 'Telefone' },
      { key: 'focal_unit', label: 'Filial' },
    ],
  },
  {
    title: 'Domínios de E-mail',
    fields: [
      { key: 'email_domain', label: 'Domínio' },
      { key: 'email_domain_active', label: 'Status (Ativo/Inativo)' },
    ],
  },
  {
    title: 'Contrato',
    fields: [
      { key: 'contract_monthly_hours', label: 'Horas Mensais' },
      { key: 'contract_period', label: 'Vigência do Contrato' },
      { key: 'contract_type', label: 'Tipo de Contrato' },
    ],
  },
  {
    title: 'Distribuição de Horas',
    fields: [
      { key: 'contract_hours_level1', label: 'Horas Nível 1' },
      { key: 'contract_hours_level2', label: 'Horas Nível 2' },
      { key: 'contract_hours_level3', label: 'Horas Nível 3' },
      { key: 'contract_hours_consultoria', label: 'Horas Consultoria' },
      { key: 'contract_hours_backoffice', label: 'Horas Backoffice' },
      { key: 'contract_hours_administrativo', label: 'Horas Administrativo' },
    ],
  },
]

// Campos que expandem em múltiplas linhas por empresa (relações 1:N)
const RELATIONAL_FIELDS: FieldKey[] = [
  'unit_name',
  'unit_address',
  'unit_phone',
  'unit_manager',
  'department_name',
  'department_parent',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_department',
  'contact_unit',
  'focal_name',
  'focal_email',
  'focal_phone',
  'focal_unit',
  'email_domain',
  'email_domain_active',
  'contract_monthly_hours',
  'contract_period',
  'contract_type',
  ...CONTRACT_HOURS_LEVELS.map((l) => `contract_${l.key}`),
]

const ALL_FIELD_LABELS: Record<string, string> = STATIC_FIELD_GROUPS.reduce(
  (acc, g) => {
    g.fields.forEach((f) => {
      acc[f.key] = f.label
    })
    return acc
  },
  {} as Record<string, string>,
)

interface ContractInfo {
  monthly_hours?: number | null
  start_date?: string
  end_date?: string
  type?: string
  hours_level1?: number | null
  hours_level2?: number | null
  hours_level3?: number | null
  hours_consultoria?: number | null
  hours_backoffice?: number | null
  hours_administrativo?: number | null
  custom_agreements?: CustomAgreementEntry[] | null
}

interface CompanyContext {
  company: CompanyRecord
  units: CompanyUnitRecord[]
  contacts: ClientContactRecord[]
  focalPoints: ClientContactRecord[]
  departments: { id: string; name: string; parent?: string }[]
  parentDepartments: Record<string, string>
  emailDomains: { domain: string; active: boolean }[]
  contracts: ContractInfo[]
}

// Acordos personalizados consolidados a partir de todos os contratos
// (slug -> nome de exibição). Usado para gerar os campos dinâmicos do relatório.
type CustomAgreementsMap = Record<string, string>

export default function ClientExtractionPage() {
  const permissions = usePermissions()
  const [selected, setSelected] = useState<Set<FieldKey>>(
    new Set<FieldKey>(['legal_name', 'trade_name', 'document', 'site', 'phone', 'email']),
  )
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [columns, setColumns] = useState<FieldKey[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)
  // Acordos personalizados consolidados de todos os contratos (slug -> nome).
  const [customAgreementsMap, setCustomAgreementsMap] = useState<CustomAgreementsMap>({})

  // Lista de grupos dinâmica = grupos estáticos + grupo de acordos personalizados (se houver).
  const fieldGroups: FieldGroup[] = useMemo(() => {
    const customFields = Object.entries(customAgreementsMap).map(([slug, name]) => ({
      key: customFieldKey(slug) as FieldKey,
      label: `Horas ${name || slug}`,
    }))
    if (customFields.length === 0) return STATIC_FIELD_GROUPS
    const customGroup: FieldGroup = {
      title: 'Acordos de Atendimento Personalizados',
      fields: customFields,
    }
    // Insere o grupo de acordos personalizados logo após "Distribuição de Horas".
    const result = [...STATIC_FIELD_GROUPS]
    const distIdx = result.findIndex((g) => g.title === 'Distribuição de Horas')
    if (distIdx >= 0) {
      result.splice(distIdx + 1, 0, customGroup)
    } else {
      result.push(customGroup)
    }
    return result
  }, [customAgreementsMap])

  const toggleField = (key: FieldKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleGroup = (group: FieldGroup) => {
    setSelected((prev) => {
      const allSelected = group.fields.every((f) => prev.has(f.key))
      const next = new Set(prev)
      if (allSelected) {
        group.fields.forEach((f) => next.delete(f.key))
      } else {
        group.fields.forEach((f) => next.add(f.key))
      }
      return next
    })
  }

  const orderedSelected = useMemo(
    () =>
      fieldGroups
        .flatMap((g) => g.fields)
        .filter((f) => selected.has(f.key))
        .map((f) => f.key),
    [fieldGroups, selected],
  )

  const buildRows = (ctx: CompanyContext, cols: FieldKey[]): Record<string, string>[] => {
    const out: Record<string, string>[] = []
    const companyRow = (): Record<string, string> => {
      const r: Record<string, string> = {}
      cols.forEach((c) => {
        switch (c) {
          case 'legal_name':
            r[c] = ctx.company.legal_name || ''
            break
          case 'trade_name':
            r[c] = ctx.company.trade_name || ''
            break
          case 'document':
            r[c] = ctx.company.document || ''
            break
          case 'site':
            r[c] = ctx.company.site || ''
            break
          case 'phone':
            r[c] = ctx.company.phone || ''
            break
          case 'email':
            r[c] = ctx.company.email || ''
            break
          case 'address_zipcode':
            r[c] = ctx.company.address_zipcode || ''
            break
          case 'address_street':
            r[c] = ctx.company.address_street || ''
            break
          case 'address_number':
            r[c] = ctx.company.address_number || ''
            break
          case 'address_complement':
            r[c] = ctx.company.address_complement || ''
            break
          case 'address_neighborhood':
            r[c] = ctx.company.address_neighborhood || ''
            break
          case 'address_city':
            r[c] = ctx.company.address_city || ''
            break
          case 'address_state':
            r[c] = ctx.company.address_state || ''
            break
          default:
            r[c] = ''
        }
      })
      return r
    }

    const needsUnit = cols.some((c) =>
      ['unit_name', 'unit_address', 'unit_phone', 'unit_manager'].includes(c),
    )
    const needsDepartment = cols.some((c) => ['department_name', 'department_parent'].includes(c))
    const needsContact = cols.some((c) =>
      [
        'contact_name',
        'contact_email',
        'contact_phone',
        'contact_department',
        'contact_unit',
      ].includes(c),
    )
    const needsFocal = cols.some((c) =>
      ['focal_name', 'focal_email', 'focal_phone', 'focal_unit'].includes(c),
    )
    const needsDomain = cols.some((c) => ['email_domain', 'email_domain_active'].includes(c))
    const needsContract = cols.some(
      (c) =>
        [
          'contract_monthly_hours',
          'contract_period',
          'contract_type',
          'contract_hours_level1',
          'contract_hours_level2',
          'contract_hours_level3',
          'contract_hours_consultoria',
          'contract_hours_backoffice',
          'contract_hours_administrativo',
        ].includes(c) || isCustomFieldKey(c),
    )

    const hasRelational = cols.some((c) => RELATIONAL_FIELDS.includes(c) || isCustomFieldKey(c))

    if (!hasRelational) {
      out.push(companyRow())
      return out
    }

    // Quantidade de linhas a gerar = maior conjunto de relações selecionadas
    const collections: Record<string, string>[][] = []
    if (needsUnit) {
      const rows = ctx.units.map((u) => {
        const r: Record<string, string> = {}
        const addrParts = [
          u.address_street,
          u.address_number,
          u.address_neighborhood,
          u.address_city,
          u.address_state,
        ].filter(Boolean)
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'unit_name':
              r[c] = u.name || ''
              break
            case 'unit_address':
              r[c] = addrParts.join(', ')
              break
            case 'unit_phone':
              r[c] = u.phone || ''
              break
            case 'unit_manager':
              r[c] = u.manager_name || ''
              break
          }
        })
        return r
      })
      collections.push(rows)
    }
    if (needsDepartment) {
      const rows = ctx.departments.map((d) => {
        const r: Record<string, string> = {}
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'department_name':
              r[c] = d.name || ''
              break
            case 'department_parent':
              r[c] = d.parent ? ctx.parentDepartments[d.parent] || '' : ''
              break
          }
        })
        return r
      })
      collections.push(rows)
    }
    if (needsContact) {
      const rows = ctx.contacts.map((ct) => {
        const r: Record<string, string> = {}
        const deptNames = (ct.departments || [])
          .map(
            (id) =>
              ctx.parentDepartments[id] || ctx.departments.find((d) => d.id === id)?.name || '',
          )
          .filter(Boolean)
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'contact_name':
              r[c] = ct.full_name || ''
              break
            case 'contact_email':
              r[c] = ct.email || ''
              break
            case 'contact_phone':
              r[c] = ct.phone || ct.cell_phone || ''
              break
            case 'contact_department':
              r[c] = deptNames.join('; ')
              break
            case 'contact_unit':
              r[c] = ct.expand?.unit?.name || ''
              break
          }
        })
        return r
      })
      collections.push(rows)
    }
    if (needsFocal) {
      const rows = ctx.focalPoints.map((ct) => {
        const r: Record<string, string> = {}
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'focal_name':
              r[c] = ct.full_name || ''
              break
            case 'focal_email':
              r[c] = ct.email || ''
              break
            case 'focal_phone':
              r[c] = ct.phone || ct.cell_phone || ''
              break
            case 'focal_unit':
              r[c] = ct.expand?.unit?.name || ''
              break
          }
        })
        return r
      })
      collections.push(rows)
    }
    if (needsDomain) {
      const rows = ctx.emailDomains.map((d) => {
        const r: Record<string, string> = {}
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'email_domain':
              r[c] = d.domain || ''
              break
            case 'email_domain_active':
              r[c] = d.active ? 'Ativo' : 'Inativo'
              break
          }
        })
        return r
      })
      collections.push(rows)
    }
    if (needsContract) {
      const rows = ctx.contracts.map((contract) => {
        const r: Record<string, string> = {}
        const start = contract.start_date ? contract.start_date.slice(0, 10) : ''
        const end = contract.end_date ? contract.end_date.slice(0, 10) : ''
        let period = ''
        if (start && end) period = `${start} a ${end}`
        else if (start) period = `desde ${start}`
        else if (end) period = `até ${end}`
        ;(cols as FieldKey[]).forEach((c) => {
          switch (c) {
            case 'contract_monthly_hours':
              r[c] = contract.monthly_hours != null ? String(contract.monthly_hours) : ''
              break
            case 'contract_period':
              r[c] = period
              break
            case 'contract_type':
              r[c] = contract.type || ''
              break
            case 'contract_hours_level1':
              r[c] = contract.hours_level1 != null ? String(contract.hours_level1) : ''
              break
            case 'contract_hours_level2':
              r[c] = contract.hours_level2 != null ? String(contract.hours_level2) : ''
              break
            case 'contract_hours_level3':
              r[c] = contract.hours_level3 != null ? String(contract.hours_level3) : ''
              break
            case 'contract_hours_consultoria':
              r[c] = contract.hours_consultoria != null ? String(contract.hours_consultoria) : ''
              break
            case 'contract_hours_backoffice':
              r[c] = contract.hours_backoffice != null ? String(contract.hours_backoffice) : ''
              break
            case 'contract_hours_administrativo':
              r[c] =
                contract.hours_administrativo != null ? String(contract.hours_administrativo) : ''
              break
            default:
              if (isCustomFieldKey(c)) {
                const slug = customSlugFromKey(c)
                const ag = (contract.custom_agreements || []).find(
                  (a) => a.slug === slug && a.active,
                )
                r[c] = ag && ag.hours != null ? String(ag.hours) : ''
              }
              break
          }
        })
        return r
      })
      collections.push(rows)
    }

    // máxima quantidade de linhas entre as coleções (mínimo 1 para mostrar a empresa)
    const maxLen = Math.max(1, ...collections.map((c) => c.length))
    for (let i = 0; i < maxLen; i++) {
      const base = companyRow()
      collections.forEach((coll) => {
        const item = coll[i]
        if (item) {
          Object.keys(item).forEach((k) => {
            if (item[k]) base[k] = item[k]
          })
        }
      })
      out.push(base)
    }
    return out
  }

  const generateReport = async () => {
    if (selected.size === 0) {
      setRows([])
      setColumns([])
      setHasGenerated(true)
      return
    }
    setLoading(true)
    try {
      const cols = orderedSelected
      const companies = await getCompanies()
      const allDomains = await getAllEmailDomains()

      // Carrega todos os contratos uma única vez para consolidar os acordos
      // personalizados disponíveis como campos do relatório.
      const allContracts = await pb
        .collection('contracts')
        .getFullList<ContractInfo>({ sort: '-created' })
        .catch(() => [] as ContractInfo[])
      const agreementsMap: CustomAgreementsMap = {}
      allContracts.forEach((contract) => {
        ;(contract.custom_agreements || []).forEach((ag) => {
          if (ag.slug) {
            // Mantém o nome mais recente não-vazio já cadastrado para o slug.
            if (!agreementsMap[ag.slug] || ag.name) {
              agreementsMap[ag.slug] = ag.name || agreementsMap[ag.slug] || ag.slug
            }
          }
        })
      })
      setCustomAgreementsMap(agreementsMap)

      const allRows: Record<string, string>[] = []
      for (const company of companies) {
        const [units, contacts, departments] = await Promise.all([
          getCompanyUnitsByCompany(company.id).catch(() => [] as CompanyUnitRecord[]),
          getClientContacts(company.id).catch(() => [] as ClientContactRecord[]),
          pb
            .collection('company_departments')
            .getFullList<{ id: string; name: string; parent?: string }>({
              filter: `company = "${company.id}"`,
              sort: 'name',
            })
            .catch(() => [] as { id: string; name: string; parent?: string }[]),
        ])

        const parentIds = Array.from(
          new Set(departments.map((d) => d.parent).filter(Boolean) as string[]),
        )
        const parentMap: Record<string, string> = {}
        for (const pid of parentIds) {
          try {
            const parent = await pb
              .collection('company_departments')
              .getOne<{ id: string; name: string }>(pid)
            parentMap[pid] = parent.name
          } catch {
            parentMap[pid] = ''
          }
        }
        departments.forEach((d) => {
          parentMap[d.id] = d.name
        })

        const ctx: CompanyContext = {
          company,
          units,
          contacts,
          focalPoints: contacts.filter((c) => c.is_focal_point),
          departments,
          parentDepartments: parentMap,
          emailDomains: allDomains
            .filter((d) => d.client === company.id)
            .map((d) => ({ domain: d.domain, active: d.active })),
          contracts: await pb
            .collection('contracts')
            .getFullList<ContractInfo>({
              filter: `company = "${company.id}"`,
              sort: '-created',
            })
            .catch(() => [] as ContractInfo[]),
        }
        allRows.push(...buildRows(ctx, cols))
      }
      setColumns(cols)
      setRows(allRows)
      setHasGenerated(true)
    } catch (err) {
      console.error(err)
      setRows([])
      setColumns([])
      setHasGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (columns.length === 0 || rows.length === 0) return
    const header = columns
      .map((c) => `"${(ALL_FIELD_LABELS[c] || c).replace(/"/g, '""')}"`)
      .join(';')
    const body = rows
      .map((r) => columns.map((c) => `"${(r[c] ?? '').toString().replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const csv = '\uFEFF' + header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `extracao-clientes-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const selectedCount = selected.size

  if (!permissions.canViewReports) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Extração de Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Selecione os campos desejados e gere um relatório de clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={generateReport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Table2 className="mr-2 h-4 w-4" /> Gerar Relatório
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={columns.length === 0 || rows.length === 0 || loading}
          >
            <FileDown className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {fieldGroups.map((group) => {
          const groupSelected = group.fields.filter((f) => selected.has(f.key)).length
          const allSelected = groupSelected === group.fields.length
          return (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{group.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleGroup(group)}
                  >
                    {allSelected ? 'Limpar' : 'Marcar todos'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.fields.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <Checkbox
                      id={field.key}
                      checked={selected.has(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <label htmlFor={field.key} className="text-sm cursor-pointer select-none">
                      {field.label}
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedCount} campo{selectedCount !== 1 ? 's' : ''} selecionado
        {selectedCount !== 1 ? 's' : ''}.
      </p>

      {hasGenerated && selected.size === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum campo selecionado. Marque ao menos um campo para gerar o relatório.
          </CardContent>
        </Card>
      )}

      {hasGenerated && selected.size > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> Resultado ({rows.length} registro
              {rows.length !== 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c}>{ALL_FIELD_LABELS[c] || c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={idx}>
                        {columns.map((c) => (
                          <TableCell key={c} className="text-xs">
                            {row[c] ?? '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
