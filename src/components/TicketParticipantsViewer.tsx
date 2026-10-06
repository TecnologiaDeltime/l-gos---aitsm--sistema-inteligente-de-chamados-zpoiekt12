import { useState, useMemo } from 'react'
import {
  Users,
  Eye,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  X,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TicketParticipant, ParticipantRole } from '@/services/ticket-participants'

interface TicketParticipantsViewerProps {
  participants: TicketParticipant[]
  loading?: boolean
  ticketNumber?: string
}

function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRelativeTime(dateIso?: string): string {
  if (!dateIso) return 'Sem registro'
  const date = new Date(dateIso)
  if (isNaN(date.getTime())) return 'Sem registro'

  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSeconds < 60) return 'Agora mesmo'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `há ${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `há ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `há ${diffDays} dias`

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRoleBadge(role: ParticipantRole) {
  switch (role) {
    case 'Solicitante':
      return (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] px-1.5 py-0"
        >
          Solicitante
        </Badge>
      )
    case 'Responsável':
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] px-1.5 py-0"
        >
          Responsável
        </Badge>
      )
    case 'Operador':
      return (
        <Badge
          variant="outline"
          className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] px-1.5 py-0"
        >
          Operador
        </Badge>
      )
    case 'Visualizou':
    default:
      return (
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 text-[10px] px-1.5 py-0"
        >
          Visualizou
        </Badge>
      )
  }
}

export function TicketParticipantsViewer({
  participants,
  loading = false,
  ticketNumber,
}: TicketParticipantsViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return participants
    const q = searchTerm.toLowerCase().trim()
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        p.roles.some((r) => r.toLowerCase().includes(q)),
    )
  }, [participants, searchTerm])

  const totalCount = participants.length
  const onlineCount = participants.filter((p) => p.online).length

  return (
    <aside
      aria-label="Participantes do chamado"
      className="fixed bottom-6 right-20 z-40 print:hidden"
    >
      {/* Botão flutuante compacto e discreto */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              className={`h-11 rounded-full px-3.5 shadow-lg border-slate-200/80 dark:border-slate-800 backdrop-blur-md transition-all duration-200 flex items-center gap-2 ${
                isOpen
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-slate-400/30 dark:shadow-none'
                  : 'bg-white/95 text-slate-800 dark:bg-slate-900/95 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/90'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
                {onlineCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"
                    title={`${onlineCount} ativo(s) agora`}
                  />
                )}
              </div>
              <span className="text-xs font-semibold tracking-tight">
                {loading ? '...' : totalCount}
              </span>
              <span className="hidden sm:inline text-xs font-medium text-muted-foreground">
                entraram
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-white dark:text-slate-900' : ''
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Ver todas as pessoas que entraram neste chamado
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Painel suspenso posicionado acima do botão no canto inferior direito */}
      {isOpen && (
        <div
          role="region"
          aria-label="Lista de participantes que entraram no chamado"
          className="absolute bottom-14 right-0 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/98 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden z-50"
        >
          {/* Header do painel */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-slate-50/80 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">
                  Quem entrou no chamado
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {ticketNumber ? `Ticket ${ticketNumber}` : 'Histórico de acessos e ações'} •{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {totalCount} {totalCount === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Busca rápida se houver mais de 4 participantes */}
          {participants.length > 4 && (
            <div className="border-b px-3 py-2 bg-white dark:bg-slate-950">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome, e-mail ou papel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs bg-slate-50/50 dark:bg-slate-900/50"
                />
              </div>
            </div>
          )}

          {/* Lista com scroll suave */}
          <ScrollArea className="max-h-[340px] px-2 py-2">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {searchTerm
                  ? 'Nenhum participante encontrado para esta busca.'
                  : 'Nenhum acesso registrado.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((p) => {
                  return (
                    <div
                      key={p.key}
                      className="group flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-900/70"
                    >
                      {/* Avatar com status de online */}
                      <div className="relative shrink-0 mt-0.5">
                        <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-800">
                          {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.name} />}
                          <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        {p.online && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950"
                            title="Ativo agora"
                          />
                        )}
                      </div>

                      {/* Informações da pessoa */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className="truncate text-xs font-medium text-slate-900 dark:text-slate-100"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <span
                            className="shrink-0 text-[10px] text-muted-foreground"
                            title={
                              p.lastActivityAt
                                ? new Date(p.lastActivityAt).toLocaleString('pt-BR')
                                : undefined
                            }
                          >
                            {formatRelativeTime(p.lastActivityAt)}
                          </span>
                        </div>

                        {p.email && (
                          <div
                            className="truncate text-[11px] text-muted-foreground"
                            title={p.email}
                          >
                            {p.email}
                          </div>
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {/* Badges de papel */}
                          {p.roles.map((r) => (
                            <span key={r}>{getRoleBadge(r)}</span>
                          ))}

                          {/* Ação recente */}
                          <span
                            className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]"
                            title={p.actionDescription}
                          >
                            • {p.actionDescription}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {/* Rodapé informativo */}
          <div className="border-t bg-slate-50/60 dark:bg-slate-900/40 px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3 text-slate-400" />
              Rastreamento em tempo real
            </span>
            <span>Ordenado por acesso recente</span>
          </div>
        </div>
      )}
    </aside>
  )
}
