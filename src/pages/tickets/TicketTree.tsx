import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Network,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
  ChevronDown,
  Building2,
  User,
  AlertCircle,
  RefreshCw,
  TreePine,
  FolderTree,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getTicketHierarchy,
  buildTicketForest,
  countDescendants,
  TicketRecord,
  TicketTreeNode,
} from '@/services/tickets'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'

/** Coleta todos os ids de nós de uma floresta (para expandir/colapsar todos). */
function collectAllIds(nodes: TicketTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: TicketTreeNode[]) => {
    for (const n of list) {
      if (n.children.length > 0) {
        ids.push(n.ticket.id)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return ids
}

interface TreeNodeProps {
  node: TicketTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}

function TreeNode({ node, depth, expanded, onToggle }: TreeNodeProps) {
  const t = node.ticket
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(t.id)
  const totalDescendants = countDescendants(node)

  return (
    <li className="select-none">
      <div
        className={cn(
          'group flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-3',
          depth === 0 ? 'border-primary/20' : 'border-border',
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}
      >
        {/* Indentação + toggle */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(t.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
              title={isOpen ? 'Colapsar' : 'Expandir'}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            </span>
          )}

          {/* Número do ticket (clicável) */}
          <Link
            to={`/tickets/${t.id}`}
            className="shrink-0 text-sm font-bold text-primary hover:underline"
          >
            {t.number}
          </Link>

          {/* Badge de filhos */}
          {hasChildren && (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-primary/10 text-primary"
              title={`${totalDescendants} descendente(s)`}
            >
              <FolderTree className="h-3 w-3" />
              {totalDescendants}
            </Badge>
          )}

          {/* Título */}
          <Link
            to={`/tickets/${t.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
            title={t.title}
          >
            {t.title}
          </Link>
        </div>

        {/* Metadados (linha inferior no mobile, colunas no desktop) */}
        <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-0">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="max-w-[140px] truncate">
              {t.expand?.company?.trade_name || 'Geral'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="max-w-[140px] truncate">
              {t.expand?.assigned_to?.name || 'Não atribuído'}
            </span>
          </span>
        </div>
      </div>

      {hasChildren && isOpen && (
        <ul className="mt-1.5 space-y-1.5 border-l-2 border-border/60 ml-3 pl-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.ticket.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TicketTree() {
  const permissions = usePermissions()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTicketHierarchy()
      setTickets(data)
      // Por padrão, expande todas as raízes.
      setExpanded(new Set(buildTicketForest(data).map((n) => n.ticket.id)))
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar a hierarquia de tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('tickets', () => {
    load()
  })

  const forest = useMemo(() => buildTicketForest(tickets), [tickets])
  const allExpandableIds = useMemo(() => collectAllIds(forest), [forest])
  const allExpanded =
    allExpandableIds.length > 0 && allExpandableIds.every((id) => expanded.has(id))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(allExpandableIds))
  const collapseAll = () => setExpanded(new Set())

  // Permissão: clientes solicitantes usam o portal, não esta tela. A rota é
  // protegida pelo Layout/ProtectedRoute; aqui apenas garantimos que usuários
  // sem acesso a tickets não vejam conteúdo (carga ainda respeita as regras de
  // API do PocketBase).
  if (!permissions.isTecnico && !permissions.isClienteGestor) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para visualizar a hierarquia de tickets.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Erro ao carregar hierarquia</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Hierarquia de Tickets</h2>
            <p className="text-xs text-muted-foreground">Visão em árvore dos tickets pai/filho</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} disabled={allExpanded}>
            <ChevronsUpDown className="mr-1.5 h-4 w-4" />
            Expandir Todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} disabled={expanded.size === 0}>
            <ChevronsDownUp className="mr-1.5 h-4 w-4" />
            Colapsar Todos
          </Button>
        </div>
      </div>

      {/* Árvore ou estado vazio */}
      {forest.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <TreePine className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhuma hierarquia de tickets encontrada. Tickets pai/filho aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1.5">
          {forest.map((node) => (
            <TreeNode
              key={node.ticket.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
