import { BarChart3, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ReportsPage() {
  const reports = [
    { title: 'Chamados por Período', desc: 'Volume de abertura e solução ao longo do tempo.' },
    { title: 'Cumprimento de SLA', desc: 'Percentual de cumprimento dos prazos por cliente.' },
    { title: 'Desempenho por Técnico', desc: 'Horas trabalhadas e resoluções por analista.' },
    { title: 'Apuração de Horas de Contrato', desc: 'Consumo de horas contratadas vs excedentes.' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Relatórios Gerenciais</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">{r.title}</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">{r.desc}</p>
              <Button size="sm" variant="outline" className="w-full">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV / Visualizar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
