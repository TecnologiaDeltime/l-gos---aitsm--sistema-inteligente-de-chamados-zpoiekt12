import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getChanges, type ChangeRecord } from '@/services/changes'
import { getChangeTypes, type ChangeTypeRecord } from '@/services/change-types'
import { ChangeStatusBadge } from '@/components/ChangeStatusBadge'
import { STATUS_COLORS } from '@/lib/change-constants'
import { useRealtime } from '@/hooks/use-realtime'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function ChangeCalendar() {
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [types, setTypes] = useState<ChangeTypeRecord[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [typeFilter, setTypeFilter] = useState('all')

  const loadData = () => {
    getChanges()
      .then(setChanges)
      .catch(() => {})
    getChangeTypes()
      .then(setTypes)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('changes', () => loadData())

  const scheduledChanges = useMemo(() => {
    return changes.filter((c) => {
      if (!c.planned_start) return false
      if (typeFilter !== 'all' && c.change_type !== typeFilter) return false
      return true
    })
  }, [changes, typeFilter])

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

  const getChangesForDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return scheduledChanges.filter((c) => {
      if (!c.planned_start) return false
      const start = new Date(c.planned_start)
      return start.toDateString() === date.toDateString()
    })
  }

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Calendário de Mudanças</h2>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-r border-b bg-muted/30" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayChanges = getChangesForDay(day)
            const isToday =
              new Date().toDateString() ===
              new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
            return (
              <div
                key={day}
                className={`min-h-[100px] border-r border-b p-1.5 ${isToday ? 'bg-primary/5' : ''}`}
              >
                <span
                  className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {day}
                </span>
                <div className="space-y-1 mt-1">
                  {dayChanges.slice(0, 3).map((c) => (
                    <Link
                      key={c.id}
                      to={`/changes/${c.id}`}
                      className={`block rounded px-1.5 py-0.5 text-[10px] truncate hover:opacity-80 ${STATUS_COLORS[c.status] || 'bg-slate-100'}`}
                    >
                      {c.number}
                    </Link>
                  ))}
                  {dayChanges.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{dayChanges.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
