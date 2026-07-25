import { BLOCK_TYPES } from '@/lib/workflow-constants'
import { cn } from '@/lib/utils'

interface BlockSidebarProps {
  onAddBlock: (type: string) => void
  onDragStart: (type: string) => void
}

export function BlockSidebar({ onAddBlock, onDragStart }: BlockSidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 border-r bg-white p-3 overflow-y-auto">
      <h3 className="mb-3 text-xs font-bold uppercase text-slate-500">Blocos</h3>
      <div className="space-y-1.5">
        {BLOCK_TYPES.map((bt) => {
          const Icon = bt.icon
          return (
            <div
              key={bt.type}
              draggable
              onDragStart={() => onDragStart(bt.type)}
              onClick={() => onAddBlock(bt.type)}
              className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-blue-400 hover:bg-blue-50 active:cursor-grabbing"
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md text-white',
                  bt.color,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{bt.label}</p>
                <p className="truncate text-[10px] text-slate-500">{bt.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
        <p className="font-semibold text-slate-600">Dica:</p>
        <p>
          Arraste blocos para a tela ou clique para adicionar. Conecte clicando na saída de um bloco
          e depois no destino.
        </p>
      </div>
    </div>
  )
}
