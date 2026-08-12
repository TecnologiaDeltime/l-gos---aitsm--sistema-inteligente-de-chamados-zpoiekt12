import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createCompany, createCompanyDepartment } from '@/services/companies'
import { createClientContact, type FocalPointData } from '@/services/client-contacts'
import { createEmailDomain, type PendingEmailDomain } from '@/services/client-email-domains'
import { fetchCep } from '@/lib/cep'
import { FocalPointSection } from '@/components/clients/FocalPointSection'
import { CollaboratorSection } from '@/components/clients/CollaboratorSection'
import { BranchSection } from '@/components/clients/BranchSection'
import { SectorSection } from '@/components/clients/SectorSection'
import { EmailDomainSection } from '@/components/clients/EmailDomainSection'
import { useToast } from '@/hooks/use-toast'

export default function ClientDetail() {
  const [form, setForm] = useState({
    code: `CLI-${Math.floor(100 + Math.random() * 900)}`,
    trade_name: '',
    legal_name: '',
    document: '',
    email: '',
    phone: '',
    address_street: '',
    address_number: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zipcode: '',
    address_complement: '',
    site: '',
  })
  const [cepLoading, setCepLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingSectors, setPendingSectors] = useState<string[]>([])
  const [pendingFocalPoints, setPendingFocalPoints] = useState<FocalPointData[]>([])
  const [pendingEmailDomains, setPendingEmailDomains] = useState<PendingEmailDomain[]>([])

  const navigate = useNavigate()
  const { toast } = useToast()

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleCepChange = async (value: string) => {
    set('address_zipcode', value)
    const cleanCep = value.replace(/\D/g, '')
    if (cleanCep.length !== 8) return
    setCepLoading(true)
    try {
      const data = await fetchCep(cleanCep)
      if (data) {
        setForm((prev) => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          address_neighborhood: data.bairro || prev.address_neighborhood,
          address_city: data.localidade || prev.address_city,
          address_state: data.uf || prev.address_state,
        }))
      } else {
        toast({ title: 'CEP não encontrado', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
    } finally {
      setCepLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createCompany({ ...form, status: 'Ativo' })
      if (pendingSectors.length > 0) {
        await Promise.all(
          pendingSectors.map((name) => createCompanyDepartment({ company: created.id, name })),
        )
      }
      if (pendingFocalPoints.length > 0) {
        await Promise.all(
          pendingFocalPoints.map((fp) =>
            createClientContact({ ...fp, client: created.id, is_focal_point: true }),
          ),
        )
      }
      if (pendingEmailDomains.length > 0) {
        await Promise.all(
          pendingEmailDomains.map((d) =>
            createEmailDomain({ client: created.id, domain: d.domain, active: d.active }),
          ),
        )
      }
      toast({ title: 'Cliente cadastrado com sucesso!' })
      navigate(`/clients/${created.id}/edit`)
    } catch {
      toast({ title: 'Erro ao cadastrar cliente', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const cls = 'h-9 text-sm'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-4">
        <h2 className="text-lg font-bold">Cadastrar Novo Cliente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Código Interno</Label>
              <Input
                className={cls}
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CNPJ / CPF</Label>
              <Input
                className={cls}
                placeholder="00.000.000/0001-00"
                value={form.document}
                onChange={(e) => set('document', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nome Fantasia</Label>
            <Input
              className={cls}
              placeholder="Ex: Acme Corp"
              value={form.trade_name}
              onChange={(e) => set('trade_name', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Razão Social</Label>
            <Input
              className={cls}
              placeholder="Ex: Acme Indústria S/A"
              value={form.legal_name}
              onChange={(e) => set('legal_name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                type="email"
                className={cls}
                placeholder="contato@acme.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefone</Label>
              <Input
                className={cls}
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CEP</Label>
              <div className="relative">
                <Input
                  className={cls}
                  placeholder="00000-000"
                  value={form.address_zipcode}
                  onChange={(e) => handleCepChange(e.target.value)}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Site</Label>
              <Input
                className={cls}
                placeholder="https://www.exemplo.com.br"
                value={form.site}
                onChange={(e) => set('site', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Endereço</Label>
              <Input
                className={cls}
                value={form.address_street}
                onChange={(e) => set('address_street', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Número</Label>
              <Input
                className={cls}
                value={form.address_number}
                onChange={(e) => set('address_number', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Complemento</Label>
              <Input
                className={cls}
                placeholder="Apto, bloco, andar, lote..."
                value={form.address_complement}
                onChange={(e) => set('address_complement', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bairro</Label>
              <Input
                className={cls}
                value={form.address_neighborhood}
                onChange={(e) => set('address_neighborhood', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cidade</Label>
              <Input
                className={cls}
                value={form.address_city}
                onChange={(e) => set('address_city', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Estado</Label>
            <Input
              className={cls}
              value={form.address_state}
              onChange={(e) => set('address_state', e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              'Salvar Cliente'
            )}
          </Button>
        </form>
      </div>
      <BranchSection />
      <SectorSection pendingSectors={pendingSectors} onPendingSectorsChange={setPendingSectors} />
      <CollaboratorSection />
      <FocalPointSection
        pendingFocalPoints={pendingFocalPoints}
        onPendingFocalPointsChange={setPendingFocalPoints}
      />
      <EmailDomainSection
        pendingDomains={pendingEmailDomains}
        onPendingDomainsChange={setPendingEmailDomains}
      />
    </div>
  )
}
