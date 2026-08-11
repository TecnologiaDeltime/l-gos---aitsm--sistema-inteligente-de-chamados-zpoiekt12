import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Download } from 'lucide-react'
import { getServiceOrders } from '@/services/visit-extras'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const loadData = () => {
    getServiceOrders()
      .then(setOrders)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('service_orders', () => loadData())

  const getFileUrl = (record: any, field: string) => {
    if (!record[field]) return null
    return pb.files.getURL(record, record[field])
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <FileText className="h-5 w-5" /> Ordens de Serviço
      </h2>
      <div className="grid gap-3">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhuma ordem de serviço gerada.
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{o.order_number}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {o.expand?.visit?.status || '-'}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    {o.generated_at ? new Date(o.generated_at).toLocaleString('pt-BR') : '-'} ·
                    Técnico: {o.expand?.technician?.name || '-'} · Ticket:{' '}
                    {o.expand?.ticket?.number || '-'}
                  </div>
                </div>
                {getFileUrl(o, 'pdf_file') && (
                  <a
                    href={getFileUrl(o, 'pdf_file')!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </a>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
