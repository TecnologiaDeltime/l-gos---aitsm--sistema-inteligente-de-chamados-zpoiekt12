import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { QueueRecord, QueueLevel, QUEUE_LEVELS, updateQueue } from '@/services/queues'
import { getUsers, UserItem } from '@/services/users'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

const DISTRIBUTION_RULES = ['Disponibilidade', 'Menor Carga', 'Rodízio', 'Especialidade']

interface QueueEditDialogProps {
  queue: QueueRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function QueueEditDialog({ queue, open, onOpenChange, onSaved }: QueueEditDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [distributionRule, setDistributionRule] = useState('Disponibilidade')
  const [priority, setPriority] = useState(0)
  const [active, setActive] = useState(true)
  const [members, setMembers] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [level, setLevel] = useState<QueueLevel | ''>('')
  const [companyId, setCompanyId] = useState('')
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [allCategories, setAllCategories] = useState<CategoryRecord[]>([])
  const [allCompanies, setAllCompanies] = useState<CompanyRecord[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (queue && open) {
      setName(queue.name || '')
      setDescription(queue.description || '')
      setDistributionRule(queue.distribution_rule || 'Disponibilidade')
      setPriority(queue.priority ?? 0)
      setActive(queue.active ?? true)
      setMembers(queue.members ?? [])
      setCategories(queue.categories ?? [])
      setLevel((queue.level as QueueLevel) || '')
      setCompanyId(queue.company || '')
      setFieldErrors({})
    }
  }, [queue, open])

  useEffect(() => {
    if (open) {
      getUsers()
        .then(setAllUsers)
        .catch(() => {})
      getCategories()
        .then(setAllCategories)
        .catch(() => {})
      getCompanies()
        .then(setAllCompanies)
        .catch(() => {})
    }
  }, [open])

  const toggleMember = (id: string) => {
    setMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const toggleCategory = (id: string) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const handleSave = async () => {
    if (!queue) return
    if (!level) {
      setFieldErrors({ level: 'Selecione o nível de atendimento.' })
      return
    }
    if (!companyId) {
      setFieldErrors({ company: 'Selecione a empresa.' })
      return
    }
    setSaving(true)
    setFieldErrors({})
    try {
      await updateQueue(queue.id, {
        name,
        description,
        distribution_rule: distributionRule,
        priority,
        active,
        members,
        categories,
        level,
        company: companyId,
      })
      toast({ title: 'Fila atualizada com sucesso!' })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      const errors = extractFieldErrors(err)
      setFieldErrors(errors)
      toast({
        title: 'Erro ao atualizar fila',
        description: 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const memberNames = allUsers.filter((u) => members.includes(u.id))
  const categoryNames = allCategories.filter((c) => categories.includes(c.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Fila</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Nome da Fila</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            {fieldErrors.description && (
              <p className="text-xs text-red-500">{fieldErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Nível de Atendimento <span className="text-red-500">*</span>
              </Label>
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
              {fieldErrors.level && <p className="text-xs text-red-500">{fieldErrors.level}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Empresa <span className="text-red-500">*</span>
              </Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.company && <p className="text-xs text-red-500">{fieldErrors.company}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Regra de Distribuição</Label>
              <Select value={distributionRule} onValueChange={setDistributionRule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_RULES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Prioridade</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
              {fieldErrors.priority && (
                <p className="text-xs text-red-500">{fieldErrors.priority}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} id="queue-active" />
            <Label htmlFor="queue-active" className="text-sm font-semibold">
              Ativa
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Membros</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-md border">
              {memberNames.length === 0 && (
                <span className="text-xs text-slate-400">Nenhum membro selecionado</span>
              )}
              {memberNames.map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1">
                  {m.name || m.email}
                  <button onClick={() => toggleMember(m.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border">
              {allUsers
                .filter((u) => !members.includes(u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {u.name || u.email}
                  </button>
                ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Categorias</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-md border">
              {categoryNames.length === 0 && (
                <span className="text-xs text-slate-400">Nenhuma categoria selecionada</span>
              )}
              {categoryNames.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1">
                  {c.name}
                  <button onClick={() => toggleCategory(c.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border">
              {allCategories
                .filter((c) => !categories.includes(c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
