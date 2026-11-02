import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  updateEquipment,
  EquipmentRecord,
  CI_STATUSES,
  AVAILABILITY_STATUSES,
  DEVICE_TYPES,
  STORAGE_TYPES,
} from '@/services/equipments'
import { AvailabilityStatusBadge } from '@/components/AvailabilityStatusBadge'
import { getCompanies, getCompanyUnits, getCompanyDepartments } from '@/services/companies'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { deleteEquipment } from '@/services/equipments'
import { createAssetAutomationLog } from '@/services/asset-automation-logs'
import { useNavigate } from 'react-router-dom'
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
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export function CiDetailInfo({
  equipment,
  onUpdate,
}: {
  equipment: EquipmentRecord
  onUpdate: () => void
}) {
  const { canEdit, canDelete } = usePermissions()
  const canEditEquipment = canEdit('cmdb_assets') || canEdit('cmdb')
  const canDeleteEquipment = canDelete('cmdb_assets') || canDelete('cmdb')
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<Partial<EquipmentRecord>>(equipment)
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [showDiscard, setShowDiscard] = useState(false)
  const [justification, setJustification] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingEquipment, setDeletingEquipment] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  const linkedUser = (equipment.owner || equipment.responsible_user || '').trim()

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (form.company) {
      getCompanyUnits(form.company)
        .then(setUnits)
        .catch(() => {})
      getCompanyDepartments(form.company)
        .then(setDepartments)
        .catch(() => {})
    }
  }, [form.company])

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{value || '-'}</p>
    </div>
  )

  const handleSave = async () => {
    if (form.status === 'Descartado' && equipment.status !== 'Descartado') {
      setShowDiscard(true)
      return
    }
    setFieldErrors({})
    try {
      await updateEquipment(equipment.id, form)
      setIsEditing(false)
      onUpdate()
      toast({ title: 'Ativo atualizado com sucesso!' })
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
    }
  }

  const handleConfirmDiscard = async () => {
    if (!justification.trim()) return
    await updateEquipment(equipment.id, {
      ...form,
      notes: `${form.notes || ''}\n[Justificativa de descarte]: ${justification}`,
    })
    setShowDiscard(false)
    setIsEditing(false)
    setJustification('')
    onUpdate()
    toast({ title: 'Ativo descartado' })
  }

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const Err = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-xs text-red-500">{fieldErrors[field]}</p> : null

  const storageDisplay = equipment.storage
    ? `${equipment.storage}${equipment.storage_type ? ` (${equipment.storage_type})` : ''}`
    : undefined

  const handleCancelDeleteEquipment = async () => {
    try {
      await createAssetAutomationLog({
        action_type: 'cancelamento_exclusao_ativo',
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        target_user_name: linkedUser || 'Nenhum',
        description: `Exclusão do equipamento "${equipment.name}" cancelada pelo operador.`,
        details: {
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          linked_user: linkedUser,
        },
      })
    } catch (logErr) {
      console.warn('Erro ao registrar cancelamento de exclusão do ativo:', logErr)
    }
    setShowDeleteDialog(false)
  }

  const handleConfirmDeleteEquipment = async () => {
    try {
      setDeletingEquipment(true)

      // Regra 2: quando o operador clicar em Sim, mude o status do dispositivo para disponível
      // e guarde todas as ações em log antes da exclusão
      await updateEquipment(equipment.id, {
        availability_status: 'Disponível',
      })

      await createAssetAutomationLog({
        action_type: 'mudanca_status',
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        target_user_name: linkedUser || 'Nenhum',
        description: `Status do equipamento "${equipment.name}" alterado para "Disponível" na confirmação de exclusão pelo operador.`,
        details: {
          previous_status: equipment.availability_status || 'Em uso',
          new_status: 'Disponível',
          reason: 'confirmacao_exclusao_ativo',
          linked_user: linkedUser,
        },
      })

      await createAssetAutomationLog({
        action_type: 'exclusao_ativo',
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        target_user_name: linkedUser || 'Nenhum',
        description: `Equipamento "${equipment.name}" excluído pelo operador após confirmação. Usuário vinculado: ${linkedUser || 'Nenhum'}. Status de disponibilidade final: Disponível.`,
        details: {
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          linked_user: linkedUser,
          final_availability_status: 'Disponível',
        },
      })

      await deleteEquipment(equipment.id)

      toast({
        title: 'Equipamento excluído com sucesso',
        description: `O ativo "${equipment.name}" foi removido do sistema.`,
      })
      setShowDeleteDialog(false)
      navigate('/cmdb/assets')
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir equipamento',
        description: err?.message || 'Falha na exclusão do ativo.',
        variant: 'destructive',
      })
    } finally {
      setDeletingEquipment(false)
    }
  }

  if (!isEditing)
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          {canDeleteEquipment && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/40"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Excluir Ativo
            </Button>
          )}
          {canEditEquipment && (
            <Button
              size="sm"
              onClick={() => {
                setForm(equipment)
                setIsEditing(true)
              }}
            >
              Editar
            </Button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Identificação
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
              <Field label="Hostname" value={equipment.hostname} />
              <Field label="Nome" value={equipment.name} />
              <Field label="Tipo de dispositivo" value={equipment.device_type} />
              <Field label="Fabricante" value={equipment.manufacturer} />
              <Field label="Modelo" value={equipment.model} />
              <Field label="Nº Série" value={equipment.serial_number} />
              <Field label="Patrimônio" value={equipment.patrimony_number} />
              <Field label="Endereço IP" value={equipment.ip_address} />
              <Field label="Sistema Operacional" value={equipment.operating_system} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Hardware
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
              <Field label="Processador" value={equipment.processor} />
              <Field label="Núcleos do processador" value={equipment.processor_cores} />
              <Field label="Memória RAM Total" value={equipment.ram_total} />
              <Field label="Armazenamento" value={equipment.storage} />
              <Field label="Tipo de armazenamento" value={equipment.storage_type} />
              <Field label="Armazenamento (completo)" value={storageDisplay} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Responsável
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
              <Field label="Dono do equipamento" value={equipment.owner} />
              <Field label="Usuário responsável" value={equipment.responsible_user} />
              <Field label="Empresa" value={equipment.expand?.company?.trade_name} />
              <Field label="Unidade" value={equipment.expand?.unit?.name} />
              <Field label="Localização" value={equipment.location} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Datas
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
              <Field label="Fornecedor" value={equipment.supplier} />
              <Field
                label="Aquisição"
                value={
                  equipment.acquisition_date
                    ? new Date(equipment.acquisition_date).toLocaleDateString('pt-BR')
                    : undefined
                }
              />
              <Field
                label="Garantia até"
                value={
                  equipment.warranty_until
                    ? new Date(equipment.warranty_until).toLocaleDateString('pt-BR')
                    : undefined
                }
              />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Status e Observações
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
              <Field label="Status Operacional" value={equipment.status} />
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500">Status de Disponibilidade</p>
                <div className="pt-0.5">
                  <AvailabilityStatusBadge status={equipment.availability_status} />
                </div>
              </div>
              <div className="col-span-2 md:col-span-3">
                <Field label="Notas" value={equipment.notes} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )

  const inputCls = 'h-8 text-sm'

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave}>
          Salvar
        </Button>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Identificação
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <div>
            <Label className="text-xs">Hostname</Label>
            <Input
              className={inputCls}
              value={form.hostname || ''}
              onChange={(e) => set('hostname', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              className={inputCls}
              value={form.name || ''}
              onChange={(e) => set('name', e.target.value)}
            />
            <Err field="name" />
          </div>
          <div>
            <Label className="text-xs">Tipo de dispositivo</Label>
            <Select value={form.device_type || ''} onValueChange={(v) => set('device_type', v)}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fabricante</Label>
            <Input
              className={inputCls}
              value={form.manufacturer || ''}
              onChange={(e) => set('manufacturer', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Modelo</Label>
            <Input
              className={inputCls}
              value={form.model || ''}
              onChange={(e) => set('model', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Nº Série</Label>
            <Input
              className={inputCls}
              value={form.serial_number || ''}
              onChange={(e) => set('serial_number', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Patrimônio</Label>
            <Input
              className={inputCls}
              value={form.patrimony_number || ''}
              onChange={(e) => set('patrimony_number', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Endereço IP</Label>
            <Input
              className={inputCls}
              value={form.ip_address || ''}
              onChange={(e) => set('ip_address', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Sistema Operacional</Label>
            <Input
              className={inputCls}
              value={form.operating_system || ''}
              onChange={(e) => set('operating_system', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Hardware
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <div>
            <Label className="text-xs">Processador</Label>
            <Input
              className={inputCls}
              value={form.processor || ''}
              onChange={(e) => set('processor', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Núcleos do processador</Label>
            <Input
              className={inputCls}
              value={form.processor_cores || ''}
              onChange={(e) => set('processor_cores', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Memória RAM Total</Label>
            <Input
              className={inputCls}
              value={form.ram_total || ''}
              onChange={(e) => set('ram_total', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Armazenamento</Label>
            <Input
              className={inputCls}
              value={form.storage || ''}
              onChange={(e) => set('storage', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de armazenamento</Label>
            <Select value={form.storage_type || ''} onValueChange={(v) => set('storage_type', v)}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Responsável
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <div>
            <Label className="text-xs">Dono do equipamento</Label>
            <Input
              className={inputCls}
              value={form.owner || ''}
              onChange={(e) => set('owner', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Usuário responsável</Label>
            <Input
              className={inputCls}
              value={form.responsible_user || ''}
              onChange={(e) => set('responsible_user', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={form.company || ''} onValueChange={(v) => set('company', v)}>
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={form.unit || ''} onValueChange={(v) => set('unit', v)}>
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Localização</Label>
            <Input
              className={inputCls}
              value={form.location || ''}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Datas</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <div>
            <Label className="text-xs">Fornecedor</Label>
            <Input
              className={inputCls}
              value={form.supplier || ''}
              onChange={(e) => set('supplier', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Aquisição</Label>
            <Input
              type="date"
              className={inputCls}
              value={form.acquisition_date || ''}
              onChange={(e) => set('acquisition_date', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Garantia até</Label>
            <Input
              type="date"
              className={inputCls}
              value={form.warranty_until || ''}
              onChange={(e) => set('warranty_until', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Status e Observações
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <div>
            <Label className="text-xs">Status Operacional</Label>
            <Select
              value={form.status || ''}
              onValueChange={(v) => set('status', v)}
              disabled={equipment.status === 'Descartado'}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CI_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status de Disponibilidade</Label>
            <Select
              value={form.availability_status || 'Em uso'}
              onValueChange={(v) => set('availability_status', v)}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Selecione a disponibilidade" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-3">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      </div>

      <Dialog open={showDiscard} onOpenChange={setShowDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Descarte</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">O descarte é irreversível. Justifique o motivo:</p>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Motivo do descarte..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscard(false)}>
              Cancelar
            </Button>
            {canDeleteEquipment && (
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={handleConfirmDiscard}
                disabled={!justification.trim()}
              >
                Confirmar Descarte
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regra 2: Diálogo de confirmação de exclusão do equipamento */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => !open && handleCancelDeleteEquipment()}
      >
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Equipamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-foreground">
              {linkedUser ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                    <p className="font-semibold text-sm">
                      Atenção: possui um usuário cadastrado para este equipamento!
                    </p>
                    <p>
                      Usuário vinculado: <strong>{linkedUser}</strong>
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
                    Tem certeza que deseja excluir o equipamento <strong>{equipment.name}</strong>?
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
              disabled={deletingEquipment}
              onClick={handleCancelDeleteEquipment}
              className="border-border hover:bg-muted font-medium"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteEquipment}
              disabled={deletingEquipment}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {deletingEquipment ? 'Excluindo...' : 'Sim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
