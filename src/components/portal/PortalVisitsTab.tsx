import React, { useState } from 'react'
import {
  CalendarDays,
  Clock,
  UserCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Car,
  FileText,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TechnicalVisitRecord } from '@/services/technical-visits'
import { formatDateTime } from '@/lib/date-format'

interface PortalVisitsTabProps {
  visits: TechnicalVisitRecord[]
  loading: boolean
  onOpenTicket: (ticket: any) => void
}

export default function PortalVisitsTab({ visits, loading, onOpenTicket }: PortalVisitsTabProps) {
  const [filter, setFilter] = useState<'Agendadas' | 'Todas'>('Agendadas')

  const scheduledVisits = visits.filter(
    (v) => v.status === 'Agendada' || v.status === 'Em Andamento',
  )
  const displayVisits = filter === 'Agendadas' ? scheduledVisits : visits

  const formatVisitDate = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return 'Data a confirmar'
    try {
      const d = new Date(dateStr)
      const formatted = d.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      return timeStr ? `${formatted} às ${timeStr}` : formatted
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-base text-foreground">Visitas Técnicas Presenciais</h3>
            {scheduledVisits.length > 0 && (
              <Badge className="bg-amber-500 text-slate-900 font-bold text-xs">
                {scheduledVisits.length} agendada{scheduledVisits.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe os atendimentos presenciais programados, com data, horário e identificação do
            técnico responsável.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant={filter === 'Agendadas' ? 'default' : 'outline'}
            className={
              filter === 'Agendadas'
                ? 'bg-amber-600 hover:bg-amber-700 text-white text-xs h-8'
                : 'text-xs h-8'
            }
            onClick={() => setFilter('Agendadas')}
          >
            Próximas Visitas ({scheduledVisits.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'Todas' ? 'default' : 'outline'}
            className={
              filter === 'Todas'
                ? 'bg-amber-600 hover:bg-amber-700 text-white text-xs h-8'
                : 'text-xs h-8'
            }
            onClick={() => setFilter('Todas')}
          >
            Histórico Completo ({visits.length})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl">
          Carregando agenda de visitas técnicas...
        </div>
      ) : displayVisits.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl space-y-2">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto opacity-60" />
          <p className="font-semibold text-sm text-foreground">
            {filter === 'Agendadas'
              ? 'Nenhuma visita técnica agendada no momento'
              : 'Nenhum histórico de visitas registrado'}
          </p>
          <p className="text-muted-foreground">
            Se precisar de atendimento presencial, abra um chamado solicitando visita técnica.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {displayVisits.map((visit) => {
            const ticket = visit.expand?.ticket
            const technician = visit.expand?.technician
            const isScheduled = visit.status === 'Agendada'
            const isInProgress = visit.status === 'Em Andamento'
            const isCompleted = visit.status === 'Concluída'

            const techName = technician?.name || 'Técnico em definição'
            const techPhone = technician?.phone || technician?.mobile || ''

            return (
              <Card
                key={visit.id}
                className={`bg-card border transition-colors shadow-2xs ${
                  isInProgress
                    ? 'border-emerald-500/50'
                    : isScheduled
                      ? 'border-amber-500/40 hover:border-amber-500'
                      : 'opacity-85'
                }`}
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={
                          isInProgress
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : isScheduled
                              ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                              : isCompleted
                                ? 'bg-stone-500/15 text-stone-600 dark:text-stone-300 border-stone-500/30'
                                : 'bg-muted text-muted-foreground'
                        }
                      >
                        {visit.status}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {visit.appointment_type || 'Visita Técnica'}
                      </Badge>
                    </div>

                    {ticket && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 h-7 px-2 gap-1"
                        onClick={() => onOpenTicket(ticket)}
                      >
                        <FileText className="h-3 w-3" />
                        Chamado #{ticket.number}
                      </Button>
                    )}
                  </div>

                  <div>
                    <CardTitle className="text-sm font-bold text-foreground line-clamp-2">
                      {visit.visit_reason || ticket?.title || 'Atendimento Presencial'}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatVisitDate(visit.scheduled_date, visit.scheduled_time)}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
                  {/* Bloco do Técnico Designado */}
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                        {techName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                          Técnico Designado
                        </span>
                        <span className="font-semibold text-foreground">{techName}</span>
                      </div>
                    </div>
                    {techPhone && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {techPhone}
                      </span>
                    )}
                  </div>

                  {/* Endereço / Local da Visita */}
                  {visit.client_address && (
                    <div className="flex items-start gap-1.5 text-muted-foreground text-[11px]">
                      <MapPin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{visit.client_address}</span>
                    </div>
                  )}

                  {/* Detalhes de Check-in/Check-out se realizado */}
                  {(visit.checkin_at || visit.checkout_at) && (
                    <div className="pt-2 border-t border-border/50 text-[11px] grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>
                        <span>Chegada (Check-in):</span>
                        <strong className="block text-foreground">
                          {visit.checkin_at ? formatDateTime(visit.checkin_at) : 'Pendente'}
                        </strong>
                      </div>
                      <div>
                        <span>Saída (Check-out):</span>
                        <strong className="block text-foreground">
                          {visit.checkout_at ? formatDateTime(visit.checkout_at) : 'Em andamento'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Observações da visita */}
                  {visit.notes && (
                    <p className="text-[11px] text-muted-foreground italic border-t pt-1.5 line-clamp-2">
                      "{visit.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
