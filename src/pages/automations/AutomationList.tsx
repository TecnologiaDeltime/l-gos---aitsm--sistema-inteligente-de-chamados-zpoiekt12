import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Plus, Copy, Edit, Power, History, BarChart3 } from 'lucide-react'
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  createAuditLog,
} from '@/services/automations'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCategories, CategoryRecord } from '@/services/categories'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { AUTOMATION_TEMPLATES } from '@/lib/workflow-constants'
import type { AutomationRecord } from '@/types/automation'

const STATUS_CLS: Record<string, string> = {
  Rascunho: 'bg-slate-100 text-slate-700',
  Ativa: 'bg-green-100 text-green-700',
  Inativa: 'bg-amber-100 text-amber-700',
  Arquivada: 'bg-gray-100 text-gray-500',
}

export default function AutomationList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { canManageAutomations } = usePermissions()
  const [automations, setAutomations] = useState<AutomationRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const loadData = async () => {
    try {
      const [autos, comps, cats] = await Promise.all([
        getAutomations(),
        getCompanies(),
        getCategories(),
      ])
      setAutomations(autos)
      setCompanies(comps)
      setCategories(cats)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('automations', () => loadData())

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    try {
      const auto = await createAutomation({
        ...form,
        status: 'Rascunho',
        current_version: 0,
        execution_priority: form.execution_priority || 1,
      })
      await createAuditLog({
        automation: auto.id,
        user: user.id,
        action: 'created',
        description: `Automação "${form.name}" criada`,
      })
      toast({ title: 'Automação criada!' })
      setOpen(false)
      setForm({})
      navigate(`/automations/${auto.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar', variant: 'destructive' })
    }
  }

  const handleToggle = async (a: AutomationRecord) => {
    const newStatus = a.status === 'Ativa' ? 'Inativa' : 'Ativa'
    await updateAutomation(a.id, { status: newStatus })
    if (user)
      await createAuditLog({
        automation: a.id,
        user: user.id,
        action: newStatus === 'Ativa' ? 'activated' : 'deactivated',
        description: `Status alterado para ${newStatus}`,
      })
    toast({ title: `Automação ${newStatus === 'Ativa' ? 'ativada' : 'desativada'}` })
    loadData()
  }

  const handleDuplicate = async (a: AutomationRecord) => {
    try {
      await createAutomation({
        name: `${a.name} (Cópia)`,
        code: `${a.code}-copy-${Date.now()}`,
        description: a.description,
        client: a.client,
        catalog: a.catalog,
        service: a.service,
        ticket_type: a.ticket_type,
        status: 'Rascunho',
        current_version: 0,
        execution_priority: a.execution_priority,
        responsible: a.responsible,
        is_template: a.is_template,
        template_category: a.template_category,
      })
      toast({ title: 'Automação duplicada!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao duplicar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Central de Automações</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/automations/dashboard')}>
            <BarChart3 className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          {canManageAutomations && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Nova Automação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Automação</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input
                      value={form.name || ''}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Código *</Label>
                    <Input
                      value={form.code || ''}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      rows={2}
                      value={form.description || ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Cliente</Label>
                      <Select
                        value={form.client || ''}
                        onValueChange={(v) => setForm({ ...form, client: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Todos" />
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
                      <Label className="text-xs">Catálogo</Label>
                      <Select
                        value={form.catalog || ''}
                        onValueChange={(v) => setForm({ ...form, catalog: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Todos" />
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
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo de Chamado</Label>
                      <Select
                        value={form.ticket_type || ''}
                        onValueChange={(v) => setForm({ ...form, ticket_type: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            'Incidente',
                            'Requisição de Serviço',
                            'Problema',
                            'Mudança',
                            'Projeto',
                            'Tarefa Interna',
                            'Visita Técnica',
                            'Dúvida',
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Prioridade</Label>
                      <Input
                        type="number"
                        value={form.execution_priority || 1}
                        onChange={(e) =>
                          setForm({ ...form, execution_priority: parseInt(e.target.value) || 1 })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Responsável</Label>
                    <Input
                      value={form.responsible || user?.id || ''}
                      onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Usar Template</Label>
                    <Select
                      value={form.template_category || ''}
                      onValueChange={(v) =>
                        setForm({ ...form, template_category: v, is_template: true })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTOMATION_TEMPLATES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    Criar e Editar
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Versão</TableHead>
                <TableHead className="text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs font-medium">{a.name}</TableCell>
                  <TableCell className="text-xs font-mono">{a.code}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CLS[a.status] || 'bg-slate-100'}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">v{a.current_version || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/automations/${a.id}/edit`)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(a)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(a)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {automations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-8">
                    Nenhuma automação criada. Clique em "Nova Automação" para começar.
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
