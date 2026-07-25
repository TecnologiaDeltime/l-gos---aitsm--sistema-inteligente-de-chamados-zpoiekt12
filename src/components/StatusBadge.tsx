import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, string> = {
    Novo: 'bg-blue-100 text-blue-800 border-blue-300',
    'Em Triagem': 'bg-purple-100 text-purple-800 border-purple-300',
    'Aguardando Atribuição': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    Atribuído: 'bg-sky-100 text-sky-800 border-sky-300',
    'Em Atendimento': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'Aguardando Cliente': 'bg-amber-100 text-amber-800 border-amber-300',
    'Aguardando Aprovação': 'bg-orange-100 text-orange-800 border-orange-300',
    Resolvido: 'bg-green-100 text-green-800 border-green-300',
    Encerrado: 'bg-slate-100 text-slate-800 border-slate-300',
    Cancelado: 'bg-red-100 text-red-800 border-red-300',
    Reaberto: 'bg-rose-100 text-rose-800 border-rose-300',
  }

  const cls = config[status] || 'bg-slate-100 text-slate-800'

  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {status}
    </Badge>
  )
}
