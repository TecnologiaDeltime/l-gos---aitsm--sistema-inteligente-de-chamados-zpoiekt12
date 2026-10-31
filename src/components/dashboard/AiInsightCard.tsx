import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BrainCircuit, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'

export function AiInsightCard() {
  return (
    <Card className="itsm-card border-dashed border-2 border-primary/20">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          AI Insights
          <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            Em breve
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Análise automatizada de tendências, anomalias, riscos e oportunidades de melhoria estará
          disponível em breve.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 opacity-60">
            <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">Tendências de volume de chamados</p>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 opacity-60">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">Riscos de excedimento de horas</p>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 opacity-60">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">Oportunidades de melhoria</p>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 opacity-60">
            <BrainCircuit className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Assistente conversacional para gestores
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
