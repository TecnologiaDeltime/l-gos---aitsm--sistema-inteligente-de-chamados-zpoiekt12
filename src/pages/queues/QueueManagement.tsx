import { useEffect, useState } from 'react'
import { Inbox, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getQueues, createQueue, QueueRecord } from '@/services/queues'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { QueueEditDialog } from '@/components/queues/QueueEditDialog'

export default function QueueManagement() {
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingQueue, setEditingQueue] = useState<QueueRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const { toast } = useToast()

  const loadData = () => {
    getQueues()
      .then(setQueues)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('queues', () => {
    loadData()
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    try {
      await createQueue({ name, description, active: true, distribution_rule: 'Disponibilidade' })
      setName('')
      setDescription('')
      toast({ title: 'Fila criada com sucesso!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao criar fila', variant: 'destructive' })
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
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Criar Fila
            </Button>
          </form>
        </div>

        <div className="space-y-3 md:col-span-2">
          {queues.length === 0 && (
            <div className="rounded-xl border bg-white p-8 shadow-sm text-center text-sm text-slate-400 dark:bg-slate-900">
              Nenhuma fila cadastrada.
            </div>
          )}
          {queues.map((q) => (
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
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{q.name}</p>
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
          ))}
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
