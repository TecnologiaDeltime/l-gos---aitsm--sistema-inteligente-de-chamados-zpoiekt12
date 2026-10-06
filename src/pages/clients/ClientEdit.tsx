import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowLeft, Save, AlertCircle } from 'lucide-react'
import {
  getCompany,
  updateCompany,
  createCompanyAuditLog,
  type CompanyRecord,
} from '@/services/companies'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { SectorSection } from '@/components/clients/SectorSection'
import { CollaboratorSection } from '@/components/clients/CollaboratorSection'
import { BranchSection } from '@/components/clients/BranchSection'
import { FocalPointSection } from '@/components/clients/FocalPointSection'
import { EmailDomainSection } from '@/components/clients/EmailDomainSection'

const EMPTY_FORM = {
  code: '',
  legal_name: '',
  trade_name: '',
  document: '',
  address_street: '',
  address_number: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zipcode: '',
  phone: '',
  email: '',
  status: 'Ativo',
  notes: '',
  address_complement: '',
  site: '',
}

export default function ClientEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { canManageClients } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [original, setOriginal] = useState<CompanyRecord | null>(null)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)

  useEffect(() => {
    if (!id) return
    let isCancelled = false
    setLoading(true)
    setFetchError(null)

    getCompany(id)
      .then((data) => {
        if (isCancelled) return
        setOriginal(data)
        setForm({
          code: data.code || '',
          legal_name: data.legal_name || '',
          trade_name: data.trade_name || '',
          document: data.document || '',
          address_street: data.address_street || '',
          address_number: data.address_number || '',
          address_neighborhood: data.address_neighborhood || '',
          address_city: data.address_city || '',
          address_state: data.address_state || '',
          address_zipcode: data.address_zipcode || '',
          phone: data.phone || '',
          email: data.email || '',
          status: data.status || 'Ativo',
          notes: data.notes || '',
          site: (data as any).site || '',
          address_complement: (data as any).address_complement || '',
        })
      })
      .catch(() => {
        if (isCancelled) return
        setFetchError('Não foi possível carregar os dados do cliente.')
      })
      .finally(() => {
        if (isCancelled) return
        setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [id])

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleCepLookup = async (cep: string) => {
    set('address_zipcode', cep)
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        if (data.logradouro) set('address_street', data.logradouro)
        if (data.bairro) set('address_neighborhood', data.bairro)
        if (data.localidade) set('address_city', data.localidade)
        if (data.uf) set('address_state', data.uf)
      } else {
        toast({ title: 'CEP não encontrado', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !original) return

    const errors: FieldErrors = {}
    if (!form.legal_name?.trim()) errors.legal_name = 'Razão Social é obrigatória'
    if (!form.trade_name?.trim()) errors.trade_name = 'Nome Fantasia é obrigatório'
    if (!form.document?.trim()) errors.document = 'CNPJ / CPF é obrigatório'
    if (!form.code?.trim()) errors.code = 'Código é obrigatório'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      await updateCompany(id, form)

      const oldValues: Record<string, unknown> = {}
      const newValues: Record<string, unknown> = {}
      for (const key of Object.keys(form)) {
        const oldVal = (original as any)[key] ?? ''
        const newVal = form[key] ?? ''
        if (oldVal !== newVal) {
          oldValues[key] = oldVal
          newValues[key] = newVal
        }
      }

      if (Object.keys(newValues).length > 0 && user?.id) {
        try {
          await createCompanyAuditLog({
            user: user.id,
            action: 'update',
            entity_type: 'companies',
            entity_id: id,
            description: `Cliente "${form.trade_name}" atualizado`,
            old_values: oldValues,
            new_values: newValues,
          })
        } catch {
          /* audit log failure should not block the user */
        }
      }

      toast({ title: 'Cliente atualizado com sucesso!' })
      navigate('/clients')
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao atualizar cliente', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!canManageClients) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">
          Você não tem permissão para editar clientes.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/clients')}>
          Voltar para Lista
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">{fetchError}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/clients')}>
          Voltar para Lista
        </Button>
      </div>
    )
  }

  const Err = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p> : null

  const inputCls = 'h-9 text-sm'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Editar Cliente</h2>
          <p className="text-sm text-slate-500">{original?.trade_name}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Código Interno *</Label>
            <Input
              className={inputCls}
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
            />
            <Err field="code" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CNPJ / CPF *</Label>
            <Input
              className={inputCls}
              placeholder="00.000.000/0001-00"
              value={form.document}
              onChange={(e) => set('document', e.target.value)}
            />
            <Err field="document" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Nome Fantasia *</Label>
          <Input
            className={inputCls}
            value={form.trade_name}
            onChange={(e) => set('trade_name', e.target.value)}
          />
          <Err field="trade_name" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Razão Social *</Label>
          <Input
            className={inputCls}
            value={form.legal_name}
            onChange={(e) => set('legal_name', e.target.value)}
          />
          <Err field="legal_name" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input
              className={inputCls}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input
              className={inputCls}
              value={form.address_street}
              onChange={(e) => set('address_street', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Número</Label>
            <Input
              className={inputCls}
              value={form.address_number}
              onChange={(e) => set('address_number', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Complemento</Label>
            <Input
              className={inputCls}
              placeholder="Apto, bloco, andar, lote..."
              value={form.address_complement}
              onChange={(e) => set('address_complement', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro</Label>
            <Input
              className={inputCls}
              value={form.address_neighborhood}
              onChange={(e) => set('address_neighborhood', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CEP</Label>
            <Input
              className={inputCls}
              value={form.address_zipcode}
              onChange={(e) => handleCepLookup(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input
              className={inputCls}
              value={form.address_city}
              onChange={(e) => set('address_city', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Input
              className={inputCls}
              value={form.address_state}
              onChange={(e) => set('address_state', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Site</Label>
          <Input
            className={inputCls}
            placeholder="https://www.exemplo.com.br"
            value={form.site}
            onChange={(e) => set('site', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={form.status || 'Ativo'} onValueChange={(v) => set('status', v)}>
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="Selecione o status">{form.status || 'Ativo'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Observações</Label>
          <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/clients')}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
      <SectorSection clientId={id} />
      <CollaboratorSection clientId={id} />
      <FocalPointSection clientId={id} />
      <BranchSection clientId={id} />
      <EmailDomainSection clientId={id} />
    </div>
  )
}
