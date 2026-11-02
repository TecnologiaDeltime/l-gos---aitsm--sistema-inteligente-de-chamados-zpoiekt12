import { Badge } from '@/components/ui/badge'

interface AvailabilityStatusBadgeProps {
  status?: string | null
  className?: string
}

export function AvailabilityStatusBadge({ status, className }: AvailabilityStatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={`text-slate-400 border-slate-300 dark:border-slate-700 ${className || ''}`}
      >
        N/D
      </Badge>
    )
  }

  // Opções: Em uso, Obsoleto, Descartado, Disponível, Em Estoque
  switch (status) {
    case 'Em uso':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 ${className || ''}`}
        >
          Em uso
        </Badge>
      )
    case 'Disponível':
      return (
        <Badge
          variant="outline"
          className={`bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 ${className || ''}`}
        >
          Disponível
        </Badge>
      )
    case 'Em Estoque':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 ${className || ''}`}
        >
          Em Estoque
        </Badge>
      )
    case 'Obsoleto':
      return (
        <Badge
          variant="outline"
          className={`bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 ${className || ''}`}
        >
          Obsoleto
        </Badge>
      )
    case 'Descartado':
      return (
        <Badge
          variant="outline"
          className={`bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 ${className || ''}`}
        >
          Descartado
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      )
  }
}
