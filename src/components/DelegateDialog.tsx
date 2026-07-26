import { useState, useEffect } from 'react'
import { Users, FolderTree, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUsers, UserItem } from '@/services/users'
import { getQueues, QueueRecord } from '@/services/queues'
import { delegateTicket } from '@/services/tickets'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface DelegateDialogProps {
  ticketId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelegated: () => void
}

export function DelegateDialog({ ticketId, open, onOpenChange, onDelegated }: DelegateDialogProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'technician' | 'queue'>('technician')
  const [users, setUsers] = useState<UserItem[]>([])
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedId('')
    setReason('')
    getUsers("(role = 'tecnico' || role = 'gestor' || role = 'admin') && active = true")
      .then(setUsers)
      .catch(() => {})
    getQueues()
      .then((qs) => setQueues(qs.filter((q) => q.active !== false)))
      .catch(() => {})
  }, [open])

  const handleConfirm = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      await delegateTicket(ticketId, mode, selectedId, reason || undefined)
      toast({
        title:
          mode === 'technician'
            ? 'Chamado delegado para o operador!'
            : 'Chamado delegado para a equipe!',
      })
      onOpenChange(false)
      setSelectedId('')
      setReason('')
      onDelegated()
    } catch (err) {
      toast({
        title: 'Erro ao delegar chamado. Tente novamente.',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delegar Chamado</DialogTitle>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as 'technician' | 'queue')
            setSelectedId('')
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="technician">
              <Users className="mr-1.5 h-4 w-4" /> Delegar para Operador
            </TabsTrigger>
            <TabsTrigger value="queue">
              <FolderTree className="mr-1.5 h-4 w-4" /> Delegar para Equipe
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Command className="rounded-lg border">
          <CommandInput
            placeholder={mode === 'technician' ? 'Selecione o operador' : 'Selecione a equipe'}
          />
          <CommandList className="max-h-[220px]">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {mode === 'technician' ? (
              <CommandGroup>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.name || ''} ${u.email || ''}`}
                    onSelect={() => setSelectedId(u.id)}
                  >
                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{u.name || 'Sem nome'}</span>
                        <span className="text-xs text-slate-500">{u.email}</span>
                      </div>
                      {selectedId === u.id && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandGroup>
                {queues.map((q) => (
                  <CommandItem key={q.id} value={q.name || ''} onSelect={() => setSelectedId(q.id)}>
                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{q.name}</span>
                        {q.description && (
                          <span className="text-xs text-slate-500">{q.description}</span>
                        )}
                      </div>
                      {selectedId === q.id && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600 dark:text-slate-400">
            Motivo da delegação (opcional)
          </Label>
          <Input
            placeholder="ex: sobrecarga, especialidade técnica"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
