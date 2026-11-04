import React from 'react'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Layers,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PortalHoursTabProps {
  hoursData: {
    contractedHours: number
    consumedHours: number
    balanceHours: number
    percentUsed: number
    periodName: string
    hasContract: boolean
  }
  loading: boolean
  selectedMonth: number
  selectedYear: number
  onChangePeriod: (month: number, year: number) => void
}

export default function PortalHoursTab({
  hoursData,
  loading,
  selectedMonth,
  selectedYear,
  onChangePeriod,
}: PortalHoursTabProps) {
  // Lista de meses
  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  // Últimos 3 anos para o seletor
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === currentYear

  const isOverLimit = hoursData.balanceHours < 0
  const isNearLimit = hoursData.percentUsed >= 80 && !isOverLimit

  return (
    <div className="space-y-4">
      {/* Barra de controle de período */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-base text-foreground">
              Saldo e Consumo de Horas Contratadas
            </h3>
            {isCurrentMonth && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs"
              >
                Mês Atual (Padrão)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe a franquia mensal, horas consumidas pelas interações de suporte e saldo
            restante no período selecionado.
          </p>
        </div>

        {/* Seletor de Período */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => onChangePeriod(Number(val), selectedYear)}
          >
            <SelectTrigger className="w-[130px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(val) => onChangePeriod(selectedMonth, Number(val))}
          >
            <SelectTrigger className="w-[90px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isCurrentMonth && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-9"
              onClick={() => {
                const now = new Date()
                onChangePeriod(now.getMonth() + 1, now.getFullYear())
              }}
            >
              Voltar ao Mês Atual
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Horas Contratadas */}
        <Card className="bg-card/90 border border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Franquia Contratada</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </CardDescription>
            <CardTitle className="text-3xl font-black text-foreground pt-1 tracking-tight">
              {loading ? '...' : `${hoursData.contractedHours}h`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-1 text-xs text-muted-foreground font-medium">
            Período: <strong>{hoursData.periodName}</strong>
          </CardContent>
        </Card>

        {/* Card 2: Horas Consumidas */}
        <Card className="bg-card/90 border border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Horas Consumidas</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-[#D97706] dark:text-[#FCD34D] flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </CardDescription>
            <CardTitle className="text-3xl font-black text-[#D97706] dark:text-[#FCD34D] pt-1 tracking-tight">
              {loading ? '...' : `${hoursData.consumedHours}h`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-1 text-xs text-muted-foreground font-medium">
            {hoursData.contractedHours > 0
              ? `${hoursData.percentUsed}% da franquia consumida`
              : 'Atendimento faturável sob demanda'}
          </CardContent>
        </Card>

        {/* Card 3: Saldo Restante */}
        <Card className="bg-card/90 border border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Saldo Restante</span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  isOverLimit
                    ? 'bg-rose-500/10 text-rose-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}
              >
                {isOverLimit ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>
            </CardDescription>
            <CardTitle
              className={`text-3xl font-black pt-1 tracking-tight ${
                isOverLimit
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {loading ? '...' : `${hoursData.balanceHours}h`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-1 text-xs text-muted-foreground font-medium">
            {isOverLimit ? 'Atenção: Limite mensal excedido' : 'Saldo disponível para utilização'}
          </CardContent>
        </Card>
      </div>

      {/* Barra de Progresso do Consumo */}
      <Card className="bg-card/90 border border-border/80 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Aproveitamento da Franquia no Mês ({hoursData.periodName})
          </span>
          <span className="font-extrabold text-foreground px-2 py-0.5 rounded-md bg-muted">
            {hoursData.percentUsed}%
          </span>
        </div>

        <div className="h-3 w-full bg-muted/80 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverLimit ? 'bg-rose-500' : isNearLimit ? 'bg-[#D97706]' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, hoursData.percentUsed)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>0h</span>
          <span>
            {hoursData.consumedHours}h de {hoursData.contractedHours}h
          </span>
          <span>{hoursData.contractedHours}h</span>
        </div>
      </Card>

      {/* Alerta de Contrato ou Limite */}
      {isOverLimit && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Franquia Mensal Excedida</p>
            <p>
              As horas consumidas no período ultrapassaram o total contratado. As horas adicionais
              podem ser faturadas como excedentes de acordo com a política do seu contrato.
            </p>
          </div>
        </div>
      )}

      {isNearLimit && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Atenção ao Consumo de Horas</p>
            <p>
              A sua empresa já consumiu mais de 80% das horas contratadas para este mês. Fique
              atento ao saldo restante para evitar excedentes.
            </p>
          </div>
        </div>
      )}

      {!hoursData.hasContract && (
        <div className="p-4 rounded-xl bg-muted/60 border text-xs text-muted-foreground flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <span>
            Não há franquia fixa registrada para este período ou seu modelo é por chamado /
            ilimitado. Todos os atendimentos continuam operando normalmente.
          </span>
        </div>
      )}
    </div>
  )
}
