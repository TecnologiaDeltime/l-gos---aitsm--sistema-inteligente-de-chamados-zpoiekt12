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
import { updateEquipment, EquipmentRecord, CI_STATUSES } from '@/services/equipments'
import { getCompanies, getCompanyUnits, getCompanyDepartments } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'

export function CiDetailInfo({
  equipment,
  onUpdate,
}: {
  equipment: EquipmentRecord
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<Partial<EquipmentRecord>>(equipment)
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [showDiscard, setShowDiscard] = useState(false)
  const [justification, setJustification] = useState('')
  const { toast } = useToast()

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
    await updateEquipment(equipment.id, form)
    setIsEditing(false)
    onUpdate()
    toast({ title: 'Ativo atualizado com sucesso!' })
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

  if (!isEditing)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setForm(equipment)
              setIsEditing(true)
            }}
          >
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
          <Field label="Nome" value={equipment.name} />
          <Field label="Tipo" value={equipment.type} />
          <Field label="Fabricante" value={equipment.manufacturer} />
          <Field label="Modelo" value={equipment.model} />
          <Field label="Nº Série" value={equipment.serial_number} />
          <Field label="Patrimônio" value={equipment.patrimony_number} />
          <Field label="Endereço IP" value={equipment.ip_address} />
          <Field label="Sistema Operacional" value={equipment.operating_system} />
          <Field label="Empresa" value={equipment.expand?.company?.trade_name} />
          <Field label="Unidade" value={equipment.expand?.unit?.name} />
          <Field label="Localização" value={equipment.location} />
          <Field label="Responsável" value={equipment.responsible_user} />
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
          <Field label="Status" value={equipment.status} />
          <Field label="Notas" value={equipment.notes} />
        </div>
      </div>
    )

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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-xl border bg-white p-6 dark:bg-slate-900">
        <div>
          <Label className="text-xs">Nome</Label>
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Input value={form.type || ''} onChange={(e) => set('type', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Fabricante</Label>
          <Input
            value={form.manufacturer || ''}
            onChange={(e) => set('manufacturer', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Modelo</Label>
          <Input value={form.model || ''} onChange={(e) => set('model', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Nº Série</Label>
          <Input
            value={form.serial_number || ''}
            onChange={(e) => set('serial_number', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Patrimônio</Label>
          <Input
            value={form.patrimony_number || ''}
            onChange={(e) => set('patrimony_number', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Endereço IP</Label>
          <Input
            value={form.ip_address || ''}
            onChange={(e) => set('ip_address', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Sistema Operacional</Label>
          <Input
            value={form.operating_system || ''}
            onChange={(e) => set('operating_system', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Empresa</Label>
          <Select value={form.company || ''} onValueChange={(v) => set('company', v)}>
            <SelectTrigger>
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
            <SelectTrigger>
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
          <Input value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Responsável</Label>
          <Input
            value={form.responsible_user || ''}
            onChange={(e) => set('responsible_user', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input value={form.supplier || ''} onChange={(e) => set('supplier', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Aquisição</Label>
          <Input
            type="date"
            value={form.acquisition_date || ''}
            onChange={(e) => set('acquisition_date', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Garantia até</Label>
          <Input
            type="date"
            value={form.warranty_until || ''}
            onChange={(e) => set('warranty_until', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select
            value={form.status || ''}
            onValueChange={(v) => set('status', v)}
            disabled={equipment.status === 'Descartado'}
          >
            <SelectTrigger>
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
        <div className="col-span-2 md:col-span-3">
          <Label className="text-xs">Notas</Label>
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
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
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDiscard}
              disabled={!justification.trim()}
            >
              Confirmar Descarte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
