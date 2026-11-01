import { useState, useMemo } from 'react'
import {
  GRANULAR_SYSTEM_MODULES,
  GranularModuleDefinition,
  GranularPermissionItem,
  ModuleKey,
} from '@/types/profiles'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react'

interface PermissionMatrixEditorProps {
  granularPermissions: Record<string, boolean>
  onChange: (newPermissions: Record<string, boolean>) => void
  disabled?: boolean
  isAdminProfile?: boolean
}

export function PermissionMatrixEditor({
  granularPermissions,
  onChange,
  disabled = false,
  isAdminProfile = false,
}: PermissionMatrixEditorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // Todos expandidos por padrão
    const initial: Record<string, boolean> = {}
    GRANULAR_SYSTEM_MODULES.forEach((m) => {
      initial[m.key] = true
    })
    return initial
  })

  const categories = useMemo(() => {
    const set = new Set<string>()
    GRANULAR_SYSTEM_MODULES.forEach((m) => set.add(m.category))
    return Array.from(set)
  }, [])

  // Filtragem por busca e categoria
  const filteredModules = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return GRANULAR_SYSTEM_MODULES.filter((mod) => {
      if (selectedCategory !== 'all' && mod.category !== selectedCategory) {
        return false
      }
      if (!term) return true

      const modMatch =
        mod.label.toLowerCase().includes(term) || mod.description.toLowerCase().includes(term)
      const itemMatch = mod.items.some(
        (i) =>
          i.label.toLowerCase().includes(term) ||
          (i.description || '').toLowerCase().includes(term),
      )
      return modMatch || itemMatch
    })
  }, [searchTerm, selectedCategory])

  const toggleModuleExpand = (modKey: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modKey]: !prev[modKey],
    }))
  }

  const handleToggleItem = (moduleKey: ModuleKey, itemKey: string, currentGranted: boolean) => {
    if (disabled || isAdminProfile) return
    const fullKey = `${moduleKey}.${itemKey}`
    onChange({
      ...granularPermissions,
      [fullKey]: !currentGranted,
    })
  }

  const handleToggleAllInModule = (module: GranularModuleDefinition, grantAll: boolean) => {
    if (disabled || isAdminProfile) return
    const next = { ...granularPermissions }
    module.items.forEach((item) => {
      next[`${module.key}.${item.key}`] = grantAll
    })
    onChange(next)
  }

  const handleGrantEverything = () => {
    if (disabled || isAdminProfile) return
    const next: Record<string, boolean> = {}
    GRANULAR_SYSTEM_MODULES.forEach((mod) => {
      mod.items.forEach((item) => {
        next[`${mod.key}.${item.key}`] = true
      })
    })
    onChange(next)
  }

  const handleRevokeEverything = () => {
    if (disabled || isAdminProfile) return
    const next: Record<string, boolean> = {}
    GRANULAR_SYSTEM_MODULES.forEach((mod) => {
      mod.items.forEach((item) => {
        next[`${mod.key}.${item.key}`] = false
      })
    })
    onChange(next)
  }

  // Estatísticas gerais
  const stats = useMemo(() => {
    let totalItems = 0
    let grantedItems = 0
    GRANULAR_SYSTEM_MODULES.forEach((mod) => {
      mod.items.forEach((item) => {
        totalItems++
        const fullKey = `${mod.key}.${item.key}`
        if (isAdminProfile || granularPermissions[fullKey] !== false) {
          grantedItems++
        }
      })
    })
    return { totalItems, grantedItems }
  }, [granularPermissions, isAdminProfile])

  return (
    <div className="space-y-4">
      {/* Banner de perfil Administrador */}
      {isAdminProfile && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-medium">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold block text-sm">Acesso Total Permanente</span>
            O perfil Administrador possui acesso irrestrito e total a todos os módulos, telas e
            relatórios do sistema. As permissões não podem ser revogadas.
          </div>
        </div>
      )}

      {/* Barra de ações e busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-2 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo ou relatório específico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground mr-1">
            <span className="text-primary font-bold">{stats.grantedItems}</span>/{stats.totalItems}{' '}
            acessos concedidos
          </span>

          {!isAdminProfile && !disabled && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGrantEverything}
                className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Conceder Tudo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevokeEverything}
                className="h-8 text-xs gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-500"
              >
                <XCircle className="h-3.5 w-3.5" /> Retirar Tudo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filtro por categoria */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          className="h-7 text-xs px-2.5"
          onClick={() => setSelectedCategory('all')}
        >
          Todos ({GRANULAR_SYSTEM_MODULES.length})
        </Button>
        {categories.map((cat) => {
          const count = GRANULAR_SYSTEM_MODULES.filter((m) => m.category === cat).length
          return (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({count})
            </Button>
          )
        })}
      </div>

      {/* Lista de módulos e itens granulares */}
      <div className="space-y-3 pt-2">
        {filteredModules.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            Nenhum módulo ou relatório encontrado com o filtro aplicado.
          </div>
        ) : (
          filteredModules.map((mod) => {
            const isExpanded = expandedModules[mod.key] ?? true
            const moduleItemsCount = mod.items.length
            const moduleGrantedCount = mod.items.filter((item) => {
              const fullKey = `${mod.key}.${item.key}`
              return isAdminProfile || granularPermissions[fullKey] !== false
            }).length

            const allInModuleGranted = moduleGrantedCount === moduleItemsCount
            const noneInModuleGranted = moduleGrantedCount === 0

            return (
              <Card
                key={mod.key}
                className="overflow-hidden border border-border/80 bg-card/60 transition-all duration-200"
              >
                {/* Header do Módulo */}
                <div className="flex items-center justify-between p-3.5 bg-secondary/20 hover:bg-secondary/30 transition-colors border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => toggleModuleExpand(mod.key)}
                    className="flex items-center gap-2.5 text-left flex-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{mod.label}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono py-0 px-1.5 border-border/70"
                        >
                          {mod.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {mod.description}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
                      <span
                        className={
                          allInModuleGranted
                            ? 'text-emerald-500 font-semibold'
                            : noneInModuleGranted
                              ? 'text-red-500 font-semibold'
                              : 'text-primary font-semibold'
                        }
                      >
                        {moduleGrantedCount}
                      </span>
                      /{moduleItemsCount} liberados
                    </span>

                    {!isAdminProfile && !disabled && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAllInModule(mod, true)}
                          title="Conceder todos os itens deste módulo"
                          className="h-7 text-[11px] px-2 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                        >
                          Todos
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAllInModule(mod, false)}
                          title="Retirar todos os itens deste módulo"
                          className="h-7 text-[11px] px-2 text-red-600 hover:text-red-500 hover:bg-red-500/10"
                        >
                          Nenhum
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Itens granulares dentro do Módulo */}
                {isExpanded && (
                  <CardContent className="p-0 divide-y divide-border/40">
                    {mod.items.map((item: GranularPermissionItem) => {
                      const fullKey = `${mod.key}.${item.key}`
                      // Se for admin, sempre true; se não tiver chave, default é true para não quebrar
                      const isGranted = isAdminProfile || granularPermissions[fullKey] !== false

                      return (
                        <div
                          key={item.key}
                          className={`flex items-center justify-between p-3 pl-8 sm:pl-10 transition-colors ${
                            isGranted ? 'bg-card/40' : 'bg-red-500/[0.02] opacity-80'
                          } hover:bg-secondary/15`}
                        >
                          <div className="space-y-0.5 pr-4 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-medium ${
                                  isGranted
                                    ? 'text-foreground'
                                    : 'text-muted-foreground line-through'
                                }`}
                              >
                                {item.label}
                              </span>
                              {item.path && (
                                <code className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1 py-0.2 rounded font-mono hidden md:inline-block">
                                  {item.path}
                                </code>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <Badge
                              variant={isGranted ? 'default' : 'outline'}
                              className={`text-[10px] uppercase font-mono px-1.5 py-0 ${
                                isGranted
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : 'bg-red-500/10 text-red-500 border border-red-500/30'
                              }`}
                            >
                              {isGranted ? 'Concedido' : 'Retirado'}
                            </Badge>

                            <Switch
                              checked={isGranted}
                              disabled={disabled || isAdminProfile}
                              onCheckedChange={() => handleToggleItem(mod.key, item.key, isGranted)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
