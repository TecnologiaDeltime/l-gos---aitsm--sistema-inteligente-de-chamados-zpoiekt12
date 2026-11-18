import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import {
  createPortalCollaborator,
  updatePortalCollaborator,
  type PortalCollaboratorRecord,
} from '@/services/portal-collaborators-admin'

const schema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres').optional().or(z.literal('')),
  active: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  collaborator?: PortalCollaboratorRecord | null
  onSaved?: () => void | Promise<void>
}

export function CollaboratorPortalDialog({
  open,
  onOpenChange,
  companyId,
  collaborator,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(collaborator)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', active: true },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: collaborator?.name ?? '',
        email: collaborator?.email ?? '',
        password: '',
        active: collaborator ? collaborator.active : true,
      })
    }
  }, [open, collaborator, reset])

  const active = watch('active')

  const onSubmit = async (data: FormData) => {
    if (!isEdit && !data.password) {
      toast({
        title: 'Senha obrigatória',
        description: 'Defina uma senha inicial para o acesso do colaborador.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload: {
        name: string
        email: string
        active: boolean
        password?: string
      } = {
        name: data.name,
        email: data.email,
        active: data.active,
      }
      if (data.password) payload.password = data.password
      if (isEdit && collaborator) {
        await updatePortalCollaborator(collaborator.id, payload)
      } else {
        await createPortalCollaborator({ ...payload, company: companyId })
      }
      toast({
        title: isEdit ? 'Colaborador atualizado' : 'Colaborador criado',
        description: isEdit
          ? 'As alterações foram salvas.'
          : 'O acesso ao Portal do Colaborador foi criado.',
      })
      await onSaved?.()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.response?.message || err?.message || 'Falha ao salvar colaborador.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar acesso' : 'Novo acesso ao portal'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados do colaborador. Deixe a senha em branco para mantê-la.'
              : 'Crie a credencial que o colaborador usará para entrar no portal.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collab-name">Nome</Label>
            <Input id="collab-name" placeholder="Nome do colaborador" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collab-email">E-mail (login)</Label>
            <Input
              id="collab-email"
              type="email"
              placeholder="colaborador@empresa.com"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collab-password">
              Senha {isEdit && <span className="text-muted-foreground">(opcional)</span>}
            </Label>
            <Input
              id="collab-password"
              type="password"
              placeholder={isEdit ? 'Deixe em branco para manter' : 'Senha inicial'}
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="collab-active">Acesso ativo</Label>
              <p className="text-xs text-muted-foreground">
                Colaboradores inativos não conseguem entrar no portal.
              </p>
            </div>
            <Switch
              id="collab-active"
              checked={active}
              onCheckedChange={(v) => setValue('active', v)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar acesso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
