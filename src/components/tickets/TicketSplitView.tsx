import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Columns2, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TicketDetail from '@/pages/tickets/TicketDetail'
import { useIsMobile } from '@/hooks/use-mobile'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { TicketRecord } from '@/services/tickets'
import {
  computeSlaResponseStatus,
  computeSlaSolutionStatus,
  formatDeadline,
} from '@/lib/sla-status'
import { formatDateTime } from '@/lib/date-format'
import { cn } from '@/lib/utils'

interface TicketSplitViewProps {
  /** Base COMPLETA de chamados (não filtrada) — usada para o painel persistir. */
  tickets: TicketRecord[]
  /** Chamados após os filtros globais da Fila (busca, status, cliente...). */
  filtered: TicketRecord[]
  selectedTicketId: string | null
  onSelectTicket: (id: string) => void
  /** Se true, a lista ignora os filtros globais (comportamento exclusivo da Tela Dividida). */
  listIgnoresFilters: boolean
  onToggleListFilters: () => void
}

const PRIORITY_ORDER: Record<string, number> = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 }

const STATUS_OPTIONS = [
  'Novo',
  'Atribuído',
  'Em Atendimento',
  'Pendente',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Agendado',
  'Resolvido',
  'Encerrado',
  'Cancelado',
  'Reaberto',
  'Reprovado',
]

const RISK_CLASSES: Record<string, string> = {
  Violado: 'text-red-600 dark:text-red-400 font-semibold',
  Crítico: 'text-red-500 dark:text-red-400 font-semibold',
  Risco: 'text-orange-600 dark:text-orange-400',
  Atenção: 'text-amber-600 dark:text-amber-400',
}

