import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FileText, Plus, Pencil, Trash2, Power } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TemplateEditDialog } from '@/components/TemplateEditDialog'
import {
  getTemplates,
  deleteTemplate,
  updateTemplate,
  TicketTemplateRecord,
} from '@/services/ticket-templates'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function TicketTemplates() {
  const permissions = usePermissions()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TicketTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TicketTemplateRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TicketTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = () => {
    getTemplates()
      .then(setTemplates)
      .catch(() => {
        toast({ title: 'Erro ao carregar modelos', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('ticket_templates', () => loadData())

  if (!permissions.isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const handleEdit = (template: TicketTemplateRecord) => {
    setEditTarget(template)
    setEditOpen(true)
  }

  const handleNew = () => {
    setEditTarget(null)
    setEditOpen(true)
  }

  const handleToggleActive = async (template: TicketTemplateRecord) => {
    try {
      await updateTemplate(template.id, { active: !template.active })
      toast({ title: template.active ? 'Modelo desativado' : 'Modelo ativado' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao alterar status',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTemplate(deleteTarget.id)
      toast({ title: 'Modelo excluído!' })
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir modelo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Modelos de Resolução e Comentário
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Crie e gerencie modelos para agilizar a resolução de chamados e comentários.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" /> Novo Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Modelos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum modelo cadastrado. Clique em "Novo Template" para começar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Conteúdo</TableHead>
                    <TableHead className="text-xs text-center">Ativo</TableHead>
                    <TableHead className="text-xs text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                        {t.content}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={t.active ? 'default' : 'secondary'} className="text-[10px]">
                          {t.active ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(t)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(t)}
                            title={t.active ? 'Desativar' : 'Ativar'}
                          >
                            <Power
                              className={`h-3.5 w-3.5 ${t.active ? 'text-green-600' : 'text-slate-400'}`}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(t)}
                            title="Excluir"
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

      <TemplateEditDialog
        template={editTarget}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadData}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modelo &ldquo;{deleteTarget?.name}&rdquo;? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
