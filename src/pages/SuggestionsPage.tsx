// Área de Sugestões — feed colaborativo dos operadores + fila de gestão (admin/dev).
// Regra permanente: permissão suggestions_enviar (todos) e suggestions_gerenciar (gestão).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lightbulb, Loader2, Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime } from '@/lib/date-format'
import {
  SUGGESTION_CATEGORY_LABELS,
  SUGGESTION_STATUS_LABELS,
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
  createSuggestion,
  listSuggestions,
} from '@/services/suggestions'
import { SuggestionCardView } from '@/components/suggestions/SuggestionCard'
import { SuggestionManageDialog } from '@/components/suggestions/SuggestionManageDialog'

const CATEGORIES = Object.keys(
  SUGGESTION_CATEGORY_LABELS,
) as (keyof typeof SUGGESTION_CATEGORY_LABELS)[]

type StatusFilter = 'todas' | SuggestionStatus

export default function SuggestionsPage() {
  const { toast } = useToast()
  const { user, canAccessItem } = usePermissions()
  const canManage = canAccessItem('suggestions', 'suggestions_gerenciar')

  const [tab, setTab] = useState<'feed' | 'gestao'>('feed')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas')

  // Nova sugestão
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SuggestionCategory>('sistema')
  const [submitting, setSubmitting] = useState(false)

  // Gestão
  const [manageTarget, setManageTarget] = useState<Suggestion | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        setSuggestions(await listSuggestions())
      } catch (e) {
        toast({
          title: 'Erro ao carregar sugestões',
          description: e instanceof Error ? e.message : 'Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Preencha título e descrição',
        description: 'Os dois campos são obrigatórios.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      await createSuggestion(
        { title: title.trim(), description: description.trim(), category },
        user?.id || '',
      )
      toast({ title: 'Sugestão enviada!', description: 'A gestão foi notificada e irá avaliá-la.' })
      setDialogOpen(false)
      setTitle('')
      setDescription('')
      setCategory('sistema')
      load(true)
    } catch (e) {
      toast({
        title: 'Erro ao enviar sugestão',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'todas') return suggestions
    return suggestions.filter((s) => s.status === statusFilter)
  }, [suggestions, statusFilter])

  const pendingCount = useMemo(
    () => suggestions.filter((s) => s.status === 'pendente').length,
    [suggestions],
  )

  const currentUserId = user?.id
  const authorNameOf = (s: Suggestion) => s.expand?.author?.name || 'Operador'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sugestões</h1>
            <p className="text-xs text-muted-foreground">
              Compartilhe ideias com a equipe e acompanhe a avaliação da gestão
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova sugestão
          </Button>
        </div>
      </div>

      {canManage && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'feed' | 'gestao')}>
          <TabsList>
            <TabsTrigger value="feed">Feed da equipe</TabsTrigger>
            <TabsTrigger value="gestao">
              Fila de gestão
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['todas', 'pendente', 'aceita', 'negada', 'implantada'] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
            className="h-7 px-2.5 text-xs"
          >
            {s === 'todas' ? 'Todas' : SUGGESTION_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nenhuma sugestão encontrada</p>
            <p className="text-xs text-muted-foreground">
              {statusFilter === 'todas'
                ? 'Seja o primeiro a enviar uma ideia para melhorar o sistema.'
                : 'Nenhuma sugestão neste filtro.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SuggestionCardView
              key={s.id}
              suggestion={s}
              currentUserId={currentUserId}
              manageMode={tab === 'gestao' && canManage}
              onManage={setManageTarget}
            />
          ))}
        </div>
      )}

      {/* Diálogo: nova sugestão */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova sugestão</DialogTitle>
            <DialogDescription>
              Sua ideia será visível para a equipe e avaliada pela gestão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Resumo da sua ideia"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SuggestionCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SUGGESTION_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea
                placeholder="Detalhe sua sugestão: problema que resolve, como funcionaria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={4000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar sugestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: gestão */}
      <SuggestionManageDialog
        suggestion={manageTarget}
        open={!!manageTarget}
        onOpenChange={(o) => !o && setManageTarget(null)}
        onSaved={() => load(true)}
      />
    </div>
  )
}
