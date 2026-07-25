import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTickets, TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'

export default function TicketList() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [contractSearch, setContractSearch] = useState('')

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .catch(() => {})
  }, [])

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.number.toLowerCase().includes(search.toLowerCase()) ||
      t.requester_name.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter

    const matchesContract =
      contractSearch === '' ||
      (t.expand?.contract?.number || '').toLowerCase().includes(contractSearch.toLowerCase()) ||
      (t.expand?.company?.trade_name || '').toLowerCase().includes(contractSearch.toLowerCase())

    return matchesSearch && matchesStatus && matchesContract
  })

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nº, título ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="relative w-40">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Contrato..."
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-1 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Novo">Novo</SelectItem>
              <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
              <SelectItem value="Aguardando Cliente">Aguardando Cliente</SelectItem>
              <SelectItem value="Resolvido">Resolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Link to="/tickets/new">
          <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Abrir Chamado
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
              <tr>
                <th className="p-3.5">Nº</th>
                <th className="p-3.5">Título</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Prioridade</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Responsável</th>
                <th className="p-3.5">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhum chamado encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                    <td className="p-3.5 font-bold text-blue-600">
                      <Link to={`/tickets/${t.id}`}>#{t.number}</Link>
                    </td>
                    <td className="p-3.5 font-medium text-slate-900 max-w-sm truncate dark:text-slate-100">
                      <Link to={`/tickets/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="p-3.5">{t.expand?.company?.trade_name || 'Geral'}</td>
                    <td className="p-3.5">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="p-3.5">{t.expand?.assigned_to?.name || 'Não atribuído'}</td>
                    <td className="p-3.5 w-36">
                      <SlaProgressBar slaStatus={t.sla_status} paused={t.sla_paused} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
