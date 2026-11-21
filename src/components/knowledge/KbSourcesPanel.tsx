import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  GraduationCap,
  Trash2,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Ticket,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  getKbSources,
  uploadKbSourcePdf,
  processKbSources,
  deleteKbSource,
  KbSource,
} from '@/services/kb-learning'

interface KbSourcesPanelProps {
  canEdit: boolean
  onChanged?: () => void
}

const statusBadge = (status: KbSource['status']) => {
  if (status === 'Pronto')
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Pronto
      </Badge>
    )
  if (status === 'Processando')
    return (
      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 gap-1 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" /> Processando
      </Badge>
    )
  return (
    <Badge className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 gap-1 text-[10px]">
      <XCircle className="h-3 w-3" /> Erro
    </Badge>
  )
}

export function KbSourcesPanel({ canEdit, onChanged }: KbSourcesPanelProps) {
  const { toast } = useToast()
  const [sources, setSources] = useState<KbSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await getKbSources()
      setSources(data)
    } catch {
      toast({
        title: 'Erro ao carregar fontes',
        description: 'Não foi possível carregar as fontes de aprendizado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Envie apenas arquivos em PDF.',
        variant: 'destructive',
      })
      return
    }
    try {
      setUploading(true)
      const res = await uploadKbSourcePdf(file, file.name.replace(/\.pdf$/i, ''))
      if (res.success) {
        toast({
          title: 'Fonte processada',
          description: `"${res.name}" foi processada e está disponível para a IA (${res.pages || 0} páginas).`,
        })
      } else {
        toast({
          title: 'Processamento com falha',
          description: res.error || 'A fonte foi registrada, mas houve erro na extração/IA.',
          variant: 'destructive',
        })
      }
      loadData()
      onChanged?.()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Falha no envio do PDF.'
      toast({ title: 'Erro no upload', description: message, variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReprocess = async () => {
    try {
      const res = await processKbSources()
      toast({
        title: 'Reprocessamento concluído',
        description: `${res.processed} fonte(s) reprocessada(s).`,
      })
      loadData()
      onChanged?.()
    } catch {
      toast({
        title: 'Erro ao reprocessar',
        description: 'Não foi possível reprocessar as fontes pendentes.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (src: KbSource) => {
    if (!confirm(`Excluir a fonte "${src.name}"? A IA deixará de usá-la nas sugestões.`)) return
    try {
      setDeletingId(src.id)
      await deleteKbSource(src.id)
      toast({ title: 'Fonte excluída', description: `"${src.name}" foi removida.` })
      loadData()
      onChanged?.()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a fonte.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = sources.filter((s) => {
    const q = search.toLowerCase().trim()
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.summary || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      (s.ticket_number || '').toLowerCase().includes(q)
    const matchesType = typeFilter === 'all' || s.source_type === typeFilter
    return matchesSearch && matchesType
  })

  const readyCount = sources.filter((s) => s.status === 'Pronto').length

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-amber-500" />
            <span>
              <strong>{readyCount}</strong> de {sources.length} fonte(s) prontas para uso pela IA
              (PDFs e soluções aprendidas em fechamentos).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={!canEdit}
              className="text-xs h-8"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reprocessar pendentes
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canEdit || uploading}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {uploading ? 'Processando PDF...' : 'Enviar PDF'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Pesquisar por nome, categoria, resumo ou número do chamado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs h-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1"
          >
            <option value="all">Todos os tipos</option>
            <option value="pdf">PDF (documento)</option>
            <option value="closure">Fechamento de chamado</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border bg-card p-4 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-950/40">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhuma fonte encontrada</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Envie um PDF (manual, procedimento) ou feche chamados com soluções detalhadas — o
            sistema aprende automaticamente com elas para sugerir soluções mais cirúrgicas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((src) => (
            <div
              key={src.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {src.source_type === 'pdf' ? (
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                  ) : (
                    <Ticket className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{src.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {statusBadge(src.status)}
                      <Badge variant="outline" className="text-[10px] py-0">
                        {src.source_type === 'pdf' ? 'PDF' : 'Fechamento'}
                      </Badge>
                      {src.category && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {src.category}
                        </Badge>
                      )}
                      {src.ticket_number && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 text-slate-500 dark:text-slate-400"
                        >
                          #{src.ticket_number}
                        </Badge>
                      )}
                      {src.pages ? (
                        <span className="text-[10px] text-muted-foreground">{src.pages} pág.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 shrink-0"
                    title="Excluir fonte"
                    disabled={deletingId === src.id}
                    onClick={() => handleDelete(src)}
                  >
                    {deletingId === src.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
              {src.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {src.summary}
                </p>
              )}
              {src.error && (
                <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed line-clamp-2">
                  {src.error}
                </p>
              )}
              <div className="text-[10px] text-muted-foreground border-t pt-1.5">
                {src.processed_at
                  ? `Processado em ${new Date(src.processed_at).toLocaleString('pt-BR')}`
                  : `Recebido em ${new Date(src.created).toLocaleString('pt-BR')}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
