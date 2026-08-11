import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, CheckCircle, Circle, XCircle } from 'lucide-react'
import { getVisitChecklists, getChecklistItems, updateChecklistItem } from '@/services/visit-extras'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

const ITEM_STATUS_ICON: Record<string, any> = {
  Concluído: CheckCircle,
  Pendente: Circle,
  'Não Aplicável': XCircle,
}

export default function VisitChecklistsPage() {
  const { toast } = useToast()
  const [checklists, setChecklists] = useState<any[]>([])
  const [items, setItems] = useState<Record<string, any[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newVisit, setNewVisit] = useState('')

  const loadData = async () => {
    try {
      const cls = await getVisitChecklists()
      setChecklists(cls)
      const itemsMap: Record<string, any[]> = {}
      for (const c of cls) {
        try {
          itemsMap[c.id] = await getChecklistItems(c.id)
        } catch {
          itemsMap[c.id] = []
        }
      }
      setItems(itemsMap)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('visit_checklists', () => loadData())
  useRealtime('visit_checklist_items', () => loadData())

  const handleToggle = async (item: any) => {
    const newStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído'
    await updateChecklistItem(item.id, {
      status: newStatus,
      completed_at: newStatus === 'Concluído' ? new Date().toISOString() : '',
    })
    toast({ title: `Item marcado como ${newStatus}` })
    loadData()
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await pb
        .collection('visit_checklists')
        .create({ name: newName, visit: newVisit || undefined, all_required: false })
      toast({ title: 'Checklist criado!' })
      setShowForm(false)
      setNewName('')
      setNewVisit('')
      loadData()
    } catch {
      toast({ title: 'Erro ao criar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Checklists de Visita</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Checklist
        </Button>
      </div>
      <div className="grid gap-3">
        {checklists.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhum checklist.
            </CardContent>
          </Card>
        ) : (
          checklists.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{c.name}</span>
                  {c.all_required && (
                    <Badge variant="secondary" className="text-[9px]">
                      Todos Obrigatórios
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  {(items[c.id] || []).map((item) => {
                    const Icon = ITEM_STATUS_ICON[item.status] || Circle
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 p-1 rounded"
                        onClick={() => handleToggle(item)}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${item.status === 'Concluído' ? 'text-green-600' : item.status === 'Não Aplicável' ? 'text-red-400' : 'text-slate-400'}`}
                        />
                        <span
                          className={
                            item.status === 'Concluído' ? 'line-through text-slate-400' : ''
                          }
                        >
                          {item.description}
                        </span>
                        {item.required && (
                          <Badge variant="outline" className="text-[8px] ml-auto">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                  {(items[c.id] || []).length === 0 && (
                    <p className="text-xs text-slate-400 pl-5">Sem itens</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Visita ID (opcional)</Label>
              <Input
                value={newVisit}
                onChange={(e) => setNewVisit(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
