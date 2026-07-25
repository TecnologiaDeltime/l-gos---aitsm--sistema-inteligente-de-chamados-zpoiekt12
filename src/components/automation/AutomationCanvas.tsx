import { useRef } from 'react'
import { BlockNode } from '@/components/automation/BlockNode'
import type { WorkflowBlock, WorkflowConnection } from '@/types/automation'
import { getBlockMeta } from '@/lib/workflow-constants'

interface AutomationCanvasProps {
  blocks: WorkflowBlock[]
  connections: WorkflowConnection[]
  selectedId: string | null
  connectingFrom: string | null
  connectingPort: string | null
  zoom: number
  onSelectBlock: (id: string | null) => void
  onAddBlockAt: (type: string, x: number, y: number) => void
  onStartConnect: (blockId: string, port: string | null) => void
  onCompleteConnect: (blockId: string) => void
  onMoveBlock: (id: string, x: number, y: number) => void
  onDeleteConnection: (connId: string) => void
}

export function AutomationCanvas({
  blocks,
  connections,
  selectedId,
  connectingFrom,
  connectingPort,
  zoom,
  onSelectBlock,
  onAddBlockAt,
  onStartConnect,
  onCompleteConnect,
  onMoveBlock,
  onDeleteConnection,
}: AutomationCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragData = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('blockType')
    if (type && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      onAddBlockAt(type, (e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom)
    }
  }

  const handleBlockDrag = (id: string, dx: number, dy: number) => {
    if (!dragData.current) {
      const block = blocks.find((b) => b.id === id)
      if (block) dragData.current = { id, startX: 0, startY: 0, origX: block.x, origY: block.y }
    }
    if (dragData.current) {
      onMoveBlock(id, dragData.current.origX + dx / zoom, dragData.current.origY + dy / zoom)
    }
  }

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 overflow-auto bg-slate-50"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
      onClick={() => onSelectBlock(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          width: '3000px',
          height: '2000px',
          position: 'relative',
        }}
      >
        <svg className="absolute inset-0 pointer-events-none" width="3000" height="2000">
          {connections.map((conn) => {
            const src = blocks.find((b) => b.id === conn.source)
            const tgt = blocks.find((b) => b.id === conn.target)
            if (!src || !tgt) return null
            const x1 = src.x + 176,
              y1 = src.y + 60
            const x2 = tgt.x,
              y2 = tgt.y + 60
            const midX = (x1 + x2) / 2
            return (
              <g
                key={conn.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteConnection(conn.id)
                }}
              >
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={conn.sourcePort === 'no' ? '#ef4444' : '#3b82f6'}
                  strokeWidth={2}
                  strokeDasharray={connectingFrom === conn.source ? '0' : '0'}
                />
                <circle cx={x2} cy={y2} r={4} fill="#3b82f6" />
              </g>
            )
          })}
        </svg>
        {blocks.map((block) => (
          <div
            key={block.id}
            onClick={(e) => {
              e.stopPropagation()
              onSelectBlock(block.id)
            }}
          >
            <BlockNode
              block={block}
              selected={selectedId === block.id}
              connectingFrom={connectingFrom}
              onSelect={() => onSelectBlock(block.id)}
              onStartConnect={(port) => onStartConnect(block.id, port)}
              onDrag={(dx, dy) => handleBlockDrag(block.id, dx, dy)}
              onDragEnd={() => {
                dragData.current = null
              }}
            />
          </div>
        ))}
        {connectingFrom && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-xs text-white shadow-lg">
            Clique em um bloco para conectar...
          </div>
        )}
      </div>
    </div>
  )
}
