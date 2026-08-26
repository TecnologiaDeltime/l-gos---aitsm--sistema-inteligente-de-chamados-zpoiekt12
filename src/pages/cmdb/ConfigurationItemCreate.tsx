import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, GitBranch, Loader2, Save } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createConfigurationItem,
  CONFIGURATION_ITEM_TYPES,
  CONFIGURATION_ITEM_STATUSES,
  ConfigurationItemType,
  ConfigurationItemStatus,
} from '@/services/configuration-items'
import { getCompanies } from '@/services/companies'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { useToast } from '@/hooks/use-toast'

export default function ConfigurationItemCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<CompanyUnitRecord[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  const [form, setForm] = useState<{
    name: string
    type: ConfigurationItemType | ''
    brand: string
    model: string
    serial_number: string
    location: string
    status: ConfigurationItemStatus
    observations: string
    company: string
    unit: string
  }>({
    name: '',
    type: '',
    brand: '',
    model: '',
    serial_number: '',
    location: '',
    status: 'Ativo',
    observations: '',
    company: '',
    unit: '',
  })

  useEffect(() => {
    getCompanies()
      .then((data) => {
        setCompanies(data)
        if (data.length === 1) {
          setForm((f) => ({ ...f, company: data[0].id }))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false))
  }, [])

  useEffect(() => {
    if (!form.company) {
      setUnits([])
      setForm((f) => ({ ...f, unit: '' }))
      return
    }

    setLoadingUnits(true)
    getCompanyUnitsByCompany(form.company)
      .then((data) => {
        setUnits(data)
      })
      .catch(() => {
        setUnits([])
      })
      .finally(() => {
        setLoadingUnits(false)
      })
  }, [form.company])

  const handleCompanyChange = (companyId: string) => {
    setForm((f) => ({ ...f, company: companyId, unit: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: 'O nome do item é obrigatório', variant: 'destructive' })
      return
    }
    if (!form.type) {
      toast({ title: 'Selecione o tipo do item', variant: 'destructive' })
      return
    }
    if (!form.company) {
      toast({ title: 'Selecione a empresa proprietária', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await createConfigurationItem({
        name: form.name.trim(),
        type: form.type as ConfigurationItemType,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        observations: form.observations.trim() || undefined,
        company: form.company,
        unit: form.unit && form.unit !== 'headquarters' ? form.unit : null,
      })
      toast({ title: 'Item de configuração criado com sucesso!' })
      navigate('/cmdb/configuration-items')
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar item de configuração',
        description: err?.message || 'Verifique os dados e tente novamente',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cmdb/configuration-items')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Novo Item de Configuração
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Equipamento de Infraestrutura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Empresa */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Empresa / Cliente <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.company}
                onValueChange={handleCompanyChange}
                disabled={loadingCompanies}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.trade_name || c.legal_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filial */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Filial</Label>
              <Select
                value={form.unit || 'headquarters'}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, unit: val === 'headquarters' ? '' : val }))
                }
                disabled={!form.company || loadingUnits}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={!form.company ? 'Selecione uma empresa primeiro...' : 'Sede'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="headquarters">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Sede
                    </span>
                  </SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome e Tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nome do Item <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  placeholder="Ex: Impressora HP Recepção, Switch Core 24p"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Tipo de Equipamento <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, type: val as ConfigurationItemType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIGURATION_ITEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marca e Modelo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Marca</Label>
                <Input
                  placeholder="Ex: Cisco, HP, Dell, Mikrotik, Ubiquiti"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Modelo</Label>
                <Input
                  placeholder="Ex: LaserJet Pro M404, Catalyst 2960"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </div>
            </div>

            {/* Número de Série e Localização */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Número de Série</Label>
                <Input
                  placeholder="Ex: SN123456789"
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Localização</Label>
                <Input
                  placeholder="Ex: Rack Sala do CPD, 2º Andar - Recepção"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, status: val as ConfigurationItemStatus }))
                }
              >
                <SelectTrigger className="sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIGURATION_ITEM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações de configuração */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Observações de Configuração do Equipamento
              </Label>
              <Textarea
                rows={4}
                placeholder="Endereço IP, VLANs configuradas, portas ativas, credenciais de acesso padrão, firmware, notas de topologia..."
                value={form.observations}
                onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/cmdb/configuration-items')}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Salvar Item
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
