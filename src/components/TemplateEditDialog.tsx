import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  createTemplate,
  updateTemplate,
  TEMPLATE_TYPES,
  TicketTemplateRecord,
} from '@/services/ticket-templates'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface TemplateEditDialogProps {
  template: TicketTemplateRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function TemplateEditDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: TemplateEditDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'Resolução' | 'Comentário' | 'Ambos'>('Resolução')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (template) {
      setName(template.name)
      setContent(template.content)
      setType(template.type)
      setActive(template.active)
    } else {
      setName('')
      setContent('')
      setType('Resolução')
      setActive(true)
    }
    setFieldErrors({})
  }, [template, open])

  const handleSave = async () => {
    setSaving(true)
    setFieldErrors({})
    try {
      if (template) {
        await updateTemplate(template.id, { name, content, type, active })
        toast({ title: 'Modelo atualizado com sucesso!' })
      } else {
        await createTemplate({ name, content, type, active, created_by: user?.id })
        toast({ title: 'Modelo criado com sucesso!' })
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao salvar modelo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Nome <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do modelo..."
            />
            {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Tipo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as 'Resolução' | 'Comentário' | 'Ambos')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.type && <p className="text-xs text-red-500">{fieldErrors.type}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Conteúdo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Conteúdo do modelo..."
            />
            {fieldErrors.content && <p className="text-xs text-red-500">{fieldErrors.content}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="template-active"
              checked={active}
              onCheckedChange={(v) => setActive(v === true)}
            />
            <Label htmlFor="template-active" className="text-sm font-medium cursor-pointer">
              Ativo
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
