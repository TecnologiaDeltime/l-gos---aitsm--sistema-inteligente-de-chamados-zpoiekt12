import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Shield, LogOut, PlusCircle, Ticket, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { getTickets, createTicket, TicketRecord } from '@/services/tickets'
import { getCategories, CategoryRecord } from '@/services/categories'
import { useToast } from '@/hooks/use-toast'

export default function PortalPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Incidente')
  const [category, setCategory] = useState('')
  const [impact, setImpact] = useState('Médio')
  const [urgency, setUrgency] = useState('Média')

  const loadData = async () => {
    if (!user?.company) return
    const filter = user.unit
      ? `company = "${user.company}" && unit = "${user.unit}"`
      : `company = "${user.company}"`
    try {
      const data = await getTickets(filter)
      setTickets(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
    getCategories()
      .then(setCategories)
      .catch(() => {})
  }, [user])

  useRealtime('tickets', () => {
    loadData()
  })

  if (user && user.role !== 'cliente_solicitante') {
    return <Navigate to="/dashboard" replace />
  }
  if (!user) return null

  const openCount = tickets.filter(
    (t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status),
  ).length
  const resolvedCount = tickets.filter((t) => ['Resolvido', 'Encerrado'].includes(t.status)).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTicket({
      number: 'PENDENTE',
      company: user.company!,
      unit: user.unit || undefined,
      title,
      description,
      type,
      category: category || undefined,
      impact,
      urgency,
      priority: impact === 'Alto' && urgency === 'Alta' ? 'P1' : 'P3',
      status: 'Novo',
      requester_name: user.name || 'Solicitante',
      requester_email: user.email,
      source: 'Portal',
      sla_status: 'Dentro do Prazo',
    })
    toast({ title: 'Chamado aberto com sucesso!' })
    setDialogOpen(false)
    setTitle('')
    setDescription('')
    loadData()
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">Portal do Cliente</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">{user.name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Ticket className="h-4 w-4 text-blue-600" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tickets.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-500" /> Em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{openCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" /> Resolvidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{resolvedCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Meus Chamados</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Novo Chamado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Chamado</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Tipo</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Incidente">Incidente</SelectItem>
                      <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                      <SelectItem value="Dúvida">Dúvida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Categoria</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Impacto</label>
                    <Select value={impact} onValueChange={setImpact}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alto">Alto</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Baixo">Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Urgência</label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alta">Alta</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Título</label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Resumo do problema"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Descrição</label>
                  <Textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o problema..."
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  Abrir Chamado
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b font-semibold text-slate-700">
                <tr>
                  <th className="p-3.5">Nº</th>
                  <th className="p-3.5">Título</th>
                  <th className="p-3.5">Prioridade</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Nenhum chamado encontrado.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >
                      <td className="p-3.5 font-bold text-blue-600">{t.number}</td>
                      <td className="p-3.5 font-medium text-slate-900 max-w-sm truncate">
                        {t.title}
                      </td>
                      <td className="p-3.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="p-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
