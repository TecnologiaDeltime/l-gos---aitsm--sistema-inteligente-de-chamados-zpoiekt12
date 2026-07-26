import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<string, string> = {
  Planejado: 'bg-slate-100 text-slate-800 border-slate-300',
  Ativo: 'bg-green-100 text-green-800 border-green-300',
  Inativo: 'bg-slate-100 text-slate-600 border-slate-300',
  'Em Manutenção': 'bg-orange-100 text-orange-800 border-orange-300',
  Descartado: 'bg-red-100 text-red-800 border-red-300',
  Reserva: 'bg-blue-100 text-blue-800 border-blue-300',
  Emprestado: 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

export function CiStatusBadge({ status }: { status?: string }) {
  const cls = STATUS_CONFIG[status || ''] || 'bg-slate-100 text-slate-800 border-slate-300'
  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {status || 'N/A'}
    </Badge>
  )
}
