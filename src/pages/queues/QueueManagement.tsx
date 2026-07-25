import { useEffect, useState } from 'react'
import { Inbox, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getQueues, createQueue, QueueRecord } from '@/services/queues'
import { useToast } from '@/hooks/use-toast'

export default function QueueManagement() {
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { toast } = useToast()

  const loadData = () => {
    getQueues()
      .then(setQueues)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    await createQueue({ name, description, active: true, distribution_rule: 'Disponibilidade' })
    setName('')
    setDescription('')
    toast({ title: 'Fila criada com sucesso!' })
    loadData()
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
          {queues.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{q.name}</p>
                  <p className="text-xs text-slate-500">{q.description || 'Sem descrição'}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                {q.distribution_rule || 'Disponibilidade'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
