import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Boxes, ArrowUpDown, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  getConfigurationItems,
  ConfigurationItemRecord,
  CONFIGURATION_ITEM_TYPES,
  CONFIGURATION_ITEM_STATUSES,
} from '@/services/configuration-items'
import { getCompanies } from '@/services/companies'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { ConfigurationItemTypeBadge } from '@/components/ConfigurationItemTypeBadge'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'

export default function ConfigurationItemList() {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const [items, setItems] = useState<ConfigurationItemRecord[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortCol, setSortCol] = useState<'name' | 'type' | 'brand' | 'updated'>('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const loadData = async () => {
    try {
      setLoading(true)
      const [ciData, compData] = await Promise.all([
        getConfigurationItems(),
        getCompanies().catch(() => []),
      ])
      setItems(ciData)
      setCompanies(compData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('configuration_items', () => loadData())

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        if (companyFilter !== 'all' && item.company !== companyFilter) return false
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (search) {
          const s = search.toLowerCase()
          return [
            item.name,
            item.type,
            item.brand,
            item.model,
            item.serial_number,
            item.location,
            item.expand?.company?.trade_name,
          ].some((v) => v?.toLowerCase().includes(s))
        }
        return true
      })
      .sort((a, b) => {
        const av = String(a[sortCol] || '').toLowerCase()
        const bv = String(b[sortCol] || '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
  }, [items, companyFilter, typeFilter, statusFilter, search, sortCol, sortDir])

  const handleSort = (col: 'name' | 'type' | 'brand' | 'updated') => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const canEdit =
    permissions.isAdmin ||
    permissions.isGestor ||
    permissions.isTecnico ||
    permissions.canWriteModule('cmdb')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Itens de Configuração (CMDB)
          </h1>
          <p className="text-xs text-muted-foreground">
            Gerenciamento de infraestrutura: roteadores, switches, servidores, impressoras e outros.
          </p>
        </div>
        {canEdit && (
          <Link to="/cmdb/configuration-items/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Item de Configuração
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, marca, modelo, série, local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name || c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {CONFIGURATION_ITEM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {CONFIGURATION_ITEM_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile view - Cards */}
      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Carregando itens...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum item de configuração encontrado.
          </div>
        ) : (
          filtered.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/cmdb/configuration-items/${item.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-foreground">{item.name}</div>
                  <CiStatusBadge status={item.status} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <ConfigurationItemTypeBadge type={item.type} />
                  {item.brand && (
                    <span className="text-xs text-muted-foreground">
                      {item.brand} {item.model ? `· ${item.model}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {item.expand?.company?.trade_name || '—'}
                  </span>
                  <span>{item.location || 'Sem local'}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop view - Table */}
      <div className="hidden sm:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/50 border-b font-semibold text-foreground">
              <tr>
                <th
                  className="p-3 cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center gap-1">
                    Nome <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </th>
                <th
                  className="p-3 cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('type')}
                >
                  <span className="flex items-center gap-1">
                    Tipo <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </th>
                <th
                  className="p-3 cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('brand')}
                >
                  <span className="flex items-center gap-1">
                    Marca / Modelo <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </th>
                <th className="p-3">Nº Série</th>
                <th className="p-3">Localização</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Status</th>
                <th
                  className="p-3 cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort('updated')}
                >
                  <span className="flex items-center gap-1">
                    Atualizado <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Carregando itens...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Nenhum item de configuração encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/cmdb/configuration-items/${item.id}`)}
                  >
                    <td className="p-3 font-medium text-foreground">{item.name}</td>
                    <td className="p-3">
                      <ConfigurationItemTypeBadge type={item.type} />
                    </td>
                    <td className="p-3">
                      {item.brand ? `${item.brand} ${item.model || ''}`.trim() : item.model || '—'}
                    </td>
                    <td className="p-3 font-mono">{item.serial_number || '—'}</td>
                    <td className="p-3">{item.location || '—'}</td>
                    <td className="p-3">{item.expand?.company?.trade_name || '—'}</td>
                    <td className="p-3">
                      <CiStatusBadge status={item.status} />
                    </td>
                    <td className="p-3">{new Date(item.updated).toLocaleDateString('pt-BR')}</td>
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
