import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Building2, Pencil, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { getCompanies, deleteCompanyCascade, CompanyRecord } from '@/services/companies'
import { getAllClientContacts } from '@/services/client-contacts'
import { getAllCompanyUnits } from '@/services/company-units'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function ClientList() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({})
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoadError(null)
      const [data, contacts, units] = await Promise.all([
        getCompanies(),
        getAllClientContacts().catch(() => []),
        getAllCompanyUnits().catch(() => []),
      ])
      setCompanies(data)
      const cc: Record<string, number> = {}
      contacts.forEach((c) => {
        cc[c.client] = (cc[c.client] || 0) + 1
      })
      setContactCounts(cc)
      const bc: Record<string, number> = {}
      units.forEach((u) => {
        bc[u.company] = (bc[u.company] || 0) + 1
      })
      setBranchCounts(bc)
      setLoadError(null)
    } catch (err: any) {
      console.error('Falha ao carregar lista de clientes:', err)
      const msg =
        err?.response?.message ||
        err?.message ||
        'Não foi possível carregar os clientes cadastrados. Verifique sua conexão ou tente novamente.'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('companies', () => {
    loadData()
  })

  useRealtime('client_contacts', () => {
    loadData()
  })

  useRealtime('company_units', () => {
    loadData()
  })

  const allSelected = companies.length > 0 && companies.every((c) => selectedIds.has(c.id))
  const someSelected = companies.some((c) => selectedIds.has(c.id)) && !allSelected

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(companies.map((c) => c.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const ids = Array.from(selectedIds)
    let successCount = 0
    const errors: string[] = []
    for (const id of ids) {
      try {
        await deleteCompanyCascade(id)
        successCount++
      } catch (err: any) {
        const msg = err?.response?.error || err?.response?.message || getErrorMessage(err)
        errors.push(msg)
      }
    }
    setDeleting(false)
    setShowDeleteDialog(false)
    if (successCount > 0) {
      toast({
        title: 'Clientes excluídos',
        description: `${successCount} cliente(s) excluído(s) com sucesso. Todos os registros relacionados foram removidos.`,
      })
    }
    if (errors.length > 0) {
      toast({
        title: 'Erro ao excluir',
        description: errors.join(' '),
        variant: 'destructive',
      })
    }
    setSelectedIds(new Set())
    loadData()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Gestão de Clientes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empresas contratantes, filiais, contatos e configurações contratuais
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="shadow-sm"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir Selecionados ({selectedIds.size})
            </Button>
          )}
          <Link to="/clients/new">
            <Button className="bg-primary text-primary-foreground hover:brightness-110 shadow-md shadow-primary/20">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>{loadError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              loadData()
            }}
            className="shrink-0 border-red-300 text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : companies.length === 0 && !loadError ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p>Nenhum cliente cadastrado.</p>
        </div>
      ) : companies.length === 0 && loadError ? null : (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleSelectAll}
              id="select-all-clients"
            />
            <label htmlFor="select-all-clients" className="text-sm font-medium cursor-pointer">
              Selecionar todos
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className={`itsm-card itsm-card-hover p-5 space-y-3.5 border-border/80 bg-card/90 transition-all ${
                  selectedIds.has(c.id) ? 'ring-2 ring-primary border-primary/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleSelectOne(c.id)}
                      id={`client-${c.id}`}
                    />
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <label htmlFor={`client-${c.id}`} className="cursor-pointer">
                        <p className="font-bold text-foreground hover:text-primary transition-colors">
                          {c.trade_name}
                        </p>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {c.code} - {c.document}
                      </p>
                    </div>
                  </div>
                  <Link to={`/clients/${c.id}/edit`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-secondary/60"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 pt-2.5 border-t border-border/70">
                  <p>
                    <span className="text-foreground/75 font-medium">Razão Social:</span>{' '}
                    {c.legal_name}
                  </p>
                  <p>
                    <span className="text-foreground/75 font-medium">Cidade:</span>{' '}
                    {c.address_city || 'N/A'}
                  </p>
                  <p>
                    <span className="text-foreground/75 font-medium">E-mail:</span>{' '}
                    {c.email || 'N/A'}
                  </p>
                </div>

                <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
                  <span className="rounded-md bg-secondary/50 px-2 py-0.5 border border-border/40">
                    Colaboradores:{' '}
                    <strong className="text-foreground">{contactCounts[c.id] || 0}</strong>
                  </span>
                  <span className="rounded-md bg-secondary/50 px-2 py-0.5 border border-border/40">
                    Filiais: <strong className="text-foreground">{branchCounts[c.id] || 0}</strong>
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={
                      c.status === 'Ativo'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'border-border bg-secondary text-muted-foreground'
                    }
                  >
                    {c.status || 'Ativo'}
                  </Badge>
                  <Link
                    to={`/clients/${c.id}/edit`}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver detalhes →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando clientes...
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} cliente(s) selecionado(s)? Esta ação
              não pode ser desfeita. <strong>Todos os registros relacionados</strong> serão
              permanentemente removidos, incluindo: filiais, departamentos, contatos, equipamentos,
              contratos, chamados, visitas técnicas, aprovações, pesquisas de satisfação e demais
              dados vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
