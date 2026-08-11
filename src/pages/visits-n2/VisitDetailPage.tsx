import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, User, Car, FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getVisit, updateVisit, TechnicalVisitRecord } from '@/services/technical-visits'
import { getVisitTravelEntries } from '@/services/travel-entries'
import { getVisitExpenses } from '@/services/expenses'
import { getVisitTimeEntries } from '@/services/visit-time-entries'
import { getServiceOrders, getVisitChecklists } from '@/services/visit-extras'
import { getClientSignatures } from '@/services/visit-extras'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { VisitCheckInDialog } from '@/components/VisitCheckInDialog'
import { VisitCheckOutDialog } from '@/components/VisitCheckOutDialog'

const STATUS_CLS: Record<string, string> = {
  Agendada: 'bg-blue-100 text-blue-800',
  'Em Andamento': 'bg-amber-100 text-amber-800',
  Concluída: 'bg-green-100 text-green-800',
  Cancelada: 'bg-red-100 text-red-800',
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [visit, setVisit] = useState<TechnicalVisitRecord | null>(null)
  const [travel, setTravel] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [signatures, setSignatures] = useState<any[]>([])
  const [checklists, setChecklists] = useState<any[]>([])
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const loadData = () => {
    if (!id) return
    getVisit(id)
      .then(setVisit)
      .catch(() => {})
    getVisitTravelEntries(id)
      .then(setTravel)
      .catch(() => {})
    getVisitExpenses(id)
      .then(setExpenses)
      .catch(() => {})
    getVisitTimeEntries(id)
      .then(setTimeEntries)
      .catch(() => {})
    getServiceOrders(`visit = "${id}"`)
      .then(setOrders)
      .catch(() => {})
    getClientSignatures(id)
      .then(setSignatures)
      .catch(() => {})
    getVisitChecklists(id)
      .then(setChecklists)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('technical_visits', () => loadData())

  const handleCancel = async () => {
    if (!id) return
    await updateVisit(id, { status: 'Cancelada' })
    toast({ title: 'Visita cancelada' })
    loadData()
  }

  if (!visit) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <Link
        to="/visitas-n2/list"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="itsm-card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{visit.visit_reason || 'Visita Técnica'}</h2>
          <Badge className={STATUS_CLS[visit.status] || 'bg-slate-100'}>{visit.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground md:grid-cols-4">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {visit.client_address || '-'}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{' '}
            {visit.scheduled_date
              ? new Date(visit.scheduled_date).toLocaleDateString('pt-BR')
              : '-'}{' '}
            {visit.scheduled_time || ''}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" /> {visit.expand?.technician?.name || '-'}
          </div>
          <div className="flex items-center gap-1">
            <Car className="h-3 w-3" /> {visit.transport_mode || '-'}
          </div>
        </div>
        <div className="flex gap-2">
          {visit.status === 'Agendada' && (
            <Button size="sm" variant="outline" onClick={() => setCheckinOpen(true)}>
              Check-in
            </Button>
          )}
          {visit.status === 'Em Andamento' && (
            <Button size="sm" variant="outline" onClick={() => setCheckoutOpen(true)}>
              Check-out
            </Button>
          )}
          {visit.status !== 'Cancelada' && visit.status !== 'Concluída' && (
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
      <Tabs defaultValue="info">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="travel">Deslocamento ({travel.length})</TabsTrigger>
          <TabsTrigger value="expenses">Despesas ({expenses.length})</TabsTrigger>
          <TabsTrigger value="time">Tempo ({timeEntries.length})</TabsTrigger>
          <TabsTrigger value="orders">OS ({orders.length})</TabsTrigger>
          <TabsTrigger value="signatures">Assinaturas ({signatures.length})</TabsTrigger>
          <TabsTrigger value="checklists">Checklists ({checklists.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="pt-4">
          <Card>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div>
                  <span className="text-slate-400">Tipo:</span> {visit.appointment_type || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Prioridade:</span> {visit.priority || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Duração Est.:</span>{' '}
                  {visit.estimated_duration || '-'} min
                </div>
                <div>
                  <span className="text-slate-400">Contato:</span> {visit.client_contact || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Telefone:</span> {visit.contact_phone || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Equipe:</span> {visit.team || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Região:</span> {visit.region || '-'}
                </div>
                <div>
                  <span className="text-slate-400">Veículo:</span> {visit.vehicle_plate || '-'}
                </div>
                <div>
                  <span className="text-slate-400">KM:</span>{' '}
                  {visit.calculated_mileage?.toFixed(1) || '0'}
                </div>
              </div>
              {visit.notes && (
                <div className="pt-2 border-t">
                  <span className="text-slate-400">Observações:</span> {visit.notes}
                </div>
              )}
              {visit.checkin_at && (
                <div className="pt-2 border-t">
                  <span className="text-slate-400">Check-in:</span>{' '}
                  {new Date(visit.checkin_at).toLocaleString('pt-BR')}
                </div>
              )}
              {visit.checkout_at && (
                <div>
                  <span className="text-slate-400">Check-out:</span>{' '}
                  {new Date(visit.checkout_at).toLocaleString('pt-BR')}
                </div>
              )}
              {visit.result && (
                <div className="pt-2 border-t">
                  <span className="text-slate-400">Resultado:</span> {visit.result}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="travel" className="pt-4 space-y-2">
          {travel.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhum deslocamento.</p>
          ) : (
            travel.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {t.origin_address || '?'} → {t.destination_address || '?'}
                    </span>
                    <span>{t.actual_distance?.toFixed(1) || 0}km</span>
                  </div>
                  <div className="text-slate-500">
                    {t.travel_date ? new Date(t.travel_date).toLocaleDateString('pt-BR') : '-'} ·{' '}
                    {t.transport_mode || '-'}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="expenses" className="pt-4 space-y-2">
          {expenses.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhuma despesa.</p>
          ) : (
            expenses.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3 text-xs flex justify-between">
                  <div>
                    <span className="font-medium">{e.expense_type}</span> · {e.supplier || '-'}
                  </div>
                  <div className="text-right">
                    <div className="font-bold">R$ {(e.value || 0).toFixed(2)}</div>
                    <Badge variant="outline" className="text-[9px]">
                      {e.approval_status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="time" className="pt-4 space-y-2">
          {timeEntries.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhum registro de tempo.</p>
          ) : (
            timeEntries.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-3 text-xs flex justify-between">
                  <div>
                    <span className="font-medium">{t.time_type}</span> · {t.classification || '-'}
                  </div>
                  <div className="text-right">{t.duration_minutes || 0} min</div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="orders" className="pt-4 space-y-2">
          {orders.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhuma ordem de serviço.</p>
          ) : (
            orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-3 text-xs flex justify-between items-center">
                  <div>
                    <FileText className="inline h-3 w-3 mr-1" />
                    <span className="font-medium">{o.order_number}</span>
                  </div>
                  <div className="text-slate-500">
                    {o.generated_at ? new Date(o.generated_at).toLocaleDateString('pt-BR') : '-'}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="signatures" className="pt-4 space-y-2">
          {signatures.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhuma assinatura.</p>
          ) : (
            signatures.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{s.signer_name}</span>
                    {s.signed_at && (
                      <span className="text-slate-500">
                        {new Date(s.signed_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500">
                    Método: {s.signature_method || '-'} · Doc: {s.signer_document || '-'}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="checklists" className="pt-4 space-y-2">
          {checklists.length === 0 ? (
            <p className="text-center text-sm text-slate-500 p-4">Nenhum checklist.</p>
          ) : (
            checklists.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 text-xs">
                  <span className="font-medium">{c.name}</span>
                  {c.all_required && (
                    <Badge variant="secondary" className="ml-2 text-[9px]">
                      Obrigatório
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      {checkinOpen && (
        <VisitCheckInDialog
          visitId={id!}
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          onDone={loadData}
        />
      )}
      {checkoutOpen && (
        <VisitCheckOutDialog
          visitId={id!}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          onDone={loadData}
        />
      )}
    </div>
  )
}
