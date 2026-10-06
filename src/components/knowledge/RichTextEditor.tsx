import { useRef, useEffect, useState } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadArticleInlineImage } from '@/services/knowledge'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva o procedimento detalhado aqui...',
  minHeight = '320px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUpdatingRef = useRef(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Sincroniza o valor inicial ou externo com o contentEditable
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || ''
      }
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true
      const html = editorRef.current.innerHTML
      onChange(html)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }

  const exec = (command: string, val: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand(command, false, val)
      handleInput()
    }
  }

  const handleHeading = (tag: 'H1' | 'H2' | 'H3' | 'P') => {
    exec('formatBlock', `<${tag}>`)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.')
      return
    }

    try {
      setIsUploadingImage(true)
      const dataUrl = await uploadArticleInlineImage(file)
      exec('insertImage', dataUrl)
    } catch {
      alert('Erro ao carregar a imagem.')
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleInsertLink = () => {
    const url = prompt('Digite ou cole a URL do link:')
    if (url) {
      exec('createLink', url)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
      {/* Barra de Ferramentas WYSIWYG */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1.5 text-xs">
        {/* Desfazer / Refazer */}
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Desfazer (Ctrl+Z)"
            onClick={() => exec('undo')}
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Refazer (Ctrl+Y)"
            onClick={() => exec('redo')}
          >
            <Redo2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
          </Button>
        </div>

        {/* Cabeçalhos H1, H2, H3, P */}
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs font-bold gap-0.5"
            title="Título Principal (H1)"
            onClick={() => handleHeading('H1')}
          >
            <Heading1 className="h-3.5 w-3.5" />
            <span className="text-[11px]">H1</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs font-semibold gap-0.5"
            title="Subtítulo (H2)"
            onClick={() => handleHeading('H2')}
          >
            <Heading2 className="h-3.5 w-3.5" />
            <span className="text-[11px]">H2</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs font-medium gap-0.5"
            title="Seção (H3)"
            onClick={() => handleHeading('H3')}
          >
            <Heading3 className="h-3.5 w-3.5" />
            <span className="text-[11px]">H3</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs gap-0.5"
            title="Parágrafo normal"
            onClick={() => handleHeading('P')}
          >
            <Pilcrow className="h-3.5 w-3.5" />
            <span className="text-[11px]">P</span>
          </Button>
        </div>

        {/* Formatação Básica */}
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Negrito (Ctrl+B)"
            onClick={() => exec('bold')}
          >
            <Bold className="h-3.5 w-3.5 font-bold" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Itálico (Ctrl+I)"
            onClick={() => exec('italic')}
          >
            <Italic className="h-3.5 w-3.5 italic" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Sublinhado (Ctrl+U)"
            onClick={() => exec('underline')}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Listas e Citação */}
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Lista com marcadores"
            onClick={() => exec('insertUnorderedList')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Lista numerada"
            onClick={() => exec('insertOrderedList')}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Citação / Bloco em destaque"
            onClick={() => exec('formatBlock', '<blockquote>')}
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Bloco de código pré-formatado"
            onClick={() => exec('formatBlock', '<pre>')}
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Alinhamento */}
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Alinhar à esquerda"
            onClick={() => exec('justifyLeft')}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Centralizar"
            onClick={() => exec('justifyCenter')}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Alinhar à direita"
            onClick={() => exec('justifyRight')}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Mídia / Links / Logotipos */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            title="Inserir Imagem / Logotipo"
            disabled={isUploadingImage}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">
              {isUploadingImage ? 'Enviando...' : 'Logotipo / Imagem'}
            </span>
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Inserir Link"
            onClick={handleInsertLink}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Badge auxiliar com dica */}
        <div className="ml-auto hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>Editor Rico WYSIWYG</span>
        </div>
      </div>

      {/* Área Editável */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="kb-rich-editor p-4 outline-none overflow-y-auto text-sm leading-relaxed text-foreground bg-card"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  )
}
