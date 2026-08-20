import { ProfileRecord, PermissionsMap, SYSTEM_MODULES, ModuleKey } from '@/types/profiles'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Eye, Edit3, EyeOff, Info } from 'lucide-react'

interface PermissionMatrixEditorProps {
  permissions: PermissionsMap
  onChange: (permissions: PermissionsMap) => void
  disabled?: boolean
}

export function PermissionMatrixEditor({
  permissions,
  onChange,
  disabled = false,
}: PermissionMatrixEditorProps) {
  const categories = [
    'Atendimento',
    'Operações & Gestão',
    'Relatórios & Qualidade',
    'Administração',
  ] as const

  const handleHiddenToggle = (modKey: ModuleKey, checked: boolean) => {
    if (disabled) return
    const current = permissions[modKey] || { read: false, write: false, hidden: false }
    const updated: PermissionsMap = {
      ...permissions,
      [modKey]: {
        hidden: checked,
        // If hidden is checked, read & write are disabled/cleared
        read: checked ? false : current.read,
        write: checked ? false : current.write,
      },
    }
    onChange(updated)
  }

  const handleReadToggle = (modKey: ModuleKey, checked: boolean) => {
    if (disabled) return
    const current = permissions[modKey] || { read: false, write: false, hidden: false }
    const updated: PermissionsMap = {
      ...permissions,
      [modKey]: {
        hidden: false,
        read: checked,
        // If unchecking read, write also cannot exist without read
        write: checked ? current.write : false,
      },
    }
    onChange(updated)
  }

  const handleWriteToggle = (modKey: ModuleKey, checked: boolean) => {
    if (disabled) return
    const updated: PermissionsMap = {
      ...permissions,
      [modKey]: {
        hidden: false,
        // If write is checked, read is automatically true
        read: checked ? true : (permissions[modKey]?.read ?? true),
        write: checked,
      },
    }
    onChange(updated)
  }

  const handleSetCategoryAll = (cat: string, action: 'all_write' | 'all_read' | 'all_hidden') => {
    if (disabled) return
    const modsInCat = SYSTEM_MODULES.filter((m) => m.category === cat)
    const updated: PermissionsMap = { ...permissions }

    modsInCat.forEach((m) => {
      if (action === 'all_write') {
        updated[m.key] = { read: true, write: true, hidden: false }
      } else if (action === 'all_read') {
        updated[m.key] = { read: true, write: false, hidden: false }
      } else if (action === 'all_hidden') {
        updated[m.key] = { read: false, write: false, hidden: true }
      }
    })

    onChange(updated)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900 text-xs dark:bg-blue-950/40 dark:border-blue-900/50 dark:text-blue-300">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            Selecione as permissões de <strong>Leitura</strong>, <strong>Escrita</strong> ou{' '}
            <strong>Oculto</strong> para cada módulo. Ocultar um módulo bloqueia o acesso e o remove
            da navegação.
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const modules = SYSTEM_MODULES.filter((m) => m.category === category)

          return (
            <div
              key={category}
              className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{category}</h4>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {modules.length} módulos
                  </Badge>
                </div>

                {!disabled && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground mr-1">Ações rápidas:</span>
                    <button
                      type="button"
                      onClick={() => handleSetCategoryAll(category, 'all_write')}
                      className="px-2 py-0.5 rounded bg-background border hover:bg-muted text-[11px] text-foreground font-medium transition-colors"
                    >
                      Total (Escrita)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCategoryAll(category, 'all_read')}
                      className="px-2 py-0.5 rounded bg-background border hover:bg-muted text-[11px] text-foreground font-medium transition-colors"
                    >
                      Apenas Leitura
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCategoryAll(category, 'all_hidden')}
                      className="px-2 py-0.5 rounded bg-background border hover:bg-muted text-[11px] text-red-600 dark:text-red-400 font-medium transition-colors"
                    >
                      Ocultar Todos
                    </button>
                  </div>
                )}
              </div>

              <div className="divide-y divide-border">
                {modules.map((mod) => {
                  const current = permissions[mod.key] || {
                    read: false,
                    write: false,
                    hidden: false,
                  }
                  const isHidden = !!current.hidden
                  const isRead = !isHidden && !!current.read
                  const isWrite = !isHidden && !!current.write

                  return (
                    <div
                      key={mod.key}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 transition-colors items-center ${
                        isHidden ? 'bg-muted/20 opacity-75' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="md:col-span-6 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{mod.label}</span>
                          {isHidden && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-none"
                            >
                              Oculto
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                      </div>

                      <div className="md:col-span-6 flex items-center justify-end gap-6 sm:gap-8">
                        {/* Leitura */}
                        <label
                          className={`flex items-center gap-2 text-xs font-medium cursor-pointer select-none ${
                            isHidden || disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'text-foreground'
                          }`}
                        >
                          <Checkbox
                            checked={isRead}
                            disabled={disabled || isHidden}
                            onCheckedChange={(checked) =>
                              handleReadToggle(mod.key, checked === true)
                            }
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                          <span>Leitura</span>
                        </label>

                        {/* Escrita */}
                        <label
                          className={`flex items-center gap-2 text-xs font-medium cursor-pointer select-none ${
                            isHidden || disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'text-foreground'
                          }`}
                        >
                          <Checkbox
                            checked={isWrite}
                            disabled={disabled || isHidden}
                            onCheckedChange={(checked) =>
                              handleWriteToggle(mod.key, checked === true)
                            }
                            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                          <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Escrita</span>
                        </label>

                        {/* Oculto */}
                        <label
                          className={`flex items-center gap-2 text-xs font-medium cursor-pointer select-none ${
                            disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          <Checkbox
                            checked={isHidden}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              handleHiddenToggle(mod.key, checked === true)
                            }
                            className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                          />
                          <EyeOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          <span>Oculto</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
