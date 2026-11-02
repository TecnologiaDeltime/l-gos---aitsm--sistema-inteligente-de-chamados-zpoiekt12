import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Upload, ArrowUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getEquipments,
  EquipmentRecord,
  CI_STATUSES,
  AVAILABILITY_STATUSES,
  DEVICE_TYPES,
} from '@/services/equipments'
import { getCompanies } from '@/services/companies'
import { getTickets } from '@/services/tickets'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { AvailabilityStatusBadge } from '@/components/AvailabilityStatusBadge'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { deleteEquipment, updateEquipment } from '@/services/equipments'
import { createAssetAutomationLog } from '@/services/asset-automation-logs'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'

export default function CiList() {
  const navigate = useNavigate()
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [manufacturerFilter, setManufacturerFilter] = useState('all')
  const [hostnameFilter, setHostnameFilter] = useState('all')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sortCol, setSortCol] = useState('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { canDelete } = usePermissions()
  const canDeleteEquipment = canDelete('cmdb_assets') || canDelete('cmdb')
  const { toast } = useToast()

  const [deleteTarget, setDeleteTarget] = useState<EquipmentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = () => {
    getEquipments()
      .then(setEquipments)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getTickets()
      .then((tkts) => {
        const counts: Record<string, number> = {}
        tkts.forEach((t) => {
          if (t.equipment) counts[t.equipment] = (counts[t.equipment] || 0) + 1
        })
        setTicketCounts(counts)
      })
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
  const hostnames = useMemo(
    () => [...new Set(equipments.map((e) => e.hostname).filter(Boolean))],
    [equipments],
  )
  const owners = useMemo(
    () => [...new Set(equipments.map((e) => e.owner).filter(Boolean))],
    [equipments],
  )

  const filtered = useMemo(() => {
    return equipments
      .filter((e) => {
        if (companyFilter !== 'all' && e.company !== companyFilter) return false
        if (typeFilter !== 'all' && e.type !== typeFilter) return false
        if (statusFilter !== 'all' && e.status !== statusFilter) return false
        if (
          availabilityFilter !== 'all' &&
          (e.availability_status || 'Em uso') !== availabilityFilter
        )
          return false
        if (manufacturerFilter !== 'all' && e.manufacturer !== manufacturerFilter) return false
        if (hostnameFilter !== 'all' && e.hostname !== hostnameFilter) return false
        if (deviceTypeFilter !== 'all' && e.device_type !== deviceTypeFilter) return false
        if (ownerFilter !== 'all' && e.owner !== ownerFilter) return false
        if (search) {
          const s = search.toLowerCase()
          return [e.name, e.serial_number, e.patrimony_number, e.ip_address, e.hostname].some((v) =>
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
    availabilityFilter,
    manufacturerFilter,
    hostnameFilter,
    deviceTypeFilter,
    ownerFilter,
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

  const targetLinkedUser = deleteTarget
    ? (deleteTarget.owner || deleteTarget.responsible_user || '').trim()
    : ''

  const handleCancelDelete = async () => {
    if (deleteTarget) {
      try {
        await createAssetAutomationLog({
          action_type: 'cancelamento_exclusao_ativo',
          equipment_id: deleteTarget.id,
          equipment_name: deleteTarget.name,
          target_user_name: targetLinkedUser || 'Nenhum',
          description: `Exclusão do equipamento "${deleteTarget.name}" cancelada pelo operador.`,
          details: {
            equipment_id: deleteTarget.id,
            equipment_name: deleteTarget.name,
            linked_user: targetLinkedUser,
          },
        })
      } catch (logErr) {
        console.warn('Erro ao registrar cancelamento de exclusão:', logErr)
      }
    }
    setDeleteTarget(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)

      // Regra 2: muda o status do dispositivo para disponível e guarda todas as ações em log
      await updateEquipment(deleteTarget.id, {
        availability_status: 'Disponível',
      })

      await createAssetAutomationLog({
        action_type: 'mudanca_status',
        equipment_id: deleteTarget.id,
        equipment_name: deleteTarget.name,
        target_user_name: targetLinkedUser || 'Nenhum',
        description: `Status do equipamento "${deleteTarget.name}" alterado para "Disponível" na confirmação de exclusão pelo operador.`,
        details: {
          previous_status: deleteTarget.availability_status || 'Em uso',
          new_status: 'Disponível',
          reason: 'confirmacao_exclusao_ativo',
          linked_user: targetLinkedUser,
        },
      })

      await createAssetAutomationLog({
        action_type: 'exclusao_ativo',
        equipment_id: deleteTarget.id,
        equipment_name: deleteTarget.name,
        target_user_name: targetLinkedUser || 'Nenhum',
        description: `Equipamento "${deleteTarget.name}" excluído pelo operador após confirmação. Usuário vinculado: ${targetLinkedUser || 'Nenhum'}. Status final de disponibilidade: Disponível.`,
        details: {
          equipment_id: deleteTarget.id,
          equipment_name: deleteTarget.name,
          linked_user: targetLinkedUser,
          final_availability_status: 'Disponível',
        },
      })

      await deleteEquipment(deleteTarget.id)

      toast({
        title: 'Equipamento excluído com sucesso',
        description: `O ativo "${deleteTarget.name}" foi removido do sistema.`,
      })
      setDeleteTarget(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir equipamento',
        description: err?.message || 'Falha na exclusão do ativo.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const cols = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'name', label: 'Nome' },
    { key: 'device_type', label: 'Tipo Disp.' },
    { key: 'ip_address', label: 'IP' },
    { key: 'operating_system', label: 'SO' },
    { key: 'processor', label: 'Processador' },
    { key: 'ram_total', label: 'RAM' },
    { key: 'storage', label: 'Armazen.' },
    { key: 'owner', label: 'Dono' },
    { key: 'manufacturer', label: 'Fabricante' },
    { key: 'model', label: 'Modelo' },
    { key: 'serial_number', label: 'Nº Série' },
    { key: 'patrimony_number', label: 'Patrimônio' },
  ]

  const SortHeader = ({
    col,
    label,
    extraAction,
  }: {
    col?: string
    label: string
    extraAction?: () => void
  }) => (
    <th
      className={`p-3 ${col ? 'cursor-pointer hover:bg-slate-100' : ''}`}
      onClick={col ? () => handleSort(col) : extraAction}
    >
      {col ? (
        <span className="flex items-center gap-1">
          {label} <ArrowUpDown className="h-3 w-3 text-slate-400" />
        </span>
      ) : (
        label
      )}
    </th>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, série, patrimônio, IP, hostname..."
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
          <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo Disp." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Disp.</SelectItem>
              {DEVICE_TYPES.map((t) => (
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
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Disponib.</SelectItem>
              {AVAILABILITY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hostnameFilter} onValueChange={setHostnameFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Hostname" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Hosts</SelectItem>
              {hostnames.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Dono" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Donos</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cmdb/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-1.5 h-4 w-4" /> Importar CSV
            </Button>
          </Link>
          <Link to="/cmdb/assets/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Novo Ativo
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
              <tr>
                {cols.map((c) => (
                  <SortHeader key={c.key} col={c.key} label={c.label} />
                ))}
                <SortHeader col="status" label="Status Oper." />
                <SortHeader col="availability_status" label="Disponibilidade" />
                <SortHeader label="Chamados" />
                <SortHeader label="Empresa" />
                <SortHeader label="Unidade" />
                <SortHeader col="updated" label="Atualizado" />
                {canDeleteEquipment && <th className="p-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-8 text-center text-slate-500">
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
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {e.hostname || '-'}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{e.name}</td>
                    <td className="p-3">{e.device_type || '-'}</td>
                    <td className="p-3 font-mono">{e.ip_address || '-'}</td>
                    <td className="p-3">{e.operating_system || '-'}</td>
                    <td className="p-3">{e.processor || '-'}</td>
                    <td className="p-3">{e.ram_total || '-'}</td>
                    <td className="p-3">
                      {e.storage
                        ? `${e.storage}${e.storage_type ? ` (${e.storage_type})` : ''}`
                        : '-'}
                    </td>
                    <td className="p-3">{e.owner || '-'}</td>
                    <td className="p-3">{e.manufacturer || '-'}</td>
                    <td className="p-3">{e.model || '-'}</td>
                    <td className="p-3">{e.serial_number || '-'}</td>
                    <td className="p-3">{e.patrimony_number || '-'}</td>
                    <td className="p-3">
                      <CiStatusBadge status={e.status} />
                    </td>
                    <td className="p-3">
                      <AvailabilityStatusBadge status={e.availability_status || 'Em uso'} />
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${(ticketCounts[e.id] || 0) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {ticketCounts[e.id] || 0}
                      </span>
                    </td>
                    <td className="p-3">{e.expand?.company?.trade_name || '-'}</td>
                    <td className="p-3">{e.expand?.unit?.name || '-'}</td>
                    <td className="p-3">{new Date(e.updated).toLocaleDateString('pt-BR')}</td>
                    {canDeleteEquipment && (
                      <td className="p-3 text-right" onClick={(evt) => evt.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Excluir Ativo"
                          onClick={() => setDeleteTarget(e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regra 2: Diálogo de confirmação de exclusão do equipamento */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Equipamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-foreground">
              {targetLinkedUser ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                    <p className="font-semibold text-sm">
                      Atenção: possui um usuário cadastrado para este equipamento!
                    </p>
                    <p>
                      Usuário vinculado: <strong>{targetLinkedUser}</strong>
                    </p>
                    <p className="font-medium">
                      Ao confirmar com Sim, o status do dispositivo será alterado para{' '}
                      <strong>Disponível</strong> e a ação será gravada no log de auditoria.
                    </p>
                  </div>
                  <p className="font-semibold text-sm">Deseja realmente excluir o equipamento?</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="text-sm text-foreground">
                    Tem certeza que deseja excluir o equipamento{' '}
                    <strong>{deleteTarget?.name}</strong>?
                  </p>
                  <p>
                    Nenhum usuário está atualmente vinculado a este ativo. A ação será gravada no
                    log de auditoria.
                  </p>
                  <p className="font-semibold text-sm text-foreground pt-1">
                    Deseja realmente excluir o equipamento?
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={deleting}
              onClick={handleCancelDelete}
              className="border-border hover:bg-muted font-medium"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
