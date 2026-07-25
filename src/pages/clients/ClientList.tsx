import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCompanies, CompanyRecord } from '@/services/companies'

export default function ClientList() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Gestão de Clientes</h2>
        <Link to="/clients/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{c.trade_name}</p>
                <p className="text-xs text-slate-500">
                  {c.code} - {c.document}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t">
              <p>Razão Social: {c.legal_name}</p>
              <p>Cidade: {c.address_city || 'N/A'}</p>
              <p>E-mail: {c.email || 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
