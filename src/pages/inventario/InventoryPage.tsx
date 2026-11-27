import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Smartphone,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import {
  InventoryDevice,
  InventoryDevicePayload,
  InventoryDeviceStatus,
  InventoryDeviceType,
  activateInventoryDevice,
  createInventoryDevice,
  deactivateInventoryDevice,
  listInventoryDevices,
  updateInventoryDevice,
} from '@/services/inventory'
import { extractSearchTokens } from '@/lib/search-text'

const DEVICE_TYPES: Array<{ value: InventoryDeviceType; label: string }> = [
  { value: 'celular', label: 'Celular' },
  { value: 'camera', label: 'Câmera' },
]

const DEVICE_STATUSES: Array<{ value: InventoryDeviceStatus; label: string }> = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'desativado', label: 'Desativado' },
]

const STATUS_STYLES: Record<InventoryDeviceStatus, { label: string; className: string }> = {
  disponivel: {
    label: 'Disponível',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  em_uso: {
    label: 'Em uso',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  manutencao: {
    label: 'Manutenção',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  desativado: {
    label: 'Desativado',
    className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
  },
}

interface OperatorOption {
  id: string
  name: string
}

interface DeviceFormState {
  device_type: InventoryDeviceType
  brand: string
  model: string
  serial_number: string
  phone_number: string
  condition: 'novo' | 'uso'
  status: InventoryDeviceStatus
  assigned_to: string
  notes: string
}

const EMPTY_FORM: DeviceFormState = {
  device_type: 'celular',
  brand: '',
  model: '',
  serial_number: '',
  phone_number: '',
  condition: 'uso',
  status: 'disponivel',
  assigned_to: 'none',
  notes: '',
}

function matchesDeviceSearch(device: InventoryDevice, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const fields = [
    device.brand,
    device.model,
    device.serial_number,
    device.phone_number,
    device.assigned_to_name,
    device.notes,
    STATUS_STYLES[device.status]?.label,
    DEVICE_TYPES.find((t) => t.value === device.device_type)?.label,
  ]
  const haystack = fields.filter(Boolean).join(' ')
  return tokens.every((t) => haystack.includes(t))
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { canAccessItem, isGestor, isAdmin } = usePermissions()
  const canManage = isAdmin || isGestor || canAccessItem('inventory', 'inventario_gerenciar')

  const [devices, setDevices] = useState<InventoryDevice[]>([])
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | InventoryDeviceType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | InventoryDeviceStatus>('all')
  const [showInactive, setShowInactive] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<InventoryDevice | null>(null)
  const [form, setForm] = useState<DeviceFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<InventoryDevice | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listInventoryDevices({ includeInactive: true })
      setDevices(list)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar aparelhos'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadOperators = useCallback(async () => {
    try {
      const records = await pb.collection('users').getFullList<{
        id: string
        name?: string
        active?: boolean
      }>({
        filter: 'active = true',
        sort: 'name',
      })
      setOperators(records.map((r) => ({ id: r.id, name: r.name || '' })))
    } catch {
      setOperators([])
    }
  }, [])

  useEffect(() => {
    loadDevices()
    loadOperators()
  }, [loadDevices, loadOperators])

  const tokens = useMemo(() => extractSearchTokens(search), [search])

  const visibleDevices = useMemo(() => {
    let list = devices
    if (typeFilter !== 'all') list = list.filter((d) => d.device_type === typeFilter)
    if (statusFilter !== 'all') list = list.filter((d) => d.status === statusFilter)
    else if (!showInactive) list = list.filter((d) => d.status !== 'desativado')
    return list.filter((d) => matchesDeviceSearch(d, tokens))
  }, [devices, typeFilter, statusFilter, showInactive, tokens])

  const openCreate = () => {
    setEditingDevice(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (device: InventoryDevice) => {
    setEditingDevice(device)
    setForm({
      device_type: device.device_type,
      brand: device.brand,
      model: device.model,
      serial_number: device.serial_number || '',
      phone_number: device.phone_number || '',
      condition: device.condition === 'novo' ? 'novo' : 'uso',
      status: device.status,
      assigned_to: device.assigned_to || 'none',
      notes: device.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe marca e modelo do aparelho.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload: InventoryDevicePayload = {
        device_type: form.device_type,
        brand: form.brand.trim(),
        model: form.model.trim(),
        serial_number: form.serial_number.trim() || undefined,
        phone_number: form.phone_number.trim() || undefined,
        condition: form.condition,
        status: form.status,
        assigned_to: form.assigned_to === 'none' ? undefined : form.assigned_to || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (editingDevice) {
        await updateInventoryDevice(editingDevice.id, payload)
        toast({ title: 'Aparelho atualizado' })
      } else {
        await createInventoryDevice(payload)
        toast({ title: 'Aparelho cadastrado' })
      }
      setDialogOpen(false)
      await loadDevices()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar aparelho'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setSaving(true)
    try {
      await deactivateInventoryDevice(deactivateTarget.id)
      toast({
        title: 'Aparelho desativado',
        description: 'O aparelho saiu da listagem ativa e o histórico permanece preservado.',
      })
      setDeactivateTarget(null)
      await loadDevices()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao desativar aparelho'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (device: InventoryDevice) => {
    setActivatingId(device.id)
    try {
      await activateInventoryDevice(device.id, { status: 'disponivel' })
      toast({ title: 'Aparelho reativado' })
      await loadDevices()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao reativar aparelho'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventário de Aparelhos</h1>
          <p className="text-sm text-muted-foreground">
            Aparelhos de celular e câmera utilizados pela equipe de campo nos laudos fotográficos.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Novo aparelho
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, IMEI/serial, linha ou responsável…"
            className="pl-9 min-h-[44px]"
            aria-label="Buscar aparelhos"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full md:w-[190px] min-h-[44px]" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {DEVICE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger
            className="w-full md:w-[190px] min-h-[44px]"
            aria-label="Filtrar por status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {DEVICE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setShowInactive((v) => !v)}
          aria-pressed={showInactive}
        >
          {showInactive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showInactive ? 'Ocultar desativados' : 'Mostrar desativados'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparelhos ({visibleDevices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : visibleDevices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum aparelho encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>IMEI / Serial</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDevices.map((device) => {
                    const isInactive = device.status === 'desativado'
                    return (
                      <TableRow key={device.id} className={isInactive ? 'opacity-60' : undefined}>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            {device.device_type === 'celular' ? (
                              <Smartphone className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Camera className="h-4 w-4" aria-hidden="true" />
                            )}
                            {DEVICE_TYPES.find((t) => t.value === device.device_type)?.label || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {device.brand} {device.model}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {device.serial_number || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {device.phone_number || '—'}
                        </TableCell>
                        <TableCell>{device.condition === 'novo' ? 'Novo' : 'Usado'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_STYLES[device.status]?.className}
                          >
                            {STATUS_STYLES[device.status]?.label || device.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{device.assigned_to_name || '—'}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isInactive ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="min-h-[44px]"
                                  onClick={() => handleActivate(device)}
                                  disabled={activatingId === device.id}
                                >
                                  {activatingId === device.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  Reativar
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-h-[44px]"
                                    onClick={() => openEdit(device)}
                                    aria-label={`Editar ${device.brand} ${device.model}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-h-[44px]"
                                    onClick={() => setDeactivateTarget(device)}
                                    aria-label={`Desativar ${device.brand} ${device.model}`}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDevice ? 'Editar aparelho' : 'Cadastrar aparelho'}</DialogTitle>
            <DialogDescription>
              Aparelho usado pela equipe de campo na execução de laudos fotográficos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-type">Tipo de aparelho *</Label>
              <Select
                value={form.device_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, device_type: v as InventoryDeviceType }))
                }
              >
                <SelectTrigger id="inv-type" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inv-brand">Marca *</Label>
                <Input
                  id="inv-brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="Samsung, Apple, Canon…"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-model">Modelo *</Label>
                <Input
                  id="inv-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="Galaxy S23, EOS R50…"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inv-serial">IMEI / Serial</Label>
                <Input
                  id="inv-serial"
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-phone">Número de linha</Label>
                <Input
                  id="inv-phone"
                  value={form.phone_number}
                  onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                  type="tel"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inv-condition">Estado</Label>
                <Select
                  value={form.condition}
                  onValueChange={(v) => setForm((f) => ({ ...f, condition: v as 'novo' | 'uso' }))}
                >
                  <SelectTrigger id="inv-condition" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="uso">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as InventoryDeviceStatus }))
                  }
                >
                  <SelectTrigger id="inv-status" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-assigned">Responsável</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
              >
                <SelectTrigger id="inv-assigned" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name || op.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-notes">Observação</Label>
              <Textarea
                id="inv-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {editingDevice ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar aparelho</DialogTitle>
            <DialogDescription>
              O aparelho{' '}
              <span className="font-medium text-foreground">
                {deactivateTarget?.brand} {deactivateTarget?.model}
              </span>{' '}
              será marcado como desativado. Ele sai da listagem ativa, porém o registro e o
              histórico permanecem preservados no banco — o aparelho nunca é apagado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={saving}
              className="min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={saving}
              className="min-h-[44px]"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Power className="mr-2 h-4 w-4" />
              )}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
