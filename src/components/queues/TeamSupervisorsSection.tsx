import { useEffect, useState } from 'react'
import { Shield, X, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getUsers, UserItem } from '@/services/users'
import {
  getSupervisorTeamLinksByTeam,
  createSupervisorTeamLink,
  updateSupervisorTeamLink,
} from '@/services/supervisor-team-links'

interface TeamSupervisorsSectionProps {
  queueId: string
  queueName: string
}

/**
 * Seção "Supervisores que acompanham esta equipe": multi-seleção de usuários
 * role='gestor' ativos, gravando registros em supervisor_team_links
 * (supervisor ↔ fila/equipe). Vincula e desvincula por equipe; o registro
 * nunca é excluído — desativado com active=false (histórico preservado).
 */
export function TeamSupervisorsSection({ queueId, queueName }: TeamSupervisorsSectionProps) {
  const [gestors, setGestors] = useState<UserItem[]>([])
  const [selected, setSelected] = useState('')
  const [links, setLinks] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadLinks = () => {
    getSupervisorTeamLinksByTeam(queueId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getUsers('role = "gestor" && active = true')
      .then(setGestors)
      .catch(() => {})
  }, [queueId])

  useEffect(() => {
    setLoading(true)
    loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueId])

  const activeLinks = links.filter((l) => l.active)

  const handleAdd = async () => {
    if (!selected) return
    const existing = links.find((l) => l.supervisor === selected)
    setSaving(true)
    try {
      if (existing) {
        if (!existing.active) {
          await updateSupervisorTeamLink(existing.id, { active: true })
          toast({ title: 'Supervisor reativado para esta equipe' })
        } else {
          toast({ title: 'Supervisor já acompanha esta equipe' })
        }
      } else {
        await createSupervisorTeamLink({ supervisor: selected, team: queueId, active: true })
        toast({ title: 'Supervisor vinculado à equipe' })
      }
      setSelected('')
      loadLinks()
    } catch {
      toast({ title: 'Erro ao vincular supervisor', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (linkId: string, supName: string) => {
    setSaving(true)
    try {
      // Padrão da casa: registro mantido com active=false (histórico)
      await updateSupervisorTeamLink(linkId, { active: false })
      toast({ title: `${supName} desvinculado da equipe` })
      loadLinks()
    } catch {
      toast({ title: 'Erro ao desvincular supervisor', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold">Supervisores que acompanham esta equipe</p>
        <Badge variant="outline" className="text-[11px] text-slate-400">
          {activeLinks.length} ativo(s)
        </Badge>
      </div>
      <p className="text-[11px] text-slate-500">
        Supervisores (gestores) vinculados à equipe "{queueName}" recebem notificações de alocação
        dos operadores dela.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando vínculos...
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {activeLinks.length === 0 && (
            <span className="text-xs text-slate-400">Nenhum supervisor vinculado.</span>
          )}
          {activeLinks.map((l) => {
            const sup = l.expand?.supervisor
            const supName = sup?.name || sup?.email || 'Supervisor'
            return (
              <Badge
                key={l.id}
                variant="outline"
                className="gap-1 text-xs border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                {supName}
                <button
                  type="button"
                  aria-label={`Desvincular ${supName}`}
                  className="ml-0.5 rounded-full hover:bg-amber-200/60 dark:hover:bg-amber-900/60 p-0.5"
                  disabled={saving}
                  onClick={() => handleRemove(l.id, supName)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={selected || '__none__'}
          onValueChange={(v) => setSelected(v === '__none__' ? '' : v)}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Selecionar supervisor (gestor ativo)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Selecionar supervisor...</SelectItem>
            {gestors.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name || g.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={!selected || saving}
          onClick={handleAdd}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Vincular'}
        </Button>
      </div>
    </div>
  )
}
