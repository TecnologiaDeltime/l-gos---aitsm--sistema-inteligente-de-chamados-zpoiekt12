import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getContracts, ContractRecord } from '@/services/contracts'

export default function ContractList() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])

  useEffect(() => {
    getContracts()
      .then(setContracts)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Gestão de Contratos</h2>
        <Link to="/contracts/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contracts.map((ct) => (
          <div
            key={ct.id}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{ct.number}</p>
                <p className="text-xs text-slate-500">
                  {ct.expand?.company?.trade_name || 'Cliente Geral'}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t">
              <p>Tipo: {ct.type}</p>
              <p>Horas Mensais: {ct.monthly_hours || 0}h</p>
              <p>SLA Solução: {ct.sla_solution_time || 240} minutos</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
