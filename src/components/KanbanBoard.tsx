import { useState, useRef, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { TicketRecord } from '@/services/tickets'
import { KANBAN_COLUMNS } from '@/lib/kanban-constants'
import { KanbanCard } from '@/components/KanbanCard'
import { cn } from '@/lib/utils'

interface KanbanBoardProps {
  tickets: TicketRecord[]
  canEdit: boolean
  onStatusChange: (ticketId: string, newStatus: string, oldStatus: string) => Promise<void>
  hiddenColumns?: string[]
}

function getStatusDisplayName(status: string): string {
  if (status === 'Atribuído') return 'Em aberto'
  return status
}

export function KanbanBoard({
  tickets,
  canEdit = true,
  onStatusChange,
  hiddenColumns = [],
}: KanbanBoardProps) {
  const isMobile = useIsMobile()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const touchDragRef = useRef<{
    id: string
    oldStatus: string
    ghost: HTMLElement | null
    cardEl: HTMLElement
    startX: number
    startY: number
    started: boolean
  } | null>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  const handleDragStart = (e: React.DragEvent, ticket: TicketRecord) => {
    setDraggingId(ticket.id)
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: ticket.id, status: ticket.status }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDraggingId(null)
    try {
      const { id, status } = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (status !== newStatus) onStatusChangeRef.current(id, newStatus, status)
    } catch {
      /* noop */
    }
  }

  const handleTouchStart = (e: React.TouchEvent, ticket: TicketRecord) => {
    const touch = e.touches[0]
    touchDragRef.current = {
      id: ticket.id,
      oldStatus: ticket.status,
      ghost: null,
      cardEl: e.currentTarget as HTMLElement,
      startX: touch.clientX,
      startY: touch.clientY,
      started: false,
    }
  }

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const drag = touchDragRef.current
      if (!drag) return
      const touch = e.touches[0]
      if (!drag.started) {
        if (Math.abs(touch.clientX - drag.startX) < 5 && Math.abs(touch.clientY - drag.startY) < 5)
          return
        drag.started = true
        const ghost = drag.cardEl.cloneNode(true) as HTMLElement
        ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.85;width:${drag.cardEl.offsetWidth}px;left:${touch.clientX - drag.cardEl.offsetWidth / 2}px;top:${touch.clientY - 20}px;transform:rotate(2deg);`
        document.body.appendChild(ghost)
        drag.ghost = ghost
        setDraggingId(drag.id)
      }
      e.preventDefault()
      if (drag.ghost) {
        drag.ghost.style.left = `${touch.clientX - drag.ghost.offsetWidth / 2}px`
        drag.ghost.style.top = `${touch.clientY - 20}px`
        drag.ghost.style.display = 'none'
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        drag.ghost.style.display = ''
        const col = el?.closest('[data-column]')
        setDragOverColumn(col?.getAttribute('data-column') || null)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const drag = touchDragRef.current
      if (!drag) return
      let newStatus: string | null = null
      if (drag.started && drag.ghost) {
        const touch = e.changedTouches[0]
        drag.ghost.style.display = 'none'
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        newStatus = el?.closest('[data-column]')?.getAttribute('data-column') || null
        drag.ghost.remove()
      }
      touchDragRef.current = null
      setDraggingId(null)
      setDragOverColumn(null)
      if (newStatus && newStatus !== drag.oldStatus) {
        onStatusChangeRef.current(drag.id, newStatus, drag.oldStatus)
      }
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  return (
    <div
      className={cn('flex gap-3 overflow-x-auto pb-4', isMobile && 'flex-col overflow-x-visible')}
    >
      {KANBAN_COLUMNS.filter((status) => !hiddenColumns.includes(status)).map((status) => {
        const columnTickets = tickets.filter((t) => t.status === status)
        const isOver = dragOverColumn === status
        return (
          <div
            key={status}
            data-column={status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(status)
            }}
            onDrop={(e) => handleDrop(e, status)}
            onDragLeave={() => setDragOverColumn((p) => (p === status ? null : p))}
            className={cn(
              'flex-shrink-0 w-72 rounded-xl border bg-slate-50/50 dark:bg-slate-900/50',
              isMobile && 'w-full',
              isOver && 'ring-2 ring-primary bg-primary/5',
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {getStatusDisplayName(status)}
              </span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
                {columnTickets.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2 min-h-[80px] max-h-[calc(100vh-200px)] overflow-y-auto">
              {columnTickets.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhum chamado nesta coluna
                </p>
              ) : (
                columnTickets.map((t) => (
                  <KanbanCard
                    key={t.id}
                    ticket={t}
                    canEdit={canEdit}
                    isDragging={draggingId === t.id}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDragOverColumn(null)
                    }}
                    onTouchStart={handleTouchStart}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
