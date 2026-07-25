import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Upload, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getEquipments, EquipmentRecord, CI_STATUSES } from '@/services/equipments'
import { getCompanies } from '@/services/companies'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { useRealtime } from '@/hooks/use-realtime'

export default function CiList() {
  const navigate = useNavigate()
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [manufacturerFilter, setManufacturerFilter] = useState('all')
  const [sortCol, setSortCol] = useState('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const loadData = () => {
    getEquipments()
      .then(setEquipments)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('equipments', () => loadData())

  const types = useMemo(
    () => [...new Set(equipments.map((e) => e.type).filter(Boolean))],
    [equipments],
  )
  const manufacturers = useMemo(
    () => [...new Set(equipments.map((e) => e.manufacturer).filter(Boolean))],
    [equipments],
  )

  const filtered = useMemo(() => {
    return equipments
      .filter((e) => {
        if (companyFilter !== 'all' && e.company !== companyFilter) return false
        if (typeFilter !== 'all' && e.type !== typeFilter) return false
        if (statusFilter !== 'all' && e.status !== statusFilter) return false
        if (manufacturerFilter !== 'all' && e.manufacturer !== manufacturerFilter) return false
        if (search) {
          const s = search.toLowerCase()
          return [e.name, e.serial_number, e.patrimony_number, e.ip_address].some((v) =>
            v?.toLowerCase().includes(s),
          )
        }
        return true
      })
      .sort((a, b) => {
        const av = String(a[sortCol as keyof EquipmentRecord] || '').toLowerCase()
        const bv = String(b[sortCol as keyof EquipmentRecord] || '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
  }, [
    equipments,
    companyFilter,
    typeFilter,
    statusFilter,
    manufacturerFilter,
    search,
    sortCol,
    sortDir,
  ])

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const cols = [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo' },
    { key: 'manufacturer', label: 'Fabricante' },
    { key: 'model', label: 'Modelo' },
    { key: 'serial_number', label: 'Nº Série' },
    { key: 'patrimony_number', label: 'Patrimônio' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, série, patrimônio, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.trade_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {CI_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Fabricante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Fabr.</SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Link to="/cmdb/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-1.5 h-4 w-4" /> Importar CSV
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className="p-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort(c.key)}
                  >
                    <span className="flex items-center gap-1">
                      {c.label} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                ))}
                <th className="p-3 cursor-pointer" onClick={() => handleSort('status')}>
                  Status
                </th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Unidade</th>
                <th className="p-3 cursor-pointer" onClick={() => handleSort('updated')}>
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    Nenhum ativo encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(`/cmdb/assets/${e.id}`)}
                  >
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{e.name}</td>
                    <td className="p-3">{e.type || '-'}</td>
                    <td className="p-3">{e.manufacturer || '-'}</td>
                    <td className="p-3">{e.model || '-'}</td>
                    <td className="p-3">{e.serial_number || '-'}</td>
                    <td className="p-3">{e.patrimony_number || '-'}</td>
                    <td className="p-3">
                      <CiStatusBadge status={e.status} />
                    </td>
                    <td className="p-3">{e.expand?.company?.trade_name || '-'}</td>
                    <td className="p-3">{e.expand?.unit?.name || '-'}</td>
                    <td className="p-3">{new Date(e.updated).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
