import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tag, Check, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { updateTicket } from '@/services/tickets'
import { recordOperatorCorrection } from '@/services/portal-triage'
import { useToast } from '@/hooks/use-toast'

interface TicketCategoryCardProps {
  ticketId: string
  currentCategoryId?: string
  currentSubcategoryId?: string
  canEdit: boolean
  onUpdated?: () => void
}

export const TicketCategoryCard: React.FC<TicketCategoryCardProps> = ({
  ticketId,
  currentCategoryId,
  currentSubcategoryId,
  canEdit,
  onUpdated,
}) => {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState<string>(currentCategoryId || '')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(currentSubcategoryId || '')

  useEffect(() => {
    setSelectedCategory(currentCategoryId || '')
    setSelectedSubcategory(currentSubcategoryId || '')
  }, [currentCategoryId, currentSubcategoryId])

  useEffect(() => {
    let isCurrent = true
    setLoading(true)
    getCategories(false)
      .then((cats) => {
        if (isCurrent) setCategories(cats)
      })
      .catch((err) => {
        console.error('Erro ao carregar catálogo de atividades:', err)
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  // Atividades principais (sem parent)
  const mainCategories = categories.filter((c) => !c.parent)
  // Subatividades da categoria selecionada
  const subcategories = categories.filter((c) => c.parent && c.parent === selectedCategory)

  const hasChanges =
    (selectedCategory || '') !== (currentCategoryId || '') ||
    (selectedSubcategory || '') !== (currentSubcategoryId || '')

  const currentCategoryObj = categories.find((c) => c.id === currentCategoryId)
  const currentSubcategoryObj = categories.find((c) => c.id === currentSubcategoryId)

  const handleCategoryChange = (value: string) => {
    const newCat = value === '__none__' ? '' : value
    setSelectedCategory(newCat)
    // Se mudou a categoria principal, reseta a subcategoria se ela não pertencer à nova categoria
    const validSubs = categories.filter((c) => c.parent && c.parent === newCat)
    if (!validSubs.some((s) => s.id === selectedSubcategory)) {
      setSelectedSubcategory('')
    }
  }

  const handleSubcategoryChange = (value: string) => {
    const newSub = value === '__none__' ? '' : value
    setSelectedSubcategory(newSub)
  }

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      await updateTicket(ticketId, {
        category: selectedCategory || null,
        subcategory: selectedSubcategory || null,
      })

      // Registrar correção da IA se houve alteração na categoria
      const catObj = categories.find((c) => c.id === selectedCategory)
      const subcatObj = categories.find((c) => c.id === selectedSubcategory)

      if (selectedCategory) {
        void recordOperatorCorrection({
          ticketId,
          finalCategoryId: selectedCategory,
          finalCategoryName: catObj?.name || '',
          finalSubcategoryId: selectedSubcategory || '',
          finalSubcategoryName: subcatObj?.name || '',
        }).catch((err) => {
          console.warn('[TicketCategoryCard] falha ao registrar métrica de correção:', err)
        })
      }

      toast({
        title: 'Classificação atualizada',
        description: 'Categoria e subcategoria salvas com sucesso no chamado.',
      })
      onUpdated?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar classificação',
        description: err?.message || 'Falha ao persistir alterações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="itsm-card p-4 space-y-3.5 border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Tag className="h-4 w-4 text-primary" />
          Categoria e Atividade
        </h3>
        {canEdit && hasChanges && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs px-2.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Salvar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Carregando catálogo...
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {/* Categoria / Atividade Principal */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Categoria Principal (Atividade)
            </Label>
            {canEdit ? (
              <Select
                value={selectedCategory || '__none__'}
                onValueChange={handleCategoryChange}
                disabled={saving}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Selecione a atividade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground italic">
                      Nenhuma atividade selecionada
                    </span>
                  </SelectItem>
                  {mainCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 rounded border bg-muted/30 text-xs font-medium text-foreground">
                {currentCategoryObj ? currentCategoryObj.name : 'Não categorizado'}
              </div>
            )}
          </div>

          {/* Subcategoria / Subatividade */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Subcategoria (Subatividade)
            </Label>
            {canEdit ? (
              <Select
                value={selectedSubcategory || '__none__'}
                onValueChange={handleSubcategoryChange}
                disabled={saving || !selectedCategory || subcategories.length === 0}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue
                    placeholder={
                      !selectedCategory
                        ? 'Selecione primeiro a categoria principal'
                        : subcategories.length === 0
                          ? 'Sem subatividades cadastradas'
                          : 'Selecione a subatividade...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground italic">
                      {subcategories.length === 0
                        ? 'Nenhuma subcategoria disponível'
                        : 'Nenhuma subcategoria'}
                    </span>
                  </SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 rounded border bg-muted/30 text-xs text-foreground">
                {currentSubcategoryObj ? currentSubcategoryObj.name : '—'}
              </div>
            )}
          </div>

          {/* Resumo do SLA da atividade */}
          {currentCategoryObj && (
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>SLA Atividade:</span>
              <div className="flex gap-2">
                <span>
                  Resp:{' '}
                  <strong className="text-foreground">
                    {currentCategoryObj.sla_response_minutes
                      ? `${currentCategoryObj.sla_response_minutes}m`
                      : 'N/A'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Sol:{' '}
                  <strong className="text-foreground">
                    {currentCategoryObj.sla_solution_minutes
                      ? `${currentCategoryObj.sla_solution_minutes}m`
                      : 'N/A'}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
