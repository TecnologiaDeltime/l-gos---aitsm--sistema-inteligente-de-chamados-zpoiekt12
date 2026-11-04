import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Save, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DurationInput } from '@/components/ui/DurationInput'
import { formatMinutes, parseDurationToMinutes, validateHHMMSS } from '@/lib/duration'
import { getCategories, updateCategory, CategoryRecord } from '@/services/categories'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function SlaSettings() {
  const permissions = usePermissions()
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, { response: string; solution: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, { response?: string; solution?: string }>>({})

  const loadData = () => {
    getCategories()
      .then((cats) => {
        const active = cats.filter((c) => c.active !== false)
        setCategories(active)
        const editState: Record<string, { response: string; solution: string }> = {}
        active.forEach((c) => {
          editState[c.id] = {
            response: c.sla_response_minutes != null ? formatMinutes(c.sla_response_minutes) : '',
            solution: c.sla_solution_minutes != null ? formatMinutes(c.sla_solution_minutes) : '',
          }
        })
        setEditing(editState)
      })
      .catch(() => {
        toast({ title: 'Erro ao carregar categorias', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('tkt_categories', () => loadData())

  if (!permissions.isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const validateField = (value: string): string | undefined => {
    if (!value || value.trim() === '') return undefined
    const err = validateHHMMSS(value, false)
    return err || undefined
  }

  const handleChange = (id: string, field: 'response' | 'solution', value: string) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
    const error = validateField(value)
    setErrors((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: error },
    }))
  }

  const handleSave = async (cat: CategoryRecord) => {
    const edit = editing[cat.id]
    if (!edit) return
    const respError = validateField(edit.response)
    const solError = validateField(edit.solution)
    if (respError || solError) {
      setErrors((prev) => ({
        ...prev,
        [cat.id]: { response: respError, solution: solError },
      }))
      return
    }
    setSaving(cat.id)
    try {
      const respMinutes = edit.response ? parseDurationToMinutes(edit.response) : null
      const solMinutes = edit.solution ? parseDurationToMinutes(edit.solution) : null
      await updateCategory(cat.id, {
        sla_response_minutes: respMinutes !== null ? Math.round(respMinutes) : null,
        sla_solution_minutes: solMinutes !== null ? Math.round(solMinutes) : null,
      } as Partial<CategoryRecord>)
      toast({ title: `Prazos de SLA atualizados para ${cat.name}` })
      loadData()
    } catch {
      toast({ title: 'Erro ao salvar. Tente novamente.', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Configurações de SLA
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Defina os prazos de SLA Resposta e SLA Solução por categoria de chamado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Categorias de Chamados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              Nenhuma categoria ativa encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
                      Nome
                    </th>
                    <th className="pb-2 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      SLA Resposta (00:00:00)
                    </th>
                    <th className="pb-2 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      SLA Solução (00:00:00)
                    </th>
                    <th className="pb-2 pl-4 font-semibold text-slate-700 dark:text-slate-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const edit = editing[cat.id] || { response: '', solution: '' }
                    const err = errors[cat.id] || {}
                    const isSaving = saving === cat.id
                    return (
                      <tr key={cat.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {cat.name}
                            </span>
                            {cat.parent && (
                              <Badge variant="outline" className="text-[10px]">
                                Subcategoria
                              </Badge>
                            )}
                          </div>
                          {cat.description && (
                            <span className="text-xs text-slate-400">{cat.description}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <DurationInput
                            value={edit.response}
                            onChange={(val) => handleChange(cat.id, 'response', val)}
                            placeholder="00:00:00"
                            className="w-32 h-8 text-sm text-center"
                          />
                          {err.response && (
                            <p className="text-xs text-red-500 mt-1">{err.response}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <DurationInput
                            value={edit.solution}
                            onChange={(val) => handleChange(cat.id, 'solution', val)}
                            placeholder="00:00:00"
                            className="w-32 h-8 text-sm text-center"
                          />
                          {err.solution && (
                            <p className="text-xs text-red-500 mt-1">{err.solution}</p>
                          )}
                        </td>
                        <td className="py-3 pl-4">
                          <Button
                            size="sm"
                            onClick={() => handleSave(cat)}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {isSaving ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
