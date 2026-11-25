import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eraser, PenTool } from 'lucide-react'

interface SignatureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { name: string; role: string; signatureDataUrl: string }) => void
  defaultName?: string
  defaultRole?: string
}

const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 180

export function SignatureDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultName = '',
  defaultRole = '',
}: SignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [name, setName] = useState(defaultName)
  const [role, setRole] = useState(defaultRole)
  const [hasInk, setHasInk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setRole(defaultRole)
      setHasInk(false)
      setError('')
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [open, defaultName, defaultRole])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    canvasRef.current?.setPointerCapture(e.pointerId)
    const pos = getPos(e)
    ctx.strokeStyle = getComputedStyle(canvasRef.current!).color
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    drawingRef.current = true
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.preventDefault()
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  const endDraw = () => {
    drawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasInk(false)
    }
  }

  const handleConfirm = () => {
    if (!name.trim()) {
      setError('Informe o nome de quem acompanhou a visita.')
      return
    }
    if (!hasInk) {
      setError('Desenhe a assinatura antes de confirmar.')
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    onConfirm({
      name: name.trim(),
      role: role.trim(),
      signatureDataUrl: canvas.toDataURL('image/png'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assinatura de quem acompanhou</DialogTitle>
          <DialogDescription>
            Preencha o nome de quem acompanhou a visita e desenhe a assinatura no quadro abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="signature-name">Nome de quem acompanhou</Label>
            <Input
              id="signature-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder="Ex.: Maria Souza"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signature-role">Cargo / função (opcional)</Label>
            <Input
              id="signature-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              autoComplete="off"
              placeholder="Ex.: Coordenação de TI"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signature-canvas">Assinatura</Label>
            <canvas
              id="signature-canvas"
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              tabIndex={0}
              aria-label="Área de assinatura. Desenhe com o mouse ou toque."
              className="h-44 w-full touch-none rounded-md border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
                <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
                Limpar
              </Button>
              <p className="text-xs text-muted-foreground">Desenhe com o mouse ou o dedo</p>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!hasInk || !name.trim()}>
            <PenTool className="mr-2 h-4 w-4" aria-hidden="true" />
            Confirmar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
