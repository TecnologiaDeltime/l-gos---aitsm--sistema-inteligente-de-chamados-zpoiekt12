import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Download } from 'lucide-react'
import {
  getExpenses,
  createExpense,
  ExpenseRecord,
  EXPENSE_TYPES,
  EXPENSE_STATUSES,
} from '@/services/expenses'
import { getUsers } from '@/services/users'
import { exportToCsv } from '@/lib/export-utils'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function ExpensesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    expense_type: 'Quilometragem',
    value: '',
    expense_date: '',
    supplier: '',
    justification: '',
  })

  const loadData = () => {
    getExpenses()
      .then(setExpenses)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
    getUsers()
      .then(setTechs)
      .catch(() => {})
  }, [])
  useRealtime('expenses', () => loadData())

  const handleSubmit = async () => {
    setErrors({})
    try {
      await createExpense({
        technician: user?.id,
        expense_type: form.expense_type,
        value: parseFloat(form.value),
        expense_date: form.expense_date,
        supplier: form.supplier,
        justification: form.justification,
        approval_status: 'Rascunho',
      } as any)
      toast({ title: 'Despesa registrada!' })
      setShowForm(false)
      setForm({
        expense_type: 'Quilometragem',
        value: '',
        expense_date: '',
        supplier: '',
        justification: '',
      })
      loadData()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao registrar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Despesas</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv(
                'despesas.csv',
                expenses.map((e) => ({
                  Operador: techs.find((t) => t.id === e.technician)?.name || '',
                  Tipo: e.expense_type,
                  Valor: e.value,
                  Data: e.expense_date,
                  Status: e.approval_status,
                })),
                ['Operador', 'Tipo', 'Valor', 'Data', 'Status'],
              )
            }
          >
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Operador</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhuma despesa.
                    </td>
                  </tr>
                ) : (
                  expenses.slice(0, 50).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        {techs.find((t) => t.id === e.technician)?.name || '-'}
                      </td>
                      <td className="p-3">{e.expense_type}</td>
                      <td className="p-3 font-bold">R$ {(e.value || 0).toFixed(2)}</td>
                      <td className="p-3">
                        {e.expense_date
                          ? new Date(e.expense_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="p-3">{e.supplier || '-'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[9px]">
                          {e.approval_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select
                value={form.expense_type}
                onValueChange={(v) => setForm({ ...form, expense_type: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="h-9"
              />
              {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Justificativa</Label>
              <Textarea
                value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!form.value}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
