import { useState, useMemo } from 'react'
import {
  GRANULAR_SYSTEM_MODULES,
  GranularModuleDefinition,
  GranularPermissionItem,
  ModuleKey,
  PermissionLevel,
  GranularPermissionValue,
  ProfilePermissionMap,
} from '@/types/profiles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Search,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Sliders,
  Ban,
  Layers,
} from 'lucide-react'

interface PermissionMatrixEditorProps {
  granularPermissions: ProfilePermissionMap
  onChange: (newPermissions: ProfilePermissionMap) => void
  disabled?: boolean
  isAdminProfile?: boolean
}

type LevelOption = {
  value: 'none' | PermissionLevel
  label: string
  shortLabel: string
  description: string
  activeClasses: string
  icon: typeof Eye
}

const LEVEL_OPTIONS: LevelOption[] = [
  {
    value: 'none',
    label: 'Sem acesso',
    shortLabel: 'Nenhum',
    description: 'Item/tela oculto para o usuário',
    activeClasses:
      'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-500/40',
    icon: Ban,
  },
  {
    value: 'view',
    label: 'Visualizar',
    shortLabel: 'Ver',
    description: 'Apenas consulta, não pode editar nem excluir',
    activeClasses:
      'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/40',
    icon: Eye,
  },
  {
    value: 'edit',
    label: 'Editar',
    shortLabel: 'Editar',
    description: 'Pode ver e editar/criar, mas não pode excluir',
    activeClasses:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/40',
    icon: Pencil,
  },
  {
    value: 'configure',
    label: 'Configurar',
    shortLabel: 'Configurar',
    description: 'Acesso total inclusive editar, excluir e configurar',
    activeClasses:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/40',
    icon: Sliders,
  },
]

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

  const getItemCurrentValue = (
    moduleKey: ModuleKey,
    itemKey: string,
  ): { granted: boolean; level: PermissionLevel; effective: 'none' | PermissionLevel } => {
    if (isAdminProfile) {
      return { granted: true, level: 'configure', effective: 'configure' }
    }
    const fullKey = `${moduleKey}.${itemKey}`
    const record = granularPermissions[fullKey]
    if (!record) {
      return { granted: true, level: 'edit', effective: 'edit' }
    }
    if (!record.granted) {
      return { granted: false, level: record.level || 'view', effective: 'none' }
    }
    return {
      granted: true,
      level: record.level || 'edit',
      effective: record.level || 'edit',
    }
  }

  const handleSetItemLevel = (
    moduleKey: ModuleKey,
    itemKey: string,
    target: 'none' | PermissionLevel,
  ) => {
    if (disabled || isAdminProfile) return
    const fullKey = `${moduleKey}.${itemKey}`
    const next: ProfilePermissionMap = { ...granularPermissions }

    if (target === 'none') {
      const prevLevel = granularPermissions[fullKey]?.level || 'view'
      next[fullKey] = {
        granted: false,
        level: prevLevel,
      }
    } else {
      next[fullKey] = {
        granted: true,
        level: target,
      }
    }

    onChange(next)
  }

  const handleApplyLevelToModule = (
    module: GranularModuleDefinition,
    target: 'none' | PermissionLevel,
  ) => {
    if (disabled || isAdminProfile) return
    const next: ProfilePermissionMap = { ...granularPermissions }

    module.items.forEach((item) => {
      const fullKey = `${module.key}.${item.key}`
      if (target === 'none') {
        const prevLevel = granularPermissions[fullKey]?.level || 'view'
        next[fullKey] = {
          granted: false,
          level: prevLevel,
        }
      } else {
        next[fullKey] = {
          granted: true,
          level: target,
        }
      }
    })

    onChange(next)
  }

  const handleApplyGlobalLevel = (target: 'none' | PermissionLevel) => {
    if (disabled || isAdminProfile) return
    const next: ProfilePermissionMap = {}

    GRANULAR_SYSTEM_MODULES.forEach((mod) => {
      mod.items.forEach((item) => {
        const fullKey = `${mod.key}.${item.key}`
        if (target === 'none') {
          next[fullKey] = {
            granted: false,
            level: 'view',
          }
        } else {
          next[fullKey] = {
            granted: true,
            level: target,
          }
        }
      })
    })

    onChange(next)
  }

  // Estatísticas gerais
  const stats = useMemo(() => {
    let totalItems = 0
    let configureCount = 0
    let editCount = 0
    let viewCount = 0
    let noneCount = 0

    GRANULAR_SYSTEM_MODULES.forEach((mod) => {
      mod.items.forEach((item) => {
        totalItems++
        const val = getItemCurrentValue(mod.key, item.key)
        if (val.effective === 'configure') configureCount++
        else if (val.effective === 'edit') editCount++
        else if (val.effective === 'view') viewCount++
        else noneCount++
      })
    })

    return { totalItems, configureCount, editCount, viewCount, noneCount }
  }, [granularPermissions, isAdminProfile])

  return (
    <div className="space-y-4">
      {/* Banner de perfil Administrador */}
      {isAdminProfile && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-medium">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold block text-sm">
              Acesso Total Permanente (Configurar)
            </span>
            O perfil Administrador possui acesso irrestrito em nível <strong>Configurar</strong> em
            todos os módulos, telas e relatórios do sistema. As permissões não podem ser reduzidas.
          </div>
        </div>
      )}

      {/* Barra de ações e busca */}
      <div className="flex flex-col gap-3 pb-2 border-b border-border/70">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar módulo, subtela ou relatório..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge
              variant="outline"
              className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
            >
              <Sliders className="h-3 w-3 mr-1 text-emerald-600" />
              {stats.configureCount} Configurar
            </Badge>
            <Badge
              variant="outline"
              className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
            >
              <Pencil className="h-3 w-3 mr-1 text-amber-600" />
              {stats.editCount} Editar
            </Badge>
            <Badge
              variant="outline"
              className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
            >
              <Eye className="h-3 w-3 mr-1 text-blue-600" />
              {stats.viewCount} Visualizar
            </Badge>
            {stats.noneCount > 0 && (
              <Badge
                variant="outline"
                className="text-[11px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
              >
                <Ban className="h-3 w-3 mr-1 text-red-600" />
                {stats.noneCount} Sem acesso
              </Badge>
            )}
          </div>
        </div>

        {/* Ações em massa globais */}
        {!isAdminProfile && !disabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Aplicar em todo o catálogo:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyGlobalLevel('configure')}
                className="h-7 text-[11px] px-2.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              >
                Tudo em Configurar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyGlobalLevel('edit')}
                className="h-7 text-[11px] px-2.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                Tudo em Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyGlobalLevel('view')}
                className="h-7 text-[11px] px-2.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
              >
                Tudo em Visualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyGlobalLevel('none')}
                className="h-7 text-[11px] px-2.5 border-red-500/30 text-red-600 hover:bg-red-500/10"
              >
                Bloquear Tudo
              </Button>
            </div>
          </div>
        )}
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

            // Contadores por nível no módulo
            let modConfigure = 0
            let modEdit = 0
            let modView = 0
            let modNone = 0
            mod.items.forEach((item) => {
              const val = getItemCurrentValue(mod.key, item.key)
              if (val.effective === 'configure') modConfigure++
              else if (val.effective === 'edit') modEdit++
              else if (val.effective === 'view') modView++
              else modNone++
            })

            return (
              <Card
                key={mod.key}
                className="overflow-hidden border border-border/80 bg-card/60 transition-all duration-200"
              >
                {/* Header do Módulo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-secondary/20 hover:bg-secondary/30 transition-colors border-b border-border/60 gap-2.5">
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

                  <div className="flex flex-wrap items-center gap-2 shrink-0 sm:ml-3">
                    <div className="flex items-center gap-1 text-[10px] font-mono">
                      {modConfigure > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                          {modConfigure} Config
                        </span>
                      )}
                      {modEdit > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                          {modEdit} Edição
                        </span>
                      )}
                      {modView > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                          {modView} Ver
                        </span>
                      )}
                      {modNone > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-semibold">
                          {modNone} Sem
                        </span>
                      )}
                    </div>

                    {!isAdminProfile && !disabled && (
                      <div className="flex items-center gap-1 border-l pl-2 border-border/70">
                        <span className="text-[10px] text-muted-foreground mr-1 hidden md:inline">
                          Módulo:
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyLevelToModule(mod, 'configure')}
                          title="Definir todo o módulo como Configurar"
                          className="h-6 text-[10px] px-1.5 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                        >
                          Configurar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyLevelToModule(mod, 'edit')}
                          title="Definir todo o módulo como Editar"
                          className="h-6 text-[10px] px-1.5 text-amber-600 hover:text-amber-500 hover:bg-amber-500/10"
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyLevelToModule(mod, 'view')}
                          title="Definir todo o módulo como Visualizar"
                          className="h-6 text-[10px] px-1.5 text-blue-600 hover:text-blue-500 hover:bg-blue-500/10"
                        >
                          Visualizar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyLevelToModule(mod, 'none')}
                          title="Bloquear todo o módulo"
                          className="h-6 text-[10px] px-1.5 text-red-600 hover:text-red-500 hover:bg-red-500/10"
                        >
                          Bloquear
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Itens granulares dentro do Módulo */}
                {isExpanded && (
                  <CardContent className="p-0 divide-y divide-border/40">
                    {mod.items.map((item: GranularPermissionItem) => {
                      const itemVal = getItemCurrentValue(mod.key, item.key)
                      const currentEffective = itemVal.effective

                      return (
                        <div
                          key={item.key}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-4 sm:pl-8 gap-3 transition-colors ${
                            currentEffective === 'none'
                              ? 'bg-red-500/[0.02] opacity-75'
                              : 'bg-card/40'
                          } hover:bg-secondary/15`}
                        >
                          <div className="space-y-0.5 pr-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-medium ${
                                  currentEffective === 'none'
                                    ? 'text-muted-foreground line-through'
                                    : 'text-foreground'
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

                          {/* Seletor dos 3 Níveis + Sem acesso */}
                          <div className="flex items-center gap-1 shrink-0 self-start sm:self-center">
                            {LEVEL_OPTIONS.map((opt) => {
                              const isSelected = currentEffective === opt.value
                              const Icon = opt.icon

                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={disabled || isAdminProfile}
                                  onClick={() => handleSetItemLevel(mod.key, item.key, opt.value)}
                                  title={`${opt.label}: ${opt.description}`}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                    isSelected
                                      ? `${opt.activeClasses} shadow-xs font-semibold ring-1 ring-primary/20`
                                      : 'border-transparent text-muted-foreground/80 hover:text-foreground hover:bg-secondary/40 hover:border-border/60'
                                  } ${disabled || isAdminProfile ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                  <Icon className="h-3 w-3 shrink-0" />
                                  <span>{opt.shortLabel}</span>
                                </button>
                              )
                            })}
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
