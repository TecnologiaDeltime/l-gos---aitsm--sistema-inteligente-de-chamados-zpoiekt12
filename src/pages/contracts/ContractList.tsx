import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PlusCircle,
  FileText,
  Pencil,
  Calendar,
  Clock,
  ShieldCheck,
  Eye,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getContracts, ContractRecord } from '@/services/contracts'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'

const statusColor: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-700 border-green-200',
  Expirado: 'bg-orange-100 text-orange-700 border-orange-200',
  Cancelado: 'bg-red-100 text-red-700 border-red-200',
}

export default function ContractList() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])

  const loadData = async () => {
    try {
      const items = await getContracts()
      setContracts(items)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('contracts', () => {
    loadData()
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Gestão de Contratos
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie contratos, SLAs e serviços</p>
        </div>
        <div className="flex gap-2">
          <Link to="/contracts/dashboard">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <Link to="/contracts/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Contrato
            </Button>
          </Link>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center dark:bg-slate-900">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum contrato cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((ct) => (
            <div
              key={ct.id}
              className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
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
                <Badge
                  className={cn(
                    'border',
                    statusColor[ct.status] || 'bg-slate-100 text-slate-600 border-slate-200',
                  )}
                  variant="outline"
                >
                  {ct.status}
                </Badge>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t">
                <p className="flex items-center gap-1.5">
                  <span className="font-semibold">Tipo:</span> {ct.type}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span className="font-semibold">Horas Mensais:</span> {ct.monthly_hours || 0}h
                </p>
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="font-semibold">SLA Solução:</span> {ct.sla_solution_time || 240}{' '}
                  min
                </p>
                {ct.start_date && ct.end_date && (
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span className="font-semibold">Vigência:</span>{' '}
                    {new Date(ct.start_date).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(ct.end_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Link to={`/contracts/${ct.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> Visualizar
                  </Button>
                </Link>
                <Link to={`/contracts/${ct.id}/edit`}>
                  <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
