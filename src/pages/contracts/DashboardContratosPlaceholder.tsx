import { Construction } from 'lucide-react'

export default function DashboardContratosPlaceholder() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Dashboard de Contratos</h2>
      <div className="rounded-xl border bg-card p-12 text-center space-y-3">
        <Construction className="h-12 w-12 text-muted-foreground/50 mx-auto" />
        <p className="text-muted-foreground">Página em desenvolvimento</p>
      </div>
    </div>
  )
}
