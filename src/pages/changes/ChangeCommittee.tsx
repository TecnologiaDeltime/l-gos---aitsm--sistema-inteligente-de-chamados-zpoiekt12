import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getCommittees,
  createCommittee,
  updateCommittee,
  deleteCommittee,
  type ChangeCommitteeRecord,
} from '@/services/change-committee'
import { getUsers, type UserItem } from '@/services/users'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function ChangeCommittee() {
  const { toast } = useToast()
  const [committees, setCommittees] = useState<ChangeCommitteeRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ChangeCommitteeRecord | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [freq, setFreq] = useState('')
  const [chairperson, setChairperson] = useState('')
  const [active, setActive] = useState(true)

  const loadData = () => {
    getCommittees()
      .then(setCommittees)
      .catch(() => {})
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('change_committee', () => loadData())

  const openNew = () => {
    setEditTarget(null)
    setName('')
    setDesc('')
    setFreq('')
    setChairperson('')
    setActive(true)
    setOpen(true)
  }
  const openEdit = (c: ChangeCommitteeRecord) => {
    setEditTarget(c)
    setName(c.name)
    setDesc(c.description || '')
    setFreq(c.meeting_frequency || '')
    setChairperson(c.chairperson || '')
    setActive(c.active ?? true)
    setOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editTarget) {
        await updateCommittee(editTarget.id, {
          name,
          description: desc,
          meeting_frequency: freq,
          chairperson: chairperson || undefined,
          active,
        })
        toast({ title: 'Comitê atualizado!' })
      } else {
        await createCommittee({
          name,
          description: desc,
          meeting_frequency: freq,
          chairperson: chairperson || undefined,
          active,
        })
        toast({ title: 'Comitê criado!' })
      }
      setOpen(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    await deleteCommittee(id)
    loadData()
    toast({ title: 'Comitê removido' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" /> Comitê de Mudanças
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo Comitê
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {committees.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{c.name}</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{c.description || 'Sem descrição'}</p>
            {c.meeting_frequency && (
              <p className="text-xs text-muted-foreground">Frequência: {c.meeting_frequency}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {(c.expand?.members || []).slice(0, 5).map((m: any) => (
                <Badge key={m.id} variant="outline" className="text-[10px]">
                  {m.name}
                </Badge>
              ))}
              {(c.expand?.members || []).length > 5 && (
                <Badge variant="outline" className="text-[10px]">
                  +{(c.expand?.members || []).length - 5}
                </Badge>
              )}
            </div>
            {c.expand?.chairperson && (
              <p className="text-xs">Presidente: {c.expand.chairperson.name}</p>
            )}
          </div>
        ))}
        {committees.length === 0 && (
          <p className="text-center text-sm text-slate-500 col-span-full py-8">
            Nenhum comitê cadastrado.
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Comitê' : 'Novo Comitê'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Frequência de Reuniões</Label>
              <Input
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                placeholder="Ex: Semanal - Quartas 10h"
              />
            </div>
            <div>
              <Label className="text-xs">Presidente</Label>
              <Select value={chairperson} onValueChange={setChairperson}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-xs">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
