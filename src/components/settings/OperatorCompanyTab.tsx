import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getCompanySettings,
  saveCompanySettings,
  defaultWeek,
  WEEKDAY_LABELS,
  type CompanyBusinessHour,
  type CompanySettingsRecord,
} from '@/services/company-settings'
import { X, Plus, Save, Building2, Clock, CalendarDays, Loader2 } from 'lucide-react'

interface OperatorCompanyTabProps {
  canConfigure: boolean
  canEdit: boolean
}

interface Holiday {
  date: string
  name: string
}

export function OperatorCompanyTab({ canConfigure, canEdit }: OperatorCompanyTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)

  const [legalName, setLegalName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [week, setWeek] = useState<Record<string, CompanyBusinessHour>>(defaultWeek())
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const timezone = 'America/Sao_Paulo'

  const isReadOnly = !canConfigure && !canEdit

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const rec: CompanySettingsRecord | null = await getCompanySettings()
      if (rec) {
        setRecordId(rec.id)
        setLegalName(rec.legal_name || '')
        setTradeName(rec.trade_name || '')
        setCnpj(rec.cnpj || '')
        setEmail(rec.email || '')
        setPhone(rec.phone || '')
        setStreet(rec.address_street || '')
        setNumber(rec.address_number || '')
        setComplement(rec.address_complement || '')
        setNeighborhood(rec.address_neighborhood || '')
        setCity(rec.address_city || '')
        setState(rec.address_state || '')
        setZipcode(rec.address_zipcode || '')
        setWeek({ ...defaultWeek(), ...(rec.business_hours || {}) })
        setHolidays(rec.holidays || [])
      }
    } catch (err) {
      console.error('Erro ao carregar cadastro da empresa operadora:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isReadOnly) return
    if (!legalName.trim()) {
      toast({
        title: 'Razão social obrigatória',
        description: 'Informe a razão social da empresa operadora.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await saveCompanySettings({
        legal_name: legalName.trim(),
        trade_name: tradeName.trim(),
        cnpj: cnpj.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address_street: street.trim(),
        address_number: number.trim(),
        address_complement: complement.trim(),
        address_neighborhood: neighborhood.trim(),
        address_city: city.trim(),
        address_state: state.trim(),
        address_zipcode: zipcode.trim(),
        business_hours: week,
        holidays,
        timezone,
      })
      toast({
        title: 'Cadastro salvo',
        description:
          'Empresa operadora atualizada — os prazos de SLA passam a respeitar o expediente.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: (err as Error).message || 'Falha ao salvar o cadastro da empresa operadora.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateDay = (day: string, patch: Partial<CompanyBusinessHour>) => {
    setWeek((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const addHoliday = () => setHolidays((prev) => [...prev, { date: '', name: '' }])

  const updateHoliday = (index: number, patch: Partial<Holiday>) =>
    setHolidays((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)))

  const removeHoliday = (index: number) => setHolidays((prev) => prev.filter((_, i) => i !== index))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando cadastro da empresa
        operadora...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dados cadastrais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Dados da Empresa Operadora
          </CardTitle>
          <CardDescription>
            Empresa que utiliza o Lógos AITSM para atender os chamados de seus clientes. Estes dados
            são usados na contabilidade do SLA e em relatórios oficiais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Razão social *</Label>
              <Input
                id="legal-name"
                value={legalName}
                onChange={(ev) => setLegalName(ev.target.value)}
                disabled={isReadOnly}
                placeholder="Razão social completa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-name">Nome fantasia</Label>
              <Input
                id="trade-name"
                value={tradeName}
                onChange={(ev) => setTradeName(ev.target.value)}
                disabled={isReadOnly}
                placeholder="Nome comercial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(ev) => setCnpj(ev.target.value)}
                disabled={isReadOnly}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                disabled={isReadOnly}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={isReadOnly}
                placeholder="contato@empresa.com.br"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street">Logradouro</Label>
            <Input
              id="street"
              value={street}
              onChange={(ev) => setStreet(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={number}
              onChange={(ev) => setNumber(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={complement}
              onChange={(ev) => setComplement(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={neighborhood}
              onChange={(ev) => setNeighborhood(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={city}
              onChange={(ev) => setCity(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">UF</Label>
            <Input
              id="state"
              value={state}
              onChange={(ev) => setState(ev.target.value)}
              disabled={isReadOnly}
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipcode">CEP</Label>
            <Input
              id="zipcode"
              value={zipcode}
              onChange={(ev) => setZipcode(ev.target.value)}
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horário de funcionamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Horário de Funcionamento
          </CardTitle>
          <CardDescription>
            O SLA só é contabilizado dentro do expediente. Fora dele (noite, folgas e feriados) o
            relógio do chamado fica parado. Sem expediente cadastrado, o sistema usa calendário
            contínuo 24x7. Fuso horário: America/Sao_Paulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(week).map(([day, value]) => (
            <div
              key={day}
              className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:gap-4"
            >
              <div className="flex items-center gap-2 md:w-48">
                <Switch
                  checked={value.enabled}
                  onCheckedChange={(checked) => updateDay(day, { enabled: checked })}
                  disabled={isReadOnly}
                />
                <span className="text-sm font-medium">{WEEKDAY_LABELS[Number(day)]}</span>
              </div>
              {value.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={value.start}
                    onChange={(ev) => updateDay(day, { start: ev.target.value })}
                    disabled={isReadOnly}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={value.end}
                    onChange={(ev) => updateDay(day, { end: ev.target.value })}
                    disabled={isReadOnly}
                    className="w-28"
                  />
                </div>
              ) : (
                <Badge variant="outline">Não funciona</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Feriados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Feriados
          </CardTitle>
          <CardDescription>
            Datas em que a empresa operadora não atende — o relógio do SLA fica parado. Aceita data
            completa (AAAA-MM-DD) ou recorrente (DD/MM, repete todo ano).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {holidays.map((holiday, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="date"
                value={holiday.date && /^\d{4}-/.test(holiday.date) ? holiday.date : ''}
                onChange={(ev) => updateHoliday(index, { date: ev.target.value })}
                disabled={isReadOnly}
                className="w-44"
                placeholder="AAAA-MM-DD"
              />
              <Input
                type="text"
                value={/^\d{4}-/.test(holiday.date || '') ? '' : holiday.date}
                onChange={(ev) => updateHoliday(index, { date: ev.target.value })}
                disabled={isReadOnly}
                className="w-28"
                placeholder="25/12"
              />
              <Input
                value={holiday.name}
                onChange={(ev) => updateHoliday(index, { name: ev.target.value })}
                disabled={isReadOnly}
                placeholder="Descrição do feriado"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeHoliday(index)}
                disabled={isReadOnly}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addHoliday} disabled={isReadOnly}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar feriado
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || isReadOnly}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar cadastro
        </Button>
      </div>
    </div>
  )
}
