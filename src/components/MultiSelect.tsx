import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, ChevronsUpDown } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      onChange([...value, val])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between" type="button">
          <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
            {value.length === 0 ? (
              <span className="text-slate-400 text-sm">{placeholder}</span>
            ) : (
              <>
                {value.slice(0, 3).map((v) => {
                  const opt = options.find((o) => o.value === v)
                  return (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {opt?.label || v}
                    </Badge>
                  )
                })}
                {value.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{value.length - 3}
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ScrollArea className="h-48">
          <div className="p-1 space-y-0.5">
            {options.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">Nenhuma opção disponível</p>
            ) : (
              options.map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer text-sm"
                  onClick={() => toggle(opt.value)}
                >
                  <div className="h-4 w-4 rounded border border-slate-300 flex items-center justify-center shrink-0">
                    {value.includes(opt.value) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