function SplitRow({
  ticket,
  selected,
  onSelect,
}: {
  ticket: TicketRecord
  selected: boolean
  onSelect: (id: string) => void
}) {
  const solutionStatus = computeSlaSolutionStatus(ticket)
  const companyName = ticket.expand?.company?.trade_name || ticket.expand?.company?.name || ''

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(ticket.id)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
          'min-h-[44px] lg:min-h-0',
          selected
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-transparent bg-card',
        )}
      >
        {/* Linha 1: número + criticidade + SLA solução */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-primary">{ticket.number}</span>
            {ticket.is_internal && (
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 h-4 px-1 py-0 text-[10px] font-semibold"
              >
                Interno
              </Badge>
            )}
          </div>
          <PriorityBadge priority={ticket.priority} />
        </div>

        {/* Linha 2: título */}
        <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{ticket.title}</p>

        {/* Linha 3: cliente · abertura */}
        <div className="mt-1 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
          {companyName && <span className="truncate">{companyName}</span>}
          {companyName && <span aria-hidden="true">·</span>}
          <span className="whitespace-nowrap">{formatDateTime(ticket.created)}</span>
        </div>

        {/* Linha 4: status + SLA solução */}
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t pt-1.5 dark:border-slate-800">
          <StatusBadge status={ticket.status} />
          <div
            className={cn(
              'flex items-center gap-1 truncate text-[11px]',
              RISK_CLASSES[solutionStatus] || 'text-muted-foreground',
            )}
            title={`Vencimento SLA: ${formatDeadline(ticket.sla_solution_deadline)}`}
          >
            {ticket.sla_solution_deadline && (
              <SlaStatusBadge
                type="solution"
                status={solutionStatus}
                deadline={ticket.sla_solution_deadline}
                completedAt={ticket.sla_solution_at}
              />
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

/**
 * TELA DIVIDIDA da Fila de Tickets — composição PRÓPRIA, sem depender do
 * KanbanBoard. Lista compacta de chamados à esquerda (coluna única) e a
 * FICHA COMPLETA (TicketDetail, variant="panel") à direita, com rolagem
 * independente. O chamado selecionado é resolvido na base completa
 * (`tickets`), então o painel PERSISTE mesmo quando um filtro esconde o
 * chamado da lista. Em mobile (<1024px) empilha: lista em cima, ficha embaixo.
 */
export function TicketSplitView({
  tickets,
  filtered,
  selectedTicketId,
  onSelectTicket,
  listIgnoresFilters,
  onToggleListFilters,
}: TicketSplitViewProps) {
  const isMobile = useIsMobile()
  const [localSearch, setLocalSearch] = useState('')
  const [localStatus, setLocalStatus] = useState<string>('all')
  const [localSort, setLocalSort] = useState<'created' | 'priority' | 'number'>('created')
  const listRef = useRef<HTMLDivElement>(null)

  // A lista da Tela Dividida tem FILTROS PRÓPRIOS (busca, status e ordenação),
  // independentes dos filtros globais da Fila.
  const listTickets = useMemo(() => {
    const base = listIgnoresFilters ? tickets : filtered
    let list = [...base]
    if (localSearch.trim()) {
      const tokens = localSearch.toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter((t) => {
        const hay = `${t.number || ''} ${t.title || ''} ${t.requester_name || ''} ${
          t.expand?.company?.trade_name || ''
        }`.toLowerCase()
        return tokens.every((token) => hay.includes(token))
      })
    }
    if (localStatus !== 'all') list = list.filter((t) => t.status === localStatus)
    const dir = localSort === 'created' ? -1 : 1
    return list.sort((a, b) => {
      if (localSort === 'priority') {
        return ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir
      }
      if (localSort === 'number') {
        return (a.number || '').localeCompare(b.number || '', 'pt-BR', { numeric: true }) * dir
      }
      return (new Date(a.created).getTime() - new Date(b.created).getTime()) * dir
    })
  }, [listIgnoresFilters, tickets, filtered, localSearch, localStatus, localSort])

  const selectedTicket = selectedTicketId
    ? tickets.find((t) => t.id === selectedTicketId) || null
    : null

  // Foco na lista ao montar/trocar de visão (navegação por teclado).
  useEffect(() => {
    // Sem auto-foco agressivo: apenas garante que o contêiner exista para a âncora.
    listRef.current?.setAttribute('tabindex', '-1')
  }, [])

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(480px,2fr)]">
      {/* ---------- Coluna esquerda: LISTA COMPACTA ---------- */}
      <div
        ref={listRef}
        className="min-w-0 rounded-xl border bg-card shadow-sm lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col"
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Columns2 className="h-3.5 w-3.5" />
            Chamados ({listTickets.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1 px-2 text-xs',
              listIgnoresFilters && 'text-muted-foreground',
              !listIgnoresFilters && 'text-primary',
            )}
            onClick={onToggleListFilters}
            title={
              listIgnoresFilters
                ? 'Lista mostrando TODOS os chamados (filtros da Fila desconsiderados)'
                : 'Lista seguindo os filtros aplicados na Fila'
            }
          >
            <ListFilter className="h-3.5 w-3.5" />
            {listIgnoresFilters ? 'Todos' : 'Filtrada'}
          </Button>
        </div>

        {/* Filtros locais da lista */}
        <div className="space-y-2 border-b px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar na lista..."
              className="h-11 pl-8 lg:h-8"
              aria-label="Buscar na lista de chamados"
            />
            {localSearch && (
              <button
                type="button"
                aria-label="Limpar busca da lista"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={localStatus} onValueChange={setLocalStatus}>
              <SelectTrigger className="h-11 flex-1 lg:h-8" aria-label="Filtrar lista por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={localSort} onValueChange={(v) => setLocalSort(v as typeof localSort)}>
              <SelectTrigger className="h-11 w-[130px] lg:h-8" aria-label="Ordenar lista">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Mais recentes</SelectItem>
                <SelectItem value="priority">Criticidade</SelectItem>
                <SelectItem value="number">Nº do chamado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista rolável (independente da ficha) */}
        <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
          {listTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <SlidersHorizontal className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum chamado nesta lista.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {listTickets.map((t) => (
                <SplitRow
                  key={t.id}
                  ticket={t}
                  selected={t.id === selectedTicketId}
                  onSelect={onSelectTicket}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Coluna direita: FICHA COMPLETA ---------- */}
      <div
        id="ticket-detail-panel"
        className="min-w-0 scroll-mt-20 rounded-xl border bg-card p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
      >
        {selectedTicket ? (
          <TicketDetail variant="panel" ticketId={selectedTicket.id} key={selectedTicket.id} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <Columns2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Selecione um chamado na lista para ver a ficha completa aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
