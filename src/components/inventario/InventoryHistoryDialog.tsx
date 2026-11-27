// Diálogo de Histórico de Movimentação do aparelho do Inventário.
// Linha do tempo em ordem cronológica reversa: data/hora, autor, tipo e descrição.
// Com movimentação manual (inventario_gerenciar): Atribuir a / Devolvido /
// Enviar para manutenção / Observação — cada tipo com seu efeito no hook.
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  Camera,
  Loader2,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Undo2,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  InventoryDevice,
  InventoryMovement,
  InventoryMovementType,
  addInventoryMovement,
  listInventoryMovements,
} from '@/services/inventory'

const MOVEMENT_META: Record<InventoryMovementType, { label: string; className: string }> = {
  cadastrado: {
    label: 'Cadastrado',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  atribuido: {
    label: 'Atribuído',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  devolvido: {
    label: 'Devolvido',
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  manutencao: {
    label: 'Manutenção',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  editado: {
    label: 'Editado',
    className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
  },
  desativado: {
    label: 'Desativado',
    className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
  },
  reativado: {
    label: 'Reativado',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  manual: {
    label: 'Registro manual',
    className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
}

// Tipos de movimentação manual oferecidos no formulário (com efeito no hook).
const MANUAL_TYPES: Array<{
  value: InventoryMovementType
  label: string
  icon: typeof Plus
  needsOwner: boolean
}> = [
  { value: 'atribuido', label: 'Atribuir a responsável', icon: ArrowRight, needsOwner: true },
  { value: 'devolvido', label: 'Devolvido', icon: Undo2, needsOwner: false },
  { value: 'manutencao', label: 'Enviar para manutenção', icon: Wrench, needsOwner: false },
  { value: 'editado', label: 'Observação (sem efeito)', icon: Pencil, needsOwner: false },
]

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  cadastrado: 'Cadastrado',
  atribuido: 'Atribuído',
  devolvido: 'Devolvido',
  manutencao: 'Manutenção',
  editado: 'Editado',
  desativado: 'Desativado',
  reativado: 'Reativado',
  manual: 'Registro manual',
}

interface ManualFormState {
  movement_type: InventoryMovementType
  description: string
  new_owner: string
}

const EMPTY_MANUAL: ManualFormState = {
  movement_type: 'atribuido',
  description: '',
  new_owner: 'none',
}

interface OperatorOption {
  id: string
  name: string
}

function formatMovementDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

interface InventoryHistoryDialogProps {
  device: InventoryDevice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  operators: OperatorOption[]
}

export default function InventoryHistoryDialog({
  device,
  open,
  onOpenChange,
  canManage,
  operators,
}: InventoryHistoryDialogProps) {
  const { toast } = useToast()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState<ManualFormState>(EMPTY_MANUAL)
  const [saving, setSaving] = useState(false)

  const loadMovements = useCallback(
    async (deviceId: string) => {
      setLoading(true)
      try {
        const list = await listInventoryMovements(deviceId)
        setMovements(list)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar histórico'
        toast({ title: 'Erro', description: message, variant: 'destructive' })
        setMovements([])
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (open && device) {
      setShowManual(false)
      setManual(EMPTY_MANUAL)
      loadMovements(device.id)
    }
    if (!open) {
      setMovements([])
      setShowManual(false)
      setManual(EMPTY_MANUAL)
    }
  }, [open, device, loadMovements])

  const selectedManual = MANUAL_TYPES.find((t) => t.value === manual.movement_type)

  const handleSaveManual = async () => {
    if (!device) return
    if (!manual.description.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Descreva a movimentação (ex.: motivo da manutenção).',
        variant: 'destructive',
      })
      return
    }
    if (selectedManual?.needsOwner && manual.new_owner === 'none') {
      toast({
        title: 'Responsável obrigatório',
        description: 'Selecione para quem o aparelho será atribuído.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await addInventoryMovement(device.id, {
        movement_type: manual.movement_type,
        description: manual.description.trim(),
        new_owner: manual.new_owner === 'none' ? undefined : manual.new_owner,
      })
      toast({ title: 'Movimentação registrada' })
      setManual(EMPTY_MANUAL)
      setShowManual(false)
      await loadMovements(device.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar movimentação'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {device?.device_type === 'camera' ? (
              <Camera className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            )}
            Histórico — {device?.brand} {device?.model}
          </DialogTitle>
          <DialogDescription>
            Linha do tempo das movimentações do aparelho, da mais recente para a mais antiga.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada para este aparelho.
          </p>
        ) : (
          <ol
            className="relative space-y-4 border-l border-border py-1 pl-5"
            aria-label="Linha do tempo de movimentações"
          >
            {movements.map((m) => {
              const meta = MOVEMENT_META[m.movement_type] || MOVEMENT_META.manual
              return (
                <li key={m.id} className="relative">
                  <span
                    className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatMovementDate(m.created)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{m.description}</p>
                  {m.new_owner_name && (
                    <p className="text-xs text-muted-foreground">
                      Responsável: {m.previous_owner_name || '—'} → {m.new_owner_name}
                    </p>
                  )}
                  {m.performed_by_name && (
                    <p className="text-xs text-muted-foreground">Por: {m.performed_by_name}</p>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {canManage && (
          <div className="border-t border-border pt-4">
            {!showManual ? (
              <Button
                variant="outline"
                onClick={() => setShowManual(true)}
                className="min-h-[44px]"
                aria-expanded={showManual}
              >
                <Plus className="mr-2 h-4 w-4" />
                Registrar movimentação
              </Button>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="inv-mov-type">Movimentação</Label>
                    <Select
                      value={manual.movement_type}
                      onValueChange={(v) =>
                        setManual((f) => ({ ...f, movement_type: v as InventoryMovementType }))
                      }
                    >
                      <SelectTrigger id="inv-mov-type" className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedManual?.needsOwner && (
                    <div className="grid gap-2">
                      <Label htmlFor="inv-mov-owner">Novo responsável</Label>
                      <Select
                        value={manual.new_owner}
                        onValueChange={(v) => setManual((f) => ({ ...f, new_owner: v }))}
                      >
                        <SelectTrigger id="inv-mov-owner" className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione…</SelectItem>
                          {operators.map((op) => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.name || op.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="inv-mov-desc">Descrição</Label>
                  <Textarea
                    id="inv-mov-desc"
                    value={manual.description}
                    onChange={(e) => setManual((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Ex.: enviado à assistência para troca de tela"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Atribuir troca o responsável; Devolvido limpa o responsável; Manutenção muda o
                    status do aparelho.
                  </span>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowManual(false)
                      setManual(EMPTY_MANUAL)
                    }}
                    disabled={saving}
                    className="min-h-[44px]"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveManual} disabled={saving} className="min-h-[44px]">
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Registrar
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
