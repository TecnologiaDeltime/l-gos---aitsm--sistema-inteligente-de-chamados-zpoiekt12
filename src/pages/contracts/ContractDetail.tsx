import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createContract } from '@/services/contracts'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'

export default function ContractDetail() {
  const [number, setNumber] = useState(`CT-2024-${Math.floor(100 + Math.random() * 900)}`)
  const [company, setCompany] = useState('')
  const [type, setType] = useState('Pacote Mensal')
  const [hours, setHours] = useState('100')
  const [companies, setCompanies] = useState<CompanyRecord[]>([])

  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' })
      return
    }

    await createContract({
      number,
      company,
      type,
      monthly_hours: parseInt(hours, 10),
      status: 'Ativo',
      sla_response_time: 30,
      sla_solution_time: 240,
    })

    toast({ title: 'Contrato salvo com sucesso!' })
    navigate('/contracts')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Novo Contrato</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Número do Contrato</label>
            <Input required value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Empresa / Cliente</label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Tipo de Contrato</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pacote Mensal">Pacote Mensal</SelectItem>
                  <SelectItem value="Por Chamado">Por Chamado</SelectItem>
                  <SelectItem value="Banco de Horas">Banco de Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Horas Mensais</label>
              <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Salvar Contrato
          </Button>
        </form>
      </div>
    </div>
  )
}
