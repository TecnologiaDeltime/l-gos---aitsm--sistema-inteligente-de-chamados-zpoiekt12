import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileUp, FileText, Trash2, Layers, Tag } from 'lucide-react'
import { RichTextEditor } from '@/components/knowledge/RichTextEditor'
import { TokenInput } from '@/components/knowledge/TokenInput'
import {
  createKnowledgeArticle,
  updateKnowledgeArticle,
  KnowledgeArticle,
  getArticleAttachmentUrl,
} from '@/services/knowledge'
import { getCategories, CategoryRecord } from '@/services/categories'
import { useToast } from '@/hooks/use-toast'

interface ArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleToEdit?: KnowledgeArticle | null
  onSuccess: () => void
}

export function ArticleDialog({
  open,
  onOpenChange,
  articleToEdit,
  onSuccess,
}: ArticleDialogProps) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Campos do formulário
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [activityId, setActivityId] = useState<string>('none')
  const [tokens, setTokens] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (articleToEdit) {
      setTitle(articleToEdit.title || '')
      setSummary(articleToEdit.summary || '')
      setContentHtml(articleToEdit.content_html || articleToEdit.content || '')
      setCategoryId(articleToEdit.category || 'none')
      setActivityId(articleToEdit.activity || 'none')
      setTokens(
        Array.isArray(articleToEdit.tokens)
          ? articleToEdit.tokens
          : articleToEdit.tags
            ? articleToEdit.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
      )
      setFile(null)
      setRemoveExistingAttachment(false)
    } else {
      setTitle('')
      setSummary('')
      setContentHtml('')
      setCategoryId('none')
      setActivityId('none')
      setTokens([])
      setFile(null)
      setRemoveExistingAttachment(false)
    }
  }, [articleToEdit, open])

  // Filtra atividades (categorias filhas no catálogo)
  const mainCategories = categories.filter((c) => !c.parent)
  const subActivities = categories.filter((c) => !!c.parent)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    // Validar tipo: PDF, DOC, DOCX
    const validExtensions = ['.pdf', '.doc', '.docx']
    const hasValidExt = validExtensions.some((ext) => selected.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um documento PDF, DOC ou DOCX.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    // Validar tamanho máximo: 10MB
    const maxSize = 10 * 1024 * 1024
    if (selected.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo selecionado excede o limite máximo de 10MB.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    setFile(selected)
    setRemoveExistingAttachment(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Por favor, informe o título do artigo.',
        variant: 'destructive',
      })
      return
    }

    // Extrair texto simples para o campo legível 'content' obrigatório no banco
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = contentHtml || ''
    const plainText = tempDiv.textContent || tempDiv.innerText || title

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('summary', summary.trim())
      formData.append('content', plainText.trim())
      formData.append('content_html', contentHtml)
      formData.append('category', categoryId !== 'none' ? categoryId : '')
      formData.append('activity', activityId !== 'none' ? activityId : '')
      formData.append('tokens', JSON.stringify(tokens))
      // Manter retrocompatibilidade com tags simples
      formData.append('tags', tokens.join(', '))

      if (file) {
        formData.append('attachment', file)
        formData.append('attachment_name', file.name)
      } else if (removeExistingAttachment) {
        formData.append('attachment', '')
        formData.append('attachment_name', '')
      }

      if (articleToEdit) {
        await updateKnowledgeArticle(articleToEdit.id, formData)
        toast({
          title: 'Artigo atualizado',
          description: 'As alterações foram salvas com sucesso.',
        })
      } else {
        await createKnowledgeArticle(formData)
        toast({
          title: 'Artigo publicado',
          description: 'O novo artigo já está disponível na base de conhecimento.',
        })
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar artigo',
        description: err?.message || 'Ocorreu uma falha ao comunicar com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {articleToEdit ? 'Editar Artigo da Base' : 'Criar Novo Artigo'}
          </DialogTitle>
          <DialogDescription>
            Escreva o procedimento técnico, formate textos, insira imagens/logotipos, anexe
            documentos e defina tokens para associação com atividades do catálogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Título & Resumo */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="art-title" className="text-sm font-semibold">
                Título do Artigo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="art-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Procedimento para configuração de VPN corporativa"
                className="h-10 text-sm font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-summary" className="text-sm font-medium text-muted-foreground">
                Resumo rápido (exibido nos cards e buscas)
              </Label>
              <Textarea
                id="art-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Breve descrição do objetivo deste artigo..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          {/* Categorização e Associação com Catálogo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                Categoria Geral (Macro)
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {mainCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Atividade do Catálogo / Específica
              </Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Associar a uma atividade do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma atividade vinculada</SelectItem>
                  {subActivities.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      {act.name} {act.expand?.parent ? `(${act.expand.parent.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Vincula este artigo a uma atividade do catálogo de serviços do ITSM.
              </p>
            </div>
          </div>

          {/* Seção de Tokens / Palavras-chave */}
          <div className="p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950 dark:text-indigo-200">
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>Tokens de Associação (Palavras-Chave de Triagem e Busca)</span>
            </div>
            <p className="text-[11px] text-indigo-900/70 dark:text-indigo-300/70">
              Adicione palavras-chave como tags (ex: <strong>impressora</strong>,{' '}
              <strong>vpn</strong>, <strong>e-mail</strong>, <strong>lentidão</strong>). Chamados e
              atividades correspondentes a esses tokens indicarão este artigo automaticamente.
            </p>
            <TokenInput
              tokens={tokens}
              onChange={setTokens}
              placeholder="Digite o token e aperte Enter (ex: vpn, impressora, outlook)..."
            />
          </div>

          {/* Editor de Texto Rico WYSIWYG */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Conteúdo do Procedimento <span className="text-red-500">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Use a barra de ferramentas para títulos (H1, H2, H3), logotipos e listas.
              </span>
            </div>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              placeholder="Descreva o procedimento passo a passo. Insira títulos, formatação e imagens/logotipos conforme necessário..."
              minHeight="340px"
            />
          </div>

          {/* Anexo de Documento (PDF / DOCX) */}
          <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <FileUp className="h-4 w-4 text-primary" />
                  Anexar Documento (.PDF, .DOC, .DOCX — até 10MB)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Faça o upload de manuais completos, guias em PDF ou documentos de procedimentos
                  operacionais.
                </p>
              </div>
            </div>

            {/* Documento atual se existir */}
            {articleToEdit?.attachment && !removeExistingAttachment && !file && (
              <div className="flex items-center justify-between p-2.5 rounded-md bg-background border border-border text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-medium truncate">
                    {articleToEdit.attachment_name || articleToEdit.attachment}
                  </span>
                  <a
                    href={getArticleAttachmentUrl(articleToEdit)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:underline shrink-0"
                  >
                    (Visualizar atual)
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoveExistingAttachment(true)}
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover anexo
                </Button>
              </div>
            )}

            {/* Novo arquivo selecionado */}
            {file && (
              <div className="flex items-center justify-between p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
                <div className="flex items-center gap-2 truncate text-blue-950 dark:text-blue-200">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-medium truncate">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="h-7 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Cancelar
                </Button>
              </div>
            )}

            {!file && (!articleToEdit?.attachment || removeExistingAttachment) && (
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  id="art-doc-file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="text-xs cursor-pointer file:cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:text-xs file:font-medium"
                />
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="p-4 border-t bg-muted/30 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
          >
            {loading ? 'Salvando...' : articleToEdit ? 'Atualizar Artigo' : 'Publicar Artigo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
