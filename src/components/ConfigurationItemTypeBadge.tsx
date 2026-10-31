import { Badge } from '@/components/ui/badge'

const TYPE_CONFIG: Record<string, string> = {
  Impressora:
    'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-700',
  Roteador:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  'Access Point':
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  Switch:
    'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  Servidor:
    'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  'Storage/NAS':
    'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-700',
  Firewall:
    'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  'No-Break':
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  'Telefone IP':
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  Scanner:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  Projetor:
    'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  Monitor:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  Estabilizador:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800',
  'Câmera IP':
    'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  Controladora:
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-800',
  Rack: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-700',
  Outros:
    'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

export function ConfigurationItemTypeBadge({ type }: { type?: string }) {
  const cls =
    TYPE_CONFIG[type || ''] ||
    'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {type || 'N/A'}
    </Badge>
  )
}
