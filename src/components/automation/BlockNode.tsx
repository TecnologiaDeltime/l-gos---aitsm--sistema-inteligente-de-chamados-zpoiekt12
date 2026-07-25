import { getBlockMeta } from '@/lib/workflow-constants'
import { cn } from '@/lib/utils'
import type { WorkflowBlock } from '@/types/automation'

interface BlockNodeProps {
  block: WorkflowBlock
  selected: boolean
  connectingFrom: string | null
  onSelect: () => void
  onStartConnect: (port?: string) => void
  onDrag: (dx: number, dy: number) => void
  onDragEnd: () => void
}

export function BlockNode({
  block,
  selected,
  connectingFrom,
  onSelect,
  onStartConnect,
  onDrag,
  onDragEnd,
}: BlockNodeProps) {
  const meta = getBlockMeta(block.type)
  const Icon = meta.icon
  const isConditional = block.type === 'condition' || block.type === 'decision'

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.port) return
    e.stopPropagation()
    onSelect()
    const startX = e.clientX
    const startY = e.clientY
    const onMove = (ev: MouseEvent) => onDrag(ev.clientX - startX, ev.clientY - startY)
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      onDragEnd()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={cn(
        'absolute w-44 cursor-move select-none rounded-lg border-2 bg-white shadow-md transition-shadow',
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200',
      )}
      style={{ left: block.x, top: block.y }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn('flex items-center gap-1.5 rounded-t-md px-2 py-1.5 text-white', meta.color)}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold truncate">{block.label || meta.label}</span>
      </div>
      {block.config?.trigger && (
        <p className="px-2 py-1 text-[10px] text-slate-600 truncate">{block.config.trigger}</p>
      )}
      {block.config?.actionType && (
        <p className="px-2 py-1 text-[10px] text-slate-600 truncate">{block.config.actionType}</p>
      )}
      {block.config?.outcome && (
        <p className="px-2 py-1 text-[10px] text-slate-600 truncate">{block.config.outcome}</p>
      )}
      <div className="flex items-center justify-between px-2 py-1 border-t border-slate-100">
        <div
          data-port="input"
          className="h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-white"
        />
        <div className="flex gap-1">
          {isConditional ? (
            <>
              <button
                data-port="yes"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartConnect('yes')
                }}
                className={cn(
                  'flex h-5 items-center gap-0.5 rounded px-1 text-[9px] font-bold',
                  connectingFrom === block.id
                    ? 'bg-green-100 text-green-700'
                    : 'bg-green-50 text-green-600',
                )}
              >
                Sim
              </button>
              <button
                data-port="no"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartConnect('no')
                }}
                className={cn(
                  'flex h-5 items-center gap-0.5 rounded px-1 text-[9px] font-bold',
                  connectingFrom === block.id
                    ? 'bg-red-100 text-red-700'
                    : 'bg-red-50 text-red-600',
                )}
              >
                Não
              </button>
            </>
          ) : (
            <div
              data-port="output"
              onClick={(e) => {
                e.stopPropagation()
                onStartConnect('output')
              }}
              className="h-2.5 w-2.5 cursor-pointer rounded-full border-2 border-blue-500 bg-blue-100 hover:bg-blue-300"
            />
          )}
        </div>
      </div>
    </div>
  )
}
