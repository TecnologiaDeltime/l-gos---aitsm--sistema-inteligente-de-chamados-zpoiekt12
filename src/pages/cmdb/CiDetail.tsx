import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getEquipment,
  getEquipmentTickets,
  getEquipmentAuditLogs,
  EquipmentRecord,
} from '@/services/equipments'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { CiDetailInfo } from '@/pages/cmdb/CiDetailInfo'
import { CiDetailDocuments } from '@/pages/cmdb/CiDetailDocuments'
import { CiDetailRelationships } from '@/pages/cmdb/CiDetailRelationships'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'

export default function CiDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [equipment, setEquipment] = useState<EquipmentRecord | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const loadData = () => {
    if (!id) return
    getEquipment(id)
      .then(setEquipment)
      .catch(() => {})
    getEquipmentTickets(id)
      .then(setTickets)
      .catch(() => {})
    getEquipmentAuditLogs(id)
      .then(setAuditLogs)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('equipments', () => loadData())

  if (!equipment)
    return <div className="p-8 text-center text-slate-500">Carregando detalhes do ativo...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{equipment.name}</h2>
          <p className="text-sm text-slate-500">
            {[equipment.manufacturer, equipment.model].filter(Boolean).join(' ') ||
              'Sem fabricante'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CiStatusBadge status={equipment.status} />
          <span className="text-xs text-slate-400">
            Nº Série: {equipment.serial_number || 'N/A'}
          </span>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent h-auto flex-wrap">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="relationships">Relacionamentos</TabsTrigger>
          <TabsTrigger value="tickets">Histórico de Chamados</TabsTrigger>
          <TabsTrigger value="history">Histórico de Alterações</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <CiDetailInfo equipment={equipment} onUpdate={loadData} />
        </TabsContent>
        <TabsContent value="documents">
          <CiDetailDocuments equipmentId={id!} userId={user?.id || ''} />
        </TabsContent>
        <TabsContent value="relationships">
          <CiDetailRelationships equipmentId={id!} />
        </TabsContent>

        <TabsContent value="tickets">
          <div className="rounded-xl border bg-white overflow-hidden dark:bg-slate-900">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Nº</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Abertura</th>
                  <th className="p-3">Resolução</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      Nenhum chamado vinculado.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <Link to={`/tickets/${t.id}`} className="font-bold text-blue-600">
                          #{t.number}
                        </Link>
                      </td>
                      <td className="p-3">{t.title}</td>
                      <td className="p-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="p-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="p-3">{new Date(t.created).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        {t.resolution_date
                          ? new Date(t.resolution_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-xl border bg-white overflow-hidden dark:bg-slate-900">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Campo</th>
                  <th className="p-3">Valor Anterior</th>
                  <th className="p-3">Valor Novo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Nenhum registro.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((a) => {
                    let oldV = '-',
                      newV = '-'
                    try {
                      oldV = JSON.parse(a.old_values)?.value ?? '-'
                      newV = JSON.parse(a.new_values)?.value ?? '-'
                    } catch {
                      /* intentionally ignored */
                    }
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="p-3">{new Date(a.created).toLocaleString('pt-BR')}</td>
                        <td className="p-3">{a.expand?.user?.name || 'Sistema'}</td>
                        <td className="p-3 font-medium">{a.description || '-'}</td>
                        <td className="p-3 text-red-600">{oldV}</td>
                        <td className="p-3 text-green-600">{newV}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
