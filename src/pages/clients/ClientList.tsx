import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Building2, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'

export default function ClientList() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const data = await getCompanies()
      setCompanies(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('companies', () => {
    loadData()
  })

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

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p>Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
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
                <Link to={`/clients/${c.id}/edit`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t">
                <p>Razão Social: {c.legal_name}</p>
                <p>Cidade: {c.address_city || 'N/A'}</p>
                <p>E-mail: {c.email || 'N/A'}</p>
              </div>

              <div className="pt-1">
                <Badge
                  variant={c.status === 'Ativo' ? 'default' : 'secondary'}
                  className={
                    c.status === 'Ativo'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-200'
                  }
                >
                  {c.status || 'Ativo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando clientes...
        </div>
      )}
    </div>
  )
}
