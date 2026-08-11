import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PenTool } from 'lucide-react'
import { getClientSignatures, getServiceOrders } from '@/services/visit-extras'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'

export default function ClientSignaturesPage() {
  const [signatures, setSignatures] = useState<any[]>([])

  const loadData = async () => {
    try {
      const orders = await getServiceOrders()
      const allSigs: any[] = []
      for (const o of orders) {
        try {
          const sigs = await getClientSignatures(o.visit)
          allSigs.push(...sigs)
        } catch {
          /* intentionally ignored */
        }
      }
      setSignatures(allSigs)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('client_signatures', () => loadData())

  const getSigUrl = (record: any) => {
    if (!record.signature_image) return null
    return pb.files.getURL(record, record.signature_image)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <PenTool className="h-5 w-5" /> Assinaturas do Cliente
      </h2>
      <div className="grid gap-3">
        {signatures.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhuma assinatura registrada.
            </CardContent>
          </Card>
        ) : (
          signatures.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{s.signer_name}</span>
                    {s.signature_method && (
                      <Badge variant="outline" className="text-[9px]">
                        {s.signature_method}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Doc: {s.signer_document || '-'} ·
                    {s.signed_at ? new Date(s.signed_at).toLocaleString('pt-BR') : '-'}
                  </div>
                </div>
                {getSigUrl(s) && (
                  <img
                    src={getSigUrl(s)!}
                    alt="Assinatura"
                    className="h-12 w-auto border rounded"
                  />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
