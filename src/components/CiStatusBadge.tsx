import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<string, string> = {
  Planejado: 'bg-slate-100 text-slate-700 border-slate-300',
  Ativo: 'bg-green-100 text-green-800 border-green-300',
  Inativo: 'bg-gray-100 text-gray-600 border-gray-300',
  'Em Manutenção': 'bg-amber-100 text-amber-800 border-amber-300',
  Descartado: 'bg-red-100 text-red-800 border-red-300',
  Reserva: 'bg-blue-100 text-blue-800 border-blue-300',
  Emprestado: 'bg-purple-100 text-purple-800 border-purple-300',
}

export function CiStatusBadge({ status }: { status?: string }) {
  const cls = STATUS_CONFIG[status || ''] || 'bg-slate-100 text-slate-700'
  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {status || 'N/A'}
    </Badge>
  )
}
