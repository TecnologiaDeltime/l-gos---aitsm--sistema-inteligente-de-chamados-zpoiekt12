import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { ShieldOff, Unlock, Plus } from 'lucide-react'
import {
  getAllBlockingRecords,
  createBlockingRecord,
  unblockClient,
  BLOCK_REASONS,
  BLOCK_TYPES,
  BlockingRecord,
} from '@/services/blocking-records'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export default function BlockingManagement() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { isAdmin } = usePermissions()
  const [records, setRecords] = useState<BlockingRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const loadData = async () => {
    try {
      const [r, c] = await Promise.all([getAllBlockingRecords(), getCompanies()])
      setRecords(r)
      setCompanies(c)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    try {
      await createBlockingRecord({
        ...form,
        active: true,
        responsible: user.id,
        start_date: new Date().toISOString().slice(0, 10),
      })
      toast({ title: 'Cliente bloqueado!' })
      setOpen(false)
      setForm({})
      loadData()
    } catch {
      toast({ title: 'Erro ao bloquear', variant: 'destructive' })
    }
  }

  const handleUnblock = async (id: string) => {
    if (!user) return
    await unblockClient(id, user.id)
    toast({ title: 'Cliente desbloqueado!' })
    loadData()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          Bloqueio de Clientes
        </h2>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-1" />
                Bloquear
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Bloqueio</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label className="text-xs">Cliente *</Label>
                  <Select
                    value={form.client || ''}
                    onValueChange={(v) => setForm({ ...form, client: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.trade_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Motivo *</Label>
                  <Select
                    value={form.reason || ''}
                    onValueChange={(v) => setForm({ ...form, reason: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de Bloqueio *</Label>
                  <Select
                    value={form.block_type || ''}
                    onValueChange={(v) => setForm({ ...form, block_type: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Justificativa *</Label>
                  <Textarea
                    rows={2}
                    value={form.justification || ''}
                    onChange={(e) => setForm({ ...form, justification: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Mensagem ao Cliente</Label>
                  <Textarea
                    rows={2}
                    value={form.message || ''}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!form.allow_critical}
                    onCheckedChange={(v) => setForm({ ...form, allow_critical: v })}
                  />
                  <Label className="text-xs">Permitir críticos</Label>
                </div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
                  Confirmar Bloqueio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Motivo</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Início</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-medium">
                    {r.expand?.client?.trade_name || 'N/A'}
                  </TableCell>
                  <TableCell className="text-xs">{r.reason}</TableCell>
                  <TableCell className="text-xs">{r.block_type}</TableCell>
                  <TableCell className="text-xs">
                    {r.start_date || r.created?.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.active ? (
                      <span className="text-red-600 font-bold">Bloqueado</span>
                    ) : (
                      <span className="text-green-600">Ativo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.active && isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => handleUnblock(r.id)}>
                        <Unlock className="h-3 w-3 mr-1" />
                        Desbloquear
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-slate-500 py-4">
                    Nenhum bloqueio registrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
