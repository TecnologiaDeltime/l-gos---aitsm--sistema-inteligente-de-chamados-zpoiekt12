import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HOUR_TYPES, BILLING_STATUSES, createInteraction } from '@/services/ticket-interactions'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

function formatTime(s: number) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export function Stopwatch({ ticketId }: { ticketId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [hourType, setHourType] = useState('Contratada')
  const [billingStatus, setBillingStatus] = useState('Faturável')
  const [description, setDescription] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<Date | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000))
        }
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const handleStart = () => {
    startRef.current = new Date()
    setRunning(true)
  }
  const handlePause = () => {
    setRunning(false)
  }

  const handleStop = useCallback(async () => {
    if (!user || !startRef.current) return
    setRunning(false)
    const endTime = new Date()
    const duration = Math.max(
      1,
      Math.round((endTime.getTime() - startRef.current.getTime()) / 60000),
    )
    try {
      await createInteraction({
        ticket: ticketId,
        author: user.id,
        type: 'Interno',
        content: description || 'Tempo registrado via cronômetro',
        start_time: startRef.current.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: duration,
        hour_type: hourType,
        billing_status: billingStatus,
        origin: 'Cronômetro',
        approved: false,
      })
      toast({ title: 'Tempo registrado com sucesso!' })
      setElapsed(0)
      setDescription('')
      startRef.current = null
    } catch {
      toast({ title: 'Erro ao registrar tempo', variant: 'destructive' })
    }
  }, [user, ticketId, description, hourType, billingStatus, toast])

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-600" />
        <span className="font-bold text-lg tabular-nums">{formatTime(elapsed)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={hourType} onValueChange={setHourType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={billingStatus} onValueChange={setBillingStatus}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILLING_STATUSES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        placeholder="Descrição da atividade"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        {!running ? (
          <Button size="sm" onClick={handleStart} className="bg-green-600 hover:bg-green-700">
            <Play className="h-3.5 w-3.5 mr-1" />
            Iniciar
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handlePause}>
            <Pause className="h-3.5 w-3.5 mr-1" />
            Pausar
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={handleStop} disabled={elapsed === 0}>
          <Square className="h-3.5 w-3.5 mr-1" />
          Parar e Salvar
        </Button>
      </div>
    </div>
  )
}
