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
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { buildSectorTree, flattenSectorTree, getSectorIndent } from '@/lib/sector-hierarchy'
import { Building2, Loader2 } from 'lucide-react'

export default function CiCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [selectedResponsibleId, setSelectedResponsibleId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadingDeps, setLoadingDeps] = useState(false)
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
      .catch(() => {
        toast({ title: 'Erro ao carregar empresas', variant: 'destructive' })
      })
  }, [])

  useEffect(() => {
    if (form.company) {
      setLoadingDeps(true)
      Promise.all([
        getCompanyUnits(form.company),
        getCompanyDepartments(form.company),
        getClientContacts(form.company),
      ])
        .then(([u, d, c]) => {
          setUnits(u)
          setDepartments(d)
          setContacts(c)
        })
        .catch(() => {
          toast({
            title: 'Erro ao carregar dados da empresa',
            description: 'Não foi possível carregar colaboradores e setores. Tente novamente.',
            variant: 'destructive',
          })
          setContacts([])
          setUnits([])
          setDepartments([])
        })
        .finally(() => setLoadingDeps(false))
    } else {
      setContacts([])
      setUnits([])
      setDepartments([])
    }
    setSelectedOwnerId('')
    setSelectedResponsibleId('')
    setForm((p) => ({ ...p, owner: '', responsible_user: '', department: '', unit: '' }))
  }, [form.company])

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const flattenedDepts = flattenSectorTree(buildSectorTree(departments))

  const resolveDeptName = (deptId: string): string => {
    const dept = departments.find((d) => d.id === deptId)
    return dept?.name || ''
  }

  const handleOwnerSelect = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId)
    setSelectedOwnerId(contactId)
    const deptId = contact?.departments?.[0] || ''
    setForm((p) => ({
      ...p,
      owner: contact?.full_name || '',
      department: deptId,
    }))
  }

  const handleResponsibleSelect = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId)
    setSelectedResponsibleId(contactId)
    const deptId = contact?.departments?.[0] || ''
    setForm((p) => ({
      ...p,
      responsible_user: contact?.full_name || '',
      department: deptId,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company) {
      toast({ title: 'Selecione uma empresa primeiro', variant: 'destructive' })
      return
    }
    if (!form.owner) {
      setFieldErrors({ owner: 'O campo Dono do Equipamento é obrigatório.' })
      toast({ title: 'Preencha o campo obrigatório: Dono do Equipamento', variant: 'destructive' })
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
  const companySelected = !!form.company

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Novo Ativo</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/cmdb/assets')}>
          Voltar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Selector — at the very top */}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Selecione a Empresa *
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Escolha a empresa primeiro para carregar colaboradores, setores e unidades disponíveis.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Select value={form.company} onValueChange={(v) => set('company', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione uma empresa" />
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
            {companySelected && (
              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Selecione (opcional)" />
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
            )}
          </div>
        </div>

        {/* Loading state */}
        {companySelected && loadingDeps && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando colaboradores e setores...</span>
          </div>
        )}

        {/* Rest of form — only shown after company is selected */}
        {companySelected && !loadingDeps && (
          <>
            {/* Identificação */}
            <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Identificação
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

            {/* Hardware */}
            <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hardware</h3>
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

            {/* Responsável */}
            <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Responsável
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Dono do equipamento *</Label>
                  <Select value={selectedOwnerId} onValueChange={handleOwnerSelect}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Err field="owner" />
                  {contacts.length === 0 && (
                    <p className="text-xs text-amber-500">
                      Nenhum colaborador cadastrado para esta empresa.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Usuário responsável</Label>
                  <Select value={selectedResponsibleId} onValueChange={handleResponsibleSelect}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Departamento</Label>
                  <Select value={form.department} onValueChange={(v) => set('department', v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {flattenedDepts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {getSectorIndent(d.level) + d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.department && (
                    <p className="text-xs text-muted-foreground">
                      Setor: {resolveDeptName(form.department)}
                    </p>
                  )}
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

            {/* Garantia (optional) */}
            <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Garantia{' '}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

            {/* Status e Observações */}
            <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Status e Observações
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
                <Textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                />
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
          </>
        )}

        {/* Placeholder when no company selected */}
        {!companySelected && (
          <div className="rounded-xl border border-dashed bg-slate-50 dark:bg-slate-900 p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Selecione uma empresa acima para começar a preencher os dados do ativo.
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
