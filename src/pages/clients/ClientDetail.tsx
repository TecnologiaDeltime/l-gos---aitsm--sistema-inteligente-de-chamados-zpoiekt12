import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCompany } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'

export default function ClientDetail() {
  const [code, setCode] = useState(`CLI-${Math.floor(100 + Math.random() * 900)}`)
  const [tradeName, setTradeName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [document, setDocument] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')

  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createCompany({
      code,
      trade_name: tradeName,
      legal_name: legalName,
      document,
      email,
      phone,
      address_city: city,
      status: 'Ativo',
    })
    toast({ title: 'Cliente cadastrado com sucesso!' })
    navigate('/clients')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Cadastrar Novo Cliente</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Código Interno</label>
              <Input required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">CNPJ / CPF</label>
              <Input
                required
                placeholder="00.000.000/0001-00"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Nome Fantasia</label>
            <Input
              required
              placeholder="Ex: Acme Corp"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Razão Social</label>
            <Input
              required
              placeholder="Ex: Acme Indústria S/A"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">E-mail</label>
              <Input
                type="email"
                placeholder="contato@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Telefone</label>
              <Input
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Cidade</label>
            <Input placeholder="São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Salvar Cliente
          </Button>
        </form>
      </div>
    </div>
  )
}
