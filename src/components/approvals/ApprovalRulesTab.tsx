import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Pencil, Trash2, Plus } from 'lucide-react'
import {
  getApprovalConfigs,
  updateApprovalConfig,
  deleteApprovalConfig,
  ApprovalConfigRecord,
} from '@/services/approval-configs'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { ApprovalRuleDialog } from '@/components/approvals/ApprovalRuleDialog'

export function ApprovalRulesTab() {
  const { canManageClients } = usePermissions()
  const { toast } = useToast()
  const [configs, setConfigs] = useState<ApprovalConfigRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ApprovalConfigRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = () => {
    getApprovalConfigs()
      .then(setConfigs)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('approval_configs', () => loadData())

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateApprovalConfig(id, { active })
      toast({ title: active ? 'Regra ativada' : 'Regra inativada' })
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteApprovalConfig(deleteId)
      toast({ title: 'Regra excluída' })
      setDeleteId(null)
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const getClientNames = (config: ApprovalConfigRecord) => {
    const c = config.expand?.clients
    if (!c) return 'N/A'
    if (Array.isArray(c)) return c.map((co: any) => co.trade_name || co.legal_name).join(', ')
    return c.trade_name || c.legal_name || 'N/A'
  }

  const getActivityName = (config: ApprovalConfigRecord) => config.expand?.activity?.name || 'N/A'

  return (
    <div className="space-y-4">
      {canManageClients && (
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-1 h-4 w-4" /> Nova Regra
        </Button>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atividade</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                {canManageClients && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageClients ? 4 : 3}
                    className="text-center text-sm text-slate-500 py-8"
                  >
                    Nenhuma regra de aprovação cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="text-sm font-medium">{getActivityName(config)}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {getClientNames(config)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={config.active}
                        disabled={!canManageClients}
                        onCheckedChange={(v) => handleToggle(config.id, v)}
                      />
                    </TableCell>
                    {canManageClients && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(config)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(config.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ApprovalRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={loadData}
      />
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
