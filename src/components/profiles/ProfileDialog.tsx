import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PermissionMatrixEditor } from './PermissionMatrixEditor'
import { ProfileRecord, PermissionsMap } from '@/types/profiles'
import { getDefaultPermissions } from '@/services/profiles'
import { Shield, ShieldAlert, Loader2, Sparkles } from 'lucide-react'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileRecord | null
  onSave: (data: {
    name: string
    description: string
    permissions: PermissionsMap
  }) => Promise<void>
}

export function ProfileDialog({ open, onOpenChange, profile, onSave }: ProfileDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<PermissionsMap>(getDefaultPermissions(false))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!profile
  const isSystem = !!profile?.is_system

  useEffect(() => {
    if (open) {
      if (profile) {
        setName(profile.name || '')
        setDescription(profile.description || '')
        setPermissions(profile.permissions || getDefaultPermissions(false))
      } else {
        setName('')
        setDescription('')
        setPermissions(getDefaultPermissions(false))
      }
      setError(null)
    }
  }, [open, profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('O nome do perfil é obrigatório.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onSave({
        name: name.trim(),
        description: description.trim(),
        permissions,
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar perfil. Verifique os dados e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyPreset = (preset: 'admin' | 'tech' | 'viewer') => {
    if (isSystem) return
    if (preset === 'admin') {
      setPermissions(getDefaultPermissions(true))
    } else if (preset === 'viewer') {
      const p = getDefaultPermissions(false)
      Object.keys(p).forEach((k: any) => {
        p[k as keyof PermissionsMap] = { read: true, write: false, hidden: false }
      })
      setPermissions(p)
    } else if (preset === 'tech') {
      const p = getDefaultPermissions(false)
      p.dashboard = { read: true, write: true, hidden: false }
      p.tickets = { read: true, write: true, hidden: false }
      p.tickets_children = { read: true, write: true, hidden: false }
      p.cmdb = { read: true, write: false, hidden: false }
      p.changes = { read: true, write: true, hidden: false }
      p.reports = { read: true, write: false, hidden: false }
      p.settings = { read: false, write: false, hidden: true }
      p.clients = { read: true, write: false, hidden: false }
      p.operators = { read: false, write: false, hidden: true }
      p.profiles = { read: false, write: false, hidden: true }
      p.sla_dashboard = { read: true, write: false, hidden: false }
      p.notifications = { read: true, write: true, hidden: false }
      p.time_tracking = { read: true, write: true, hidden: false }
      setPermissions(p)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEditing ? `Editar Perfil: ${profile.name}` : 'Novo Perfil de Acesso'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Defina o nome, descrição e a matriz detalhada de permissões para este perfil.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs dark:bg-red-950/50 dark:border-red-900 dark:text-red-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isSystem && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  Este é o perfil base de <strong>Administrador do Sistema</strong>. Possui acesso
                  total e não pode ser excluído.
                </span>
              </div>
            )}

            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs font-semibold">
                  Nome do Perfil <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="profile-name"
                  required
                  placeholder="Ex: Técnico N1, Supervisor, Qualidade..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSystem || saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-desc" className="text-xs font-semibold">
                  Descrição do Papel
                </Label>
                <Input
                  id="profile-desc"
                  placeholder="Breve descrição das responsabilidades deste perfil"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Modelos / Presets */}
            {!isSystem && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Carregar permissões modelo:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleApplyPreset('tech')}
                  >
                    Técnico Padrão
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleApplyPreset('viewer')}
                  >
                    Somente Leitura
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-primary"
                    onClick={() => handleApplyPreset('admin')}
                  >
                    Acesso Total
                  </Button>
                </div>
              </div>
            )}

            {/* Matriz de Permissões */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Matriz de Permissões Granulares
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure o nível de acesso em cada funcionalidade do sistema.
                </p>
              </div>

              <PermissionMatrixEditor
                permissions={permissions}
                onChange={setPermissions}
                disabled={isSystem || saving}
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border bg-card flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Criar Perfil'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
