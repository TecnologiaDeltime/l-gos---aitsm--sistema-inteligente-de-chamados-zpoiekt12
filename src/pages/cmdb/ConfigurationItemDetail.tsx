import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  GitBranch,
  Edit,
  Trash2,
  Loader2,
  Boxes,
  MapPin,
  Hash,
  Info,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  getConfigurationItem,
  deleteConfigurationItem,
  ConfigurationItemRecord,
} from '@/services/configuration-items'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { ConfigurationItemTypeBadge } from '@/components/ConfigurationItemTypeBadge'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'

export default function ConfigurationItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const permissions = usePermissions()

  const [item, setItem] = useState<ConfigurationItemRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await getConfigurationItem(id)
      setItem(data)
    } catch (err: any) {
      toast({
        title: 'Item não encontrado',
        description: 'Não foi possível carregar o item de configuração.',
        variant: 'destructive',
      })
      navigate('/cmdb/configuration-items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('configuration_items', () => loadData())

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteConfigurationItem(id)
      toast({ title: 'Item de configuração excluído com sucesso' })
      navigate('/cmdb/configuration-items')
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const canEdit =
    permissions.isAdmin ||
    permissions.isGestor ||
    permissions.isTecnico ||
    permissions.canWriteModule('cmdb')

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cmdb/configuration-items')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              {item.name}
            </h1>
            <p className="text-xs text-muted-foreground">Item de Configuração de Infraestrutura</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Link to={`/cmdb/configuration-items/${item.id}/edit`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Edit className="h-4 w-4" /> Editar
              </Button>
            </Link>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        )}
      </div>

      {/* Main Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Informações Gerais</CardTitle>
                <div className="flex items-center gap-2">
                  <ConfigurationItemTypeBadge type={item.type} />
                  <CiStatusBadge status={item.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">Nome</span>
                <span className="text-sm font-medium text-foreground">{item.name}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">Tipo</span>
                <span className="text-sm font-medium text-foreground">{item.type}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">Marca</span>
                <span className="text-sm text-foreground">{item.brand || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">Modelo</span>
                <span className="text-sm text-foreground">{item.model || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">
                  Número de Série
                </span>
                <span className="text-sm font-mono text-foreground flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.serial_number || '—'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-0.5">
                  Localização
                </span>
                <span className="text-sm text-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.location || '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Observações de configuração */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Observações de Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {item.observations ? (
                <div className="whitespace-pre-wrap text-xs text-foreground font-mono bg-muted/40 p-4 rounded-lg border">
                  {item.observations}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma observação ou nota de configuração registrada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm">Vínculos & Metadados</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">Empresa</span>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {item.expand?.company?.trade_name || item.expand?.company?.legal_name || '—'}
                </div>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block mb-1">Filial</span>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  {item.expand?.unit?.name || 'Sede'}
                </div>
              </div>
              <div className="border-t pt-3 space-y-2 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Criado em
                  </span>
                  <span className="text-foreground">
                    {new Date(item.created).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Atualizado em
                  </span>
                  <span className="text-foreground">
                    {new Date(item.updated).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Item de Configuração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o item &ldquo;{item.name}&rdquo;? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
