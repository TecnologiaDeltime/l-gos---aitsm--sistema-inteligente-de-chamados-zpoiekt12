import { useEffect, useState } from 'react'
import { Inbox, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getQueues, createQueue, QUEUE_LEVELS, QueueRecord, QueueLevel } from '@/services/queues'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { QueueEditDialog } from '@/components/queues/QueueEditDialog'

export default function QueueManagement() {
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState<QueueLevel | ''>('')
  const [companyId, setCompanyId] = useState('')
  const [editingQueue, setEditingQueue] = useState<QueueRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const loadData = () => {
    getQueues()
      .then(setQueues)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  useRealtime('queues', () => {
    loadData()
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) {
      toast({ title: 'Informe o nome da fila', variant: 'destructive' })
      return
    }
    if (!level) {
      toast({ title: 'Selecione o nível de atendimento', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      await createQueue({
        name,
        description,
        active: true,
        distribution_rule: 'Disponibilidade',
        level,
        // Cliente é opcional: filas globais (sem empresa) atendem todos os clientes.
        // O vínculo cliente ↔ fila passa pelo contrato (distribuição de horas).
        company: companyId || undefined,
      })
      setName('')
      setDescription('')
      setLevel('')
      setCompanyId('')
      toast({ title: 'Fila criada com sucesso!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao criar fila', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = (q: QueueRecord) => {
    setEditingQueue(q)
    setEditOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Gerenciamento de Filas</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4 dark:bg-slate-900 md:col-span-1">
          <h3 className="font-semibold text-sm">Nova Fila</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome da Fila</label>
              <Input
                placeholder="Ex: Suporte N2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Descrição</label>
              <Input
                placeholder="Fila especializada em sistemas"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Nível de Atendimento <span className="text-red-500">*</span>
              </label>
              <Select value={level} onValueChange={(v) => setLevel(v as QueueLevel)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {QUEUE_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Cliente (opcional — deixe vazio para fila global)
              </label>
              <Select
                value={companyId || '__global__'}
                onValueChange={(v) => setCompanyId(v === '__global__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Global (todos os clientes)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Global (todos os clientes)</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                O vínculo do cliente com a fila é feito no contrato (distribuição de horas).
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="sm"
              disabled={creating}
            >
              <Plus className="mr-1 h-4 w-4" /> {creating ? 'Criando...' : 'Criar Fila'}
            </Button>
          </form>
        </div>

        <div className="space-y-3 md:col-span-2">
          {queues.length === 0 && (
            <div className="rounded-xl border bg-white p-8 shadow-sm text-center text-sm text-slate-400 dark:bg-slate-900">
              Nenhuma fila cadastrada.
            </div>
          )}
          {queues.map((q) => {
            const companyName =
              q.expand?.company?.trade_name ||
              companies.find((c) => c.id === q.company)?.trade_name ||
              null
            return (
              <div
                key={q.id}
                className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between dark:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      q.active
                        ? 'p-2 rounded-lg bg-blue-50 text-blue-600'
                        : 'p-2 rounded-lg bg-slate-100 text-slate-400'
                    }
                  >
                    <Inbox className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {q.name}
                      </p>
                      {q.level ? (
                        <Badge className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300">
                          {q.level}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-slate-400">
                          Sem nível
                        </Badge>
                      )}
                      {companyName && (
                        <Badge variant="outline" className="text-xs">
                          {companyName}
                        </Badge>
                      )}
                      {!companyName && (
                        <Badge
                          variant="outline"
                          className="text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          Global
                        </Badge>
                      )}
                      {!q.active && (
                        <Badge variant="outline" className="text-xs">
                          Inativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{q.description || 'Sem descrição'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.priority != null && (
                    <span className="text-xs text-slate-400">P: {q.priority}</span>
                  )}
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    {q.distribution_rule || 'Disponibilidade'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(q)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <QueueEditDialog
        queue={editingQueue}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadData}
      />
    </div>
  )
}
