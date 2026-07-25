import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { createEquipment, CI_STATUSES, DEVICE_TYPES, STORAGE_TYPES } from '@/services/equipments'
import { getCompanies, getCompanyUnits, getCompanyDepartments } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

const SECTIONS = [
  { key: 'ident', label: 'Identificação' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'owner', label: 'Responsável' },
  { key: 'dates', label: 'Datas' },
  { key: 'status', label: 'Status e Observações' },
]

export default function CiCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    name: '',
    hostname: '',
    device_type: '',
    type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    patrimony_number: '',
    ip_address: '',
    operating_system: '',
    processor: '',
    processor_cores: '',
    ram_total: '',
    storage: '',
    storage_type: '',
    owner: '',
    responsible_user: '',
    department: '',
    location: '',
    acquisition_date: '',
    warranty_until: '',
    supplier: '',
    status: 'Ativo',
    notes: '',
    company: '',
    unit: '',
  })

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

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' })
      return
    }
    setSaving(true)
    setFieldErrors({})
    try {
      const record = await createEquipment(form as any)
      toast({ title: 'Ativo criado com sucesso!' })
      navigate(`/cmdb/assets/${record.id}`)
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao criar ativo', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const Err = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-xs text-red-500">{fieldErrors[field]}</p> : null

  const inputCls = 'h-8 text-sm'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Novo Ativo</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/cmdb/assets')}>
          Voltar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[0].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Hostname</Label>
              <Input
                className={inputCls}
                value={form.hostname}
                onChange={(e) => set('hostname', e.target.value)}
              />
              <Err field="hostname" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome do equipamento *</Label>
              <Input
                className={inputCls}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
              <Err field="name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de dispositivo</Label>
              <Select value={form.device_type} onValueChange={(v) => set('device_type', v)}>
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
            <div className="space-y-1">
              <Label className="text-xs">Marca</Label>
              <Input
                className={inputCls}
                value={form.manufacturer}
                onChange={(e) => set('manufacturer', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo</Label>
              <Input
                className={inputCls}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número de série</Label>
              <Input
                className={inputCls}
                value={form.serial_number}
                onChange={(e) => set('serial_number', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Patrimônio</Label>
              <Input
                className={inputCls}
                value={form.patrimony_number}
                onChange={(e) => set('patrimony_number', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IP</Label>
              <Input
                className={inputCls}
                value={form.ip_address}
                onChange={(e) => set('ip_address', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sistema operacional</Label>
              <Input
                className={inputCls}
                value={form.operating_system}
                onChange={(e) => set('operating_system', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[1].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Processador</Label>
              <Input
                className={inputCls}
                value={form.processor}
                onChange={(e) => set('processor', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Núcleos do processador</Label>
              <Input
                className={inputCls}
                value={form.processor_cores}
                onChange={(e) => set('processor_cores', e.target.value)}
                placeholder="Ex: 8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Memória RAM Total</Label>
              <Input
                className={inputCls}
                value={form.ram_total}
                onChange={(e) => set('ram_total', e.target.value)}
                placeholder="Ex: 16GB"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Armazenamento</Label>
              <Input
                className={inputCls}
                value={form.storage}
                onChange={(e) => set('storage', e.target.value)}
                placeholder="Ex: 512GB"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de armazenamento</Label>
              <Select value={form.storage_type} onValueChange={(v) => set('storage_type', v)}>
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

        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[2].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Dono do equipamento</Label>
              <Input
                className={inputCls}
                value={form.owner}
                onChange={(e) => set('owner', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Usuário responsável</Label>
              <Input
                className={inputCls}
                value={form.responsible_user}
                onChange={(e) => set('responsible_user', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Departamento</Label>
              <Select value={form.department} onValueChange={(v) => set('department', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Localização</Label>
              <Input
                className={inputCls}
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[3].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Select value={form.company} onValueChange={(v) => set('company', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err field="company" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
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
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Input
                className={inputCls}
                value={form.supplier}
                onChange={(e) => set('supplier', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de compra</Label>
              <Input
                type="date"
                className={inputCls}
                value={form.acquisition_date}
                onChange={(e) => set('acquisition_date', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de garantia</Label>
              <Input
                type="date"
                className={inputCls}
                value={form.warranty_until}
                onChange={(e) => set('warranty_until', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[4].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
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
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate('/cmdb/assets')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar Ativo'}
          </Button>
        </div>
      </form>
    </div>
  )
}
