import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { getClientHoursHistory, type MonthlyHoursData } from '@/services/client-hours-history'
import { useTheme } from '@/hooks/use-theme'
import { useRealtime } from '@/hooks/use-realtime'
import { formatSeconds } from '@/lib/duration'
import { AlertCircle, RefreshCw, History } from 'lucide-react'

function HistoryTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0]?.payload as MonthlyHoursData
  if (!data) return null
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md">
      <p className="text-xs font-semibold mb-1">{data.month}</p>
      <p className="text-xs text-muted-foreground">
        Consumido: <span className="font-bold text-foreground">{formatSeconds(data.consumed)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Contratado:{' '}
        <span className="font-bold text-foreground">{formatSeconds(data.contracted)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Uso: <span className="font-bold text-foreground">{data.percentage.toFixed(1)}%</span>
      </p>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  clientName: string
}

export function ClientHoursHistoryDialog({ open, onClose, companyId, clientName }: Props) {
  const [data, setData] = useState<MonthlyHoursData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getClientHoursHistory(companyId)
      setData(result)
    } catch {
      setError('Falha ao carregar histórico. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (open && companyId) load()
  }, [open, companyId, load])

  useRealtime('contract_periods', () => {
    if (open) load()
  })

  const consumedColor = theme === 'dark' ? '#eab308' : '#475569'
  const contractedColor = theme === 'dark' ? '#64748b' : '#94a3b8'

  const chartConfig: ChartConfig = {
    consumed: { label: 'Consumido', color: consumedColor },
    contracted: { label: 'Contratado', color: contractedColor },
  }

  const hasData = data.some((d) => d.consumed > 0 || d.contracted > 0)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Consumo — {clientName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <Skeleton className="h-[300px] w-full rounded-lg" />
        ) : error ? (
          <div className="text-center py-8 space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
            </Button>
          </div>
        ) : !hasData ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum período encontrado para este cliente.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-[350px] w-full min-w-[400px] max-w-[90vw]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip content={<HistoryTooltip />} />
                <Bar dataKey="consumed" name="Consumido" fill={consumedColor} radius={4} />
                <Line
                  dataKey="contracted"
                  name="Contratado"
                  stroke={contractedColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </DialogContent>
    </Dialog>
  )
}
