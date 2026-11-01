import { useState, useEffect } from 'react'
import { ProfileRecord, PermissionsMap, GRANULAR_SYSTEM_MODULES } from '@/types/profiles'
import {
  createProfile,
  updateProfile,
  getDefaultPermissions,
  getProfilePermissions,
  saveProfileGranularPermissions,
  initializeProfilePermissions,
} from '@/services/profiles'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { PermissionMatrixEditor } from './PermissionMatrixEditor'
import { Shield, ShieldAlert, Check, Loader2 } from 'lucide-react'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile?: ProfileRecord | null
  onSuccess: () => void
}

export function ProfileDialog({ open, onOpenChange, profile, onSuccess }: ProfileDialogProps) {
  const { toast } = useToast()
  const isEditing = !!profile

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [granularPermissions, setGranularPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [activeTab, setActiveTab] = useState('permissions')

  const isAdminProfile = profile?.name?.toLowerCase() === 'administrador'

  useEffect(() => {
    if (open) {
      if (profile) {
        setName(profile.name)
        setDescription(profile.description || '')
        setActiveTab('permissions')

        // Carregar permissões granulares da collection
        setLoadingPerms(true)
        initializeProfilePermissions(profile.id, true)
          .then((map) => {
            setGranularPermissions(map)
          })
          .catch((err) => {
            console.error('Erro ao inicializar permissões do perfil:', err)
          })
          .finally(() => {
            setLoadingPerms(false)
          })
      } else {
        setName('')
        setDescription('')
        setActiveTab('info')

        // Novo perfil nasce com tudo concedido por padrão
        const initialMap: Record<string, boolean> = {}
        GRANULAR_SYSTEM_MODULES.forEach((mod) => {
          mod.items.forEach((item) => {
            initialMap[`${mod.key}.${item.key}`] = true
          })
        })
        setGranularPermissions(initialMap)
      }
    }
  }, [open, profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome do perfil.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // Montar mapa legado de módulos para manter compatibilidade com views antigas
      const legacyPerms: PermissionsMap = {}
      GRANULAR_SYSTEM_MODULES.forEach((mod) => {
        const hasAnyGranted = mod.items.some(
          (item) => granularPermissions[`${mod.key}.${item.key}`] !== false,
        )
        legacyPerms[mod.key] = {
          read: hasAnyGranted,
          write: hasAnyGranted,
          hidden: !hasAnyGranted,
        }
      })

      if (isEditing && profile) {
        await updateProfile(profile.id, {
          name: name.trim(),
          description: description.trim(),
          permissions: legacyPerms,
        })

        // Salvar permissões granulares se não for o perfil de Administrador (admin tem tudo sempre)
        if (!isAdminProfile) {
          await saveProfileGranularPermissions(profile.id, granularPermissions)
        }

        toast({
          title: 'Perfil atualizado',
          description: `O perfil "${name}" e sua matriz de permissões foram salvos com sucesso.`,
        })
      } else {
        const created = await createProfile({
          name: name.trim(),
          description: description.trim(),
          permissions: legacyPerms,
          is_system: false,
        })

        await saveProfileGranularPermissions(created.id, granularPermissions)

        toast({
          title: 'Perfil criado',
          description: `O perfil "${name}" foi criado com as permissões configuradas.`,
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar perfil',
        description: err.message || 'Ocorreu um erro ao salvar o perfil.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-border/80 bg-background overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/70 bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                {isEditing ? `Editar Perfil: ${profile.name}` : 'Novo Perfil de Acesso'}
                {profile?.is_system && (
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                    Sistema
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Conceda ou retire acessos granulares a módulos, subtelas e relatórios individuais
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="px-6 pt-3 border-b border-border/60 bg-muted/20">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="permissions" className="text-xs font-semibold">
                  Matriz de Permissões
                </TabsTrigger>
                <TabsTrigger value="info" className="text-xs font-semibold">
                  Dados do Perfil
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="info" className="m-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">
                    Nome do Perfil <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Operador Nível 1, Auditor, Gestor de Ativos"
                    disabled={isAdminProfile || loading}
                    className="h-9 text-xs"
                    required
                  />
                  {isAdminProfile && (
                    <p className="text-[11px] text-muted-foreground">
                      O nome do perfil de sistema Administrador não pode ser alterado.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-medium">
                    Descrição / Finalidade
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva as responsabilidades e o público deste perfil de acesso..."
                    rows={4}
                    disabled={loading}
                    className="text-xs resize-none"
                  />
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="m-0">
                {loadingPerms ? (
                  <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-mono">Carregando permissões do perfil...</span>
                  </div>
                ) : (
                  <PermissionMatrixEditor
                    granularPermissions={granularPermissions}
                    onChange={setGranularPermissions}
                    disabled={loading}
                    isAdminProfile={isAdminProfile}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="p-4 border-t border-border/70 bg-card/60 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">
              As alterações valem imediatamente para todos os usuários com este perfil.
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="h-8 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-xs gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Salvar Perfil
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
