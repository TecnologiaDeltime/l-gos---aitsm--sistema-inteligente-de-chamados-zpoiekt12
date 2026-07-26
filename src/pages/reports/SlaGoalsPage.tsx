import { useEffect, useState } from 'react'
import { Target, Save, Trash2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getUsers } from '@/services/users'
import { getSlaGoals, saveSlaGoals, deleteSlaGoals, type SlaGoalRecord } from '@/services/sla-goals'
import { useRealtime } from '@/hooks/use-realtime'

interface EditValues {
  response?: number
  solution?: number
}

export default function SlaGoalsPage() {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<any[]>([])
  const [goals, setGoals] = useState<SlaGoalRecord[]>([])
  const [editing, setEditing] = useState<Record<string, EditValues>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [techs, goalRecords] = await Promise.all([
        getUsers('role = "tecnico" || role = "gestor"'),
        getSlaGoals(),
      ])
      setTechnicians(techs)
      setGoals(goalRecords)
      const vals: Record<string, EditValues> = {}
      techs.forEach((t) => {
        vals[t.id] = {
          response: goalRecords.find((g) => g.technician === t.id && g.sla_type === 'Resposta')
            ?.target_percentage,
          solution: goalRecords.find((g) => g.technician === t.id && g.sla_type === 'Solução')
            ?.target_percentage,
        }
      })
      setEditing(vals)
    } catch (err) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('sla_goals', () => {
    loadData()
  })

  const handleSave = async (techId: string) => {
    const vals = editing[techId]
    if (!vals) return
    if (vals.response !== undefined && (vals.response < 0 || vals.response > 100)) {
      toast({
        title: 'Valor inválido',
        description: 'A meta deve estar entre 0 e 100.',
        variant: 'destructive',
      })
      return
    }
    if (vals.solution !== undefined && (vals.solution < 0 || vals.solution > 100)) {
      toast({
        title: 'Valor inválido',
        description: 'A meta deve estar entre 0 e 100.',
        variant: 'destructive',
      })
      return
    }
    setSaving(techId)
    try {
      await saveSlaGoals(techId, vals.response, vals.solution, goals)
      toast({ title: 'Metas salvas com sucesso' })
      await loadData()
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (techId: string) => {
    setSaving(techId)
    try {
      await deleteSlaGoals(techId, goals)
      toast({ title: 'Metas removidas' })
      await loadData()
    } catch (err) {
      toast({ title: 'Erro ao remover', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" /> Metas de SLA por Técnico
        </h2>
        <div className="flex gap-2">
          <Link to="/sla-dashboard">
            <Button size="sm" variant="outline">
              Voltar ao Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Definir Metas de Cumprimento de SLA (%)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : technicians.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Nenhum técnico encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Técnico</TableHead>
                    <TableHead className="text-xs text-center">Meta SLA Resposta (%)</TableHead>
                    <TableHead className="text-xs text-center">Meta SLA Solução (%)</TableHead>
                    <TableHead className="text-xs text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((tech) => (
                    <TableRow key={tech.id}>
                      <TableCell className="text-xs font-medium">
                        {tech.name || tech.email}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editing[tech.id]?.response ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value)
                            setEditing((prev) => ({
                              ...prev,
                              [tech.id]: { ...prev[tech.id], response: v },
                            }))
                          }}
                          className="w-20 text-center text-xs"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editing[tech.id]?.solution ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value)
                            setEditing((prev) => ({
                              ...prev,
                              [tech.id]: { ...prev[tech.id], solution: v },
                            }))
                          }}
                          className="w-20 text-center text-xs"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSave(tech.id)}
                            disabled={saving === tech.id}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(tech.id)}
                            disabled={saving === tech.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
