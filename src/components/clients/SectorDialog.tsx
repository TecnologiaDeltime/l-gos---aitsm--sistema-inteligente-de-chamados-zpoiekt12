import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  createCompanyDepartment,
  updateCompanyDepartment,
  createCompanyAuditLog,
} from '@/services/companies'
import { buildSectorTree, flattenSectorTree, getSectorIndent } from '@/lib/sector-hierarchy'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface SectorRecord {
  id: string
  name: string
  unit?: string
  parent?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  sectors: SectorRecord[]
  sector?: SectorRecord | null
  onSaved: () => void
}

export function SectorDialog({ open, onOpenChange, clientId, sectors, sector, onSaved }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      setName(sector?.name || '')
      setParent(sector?.parent || '')
    }
  }, [open, sector])

  const availableParents = sectors.filter((s) => s.id !== sector?.id)
  const flatParents = flattenSectorTree(buildSectorTree(availableParents))

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrors({ name: 'Nome é obrigatório' })
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const payload = { name: name.trim(), parent: parent || undefined }
      if (sector) {
        await updateCompanyDepartment(sector.id, payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'updated sector',
            entity_type: 'company_departments',
            entity_id: sector.id,
            description: `Setor "${name}" atualizado`,
            old_values: sector as Record<string, unknown>,
            new_values: payload as Record<string, unknown>,
          })
      } else {
        const created = await createCompanyDepartment({ company: clientId, ...payload })
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'created sector',
            entity_type: 'company_departments',
            entity_id: created.id,
            description: `Setor "${name}" criado`,
            new_values: payload as Record<string, unknown>,
          })
      }
      toast({ title: sector ? 'Setor atualizado!' : 'Setor adicionado!' })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar setor', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{sector ? 'Editar Setor' : 'Adicionar Setor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              className="h-9 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmit())}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Setor Pai (Sub-setor de)</Label>
            <Select
              value={parent || 'none'}
              onValueChange={(v) => setParent(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Nenhum (setor principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (setor principal)</SelectItem>
                {flatParents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {getSectorIndent(s.level)}
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
