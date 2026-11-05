import React from 'react'

/**
 * Renderizador leve de Markdown para as respostas do Assistente Técnico.
 * Suporta: negrito (**x**), itálico (*x*), código inline (`x`), títulos (# .. ###),
 * listas com marcadores (- ou *) e numeradas (1.), blocos de código (```) e parágrafos.
 * Renderização segura: todo texto passa por escape antes de virar JSX (sem dangerouslySetInnerHTML).
 */

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Converte ênfases markdown em JSX seguro (após escape). */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const escaped = escapeText(text)
  // Divide por **negrito**, *itálico* e `código` preservando os delimitadores
  const parts = escaped.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g)
  return parts
    .filter((p) => p !== '')
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={key}
            className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 font-mono text-[0.85em]"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={key} className="italic">
            {part.slice(1, -1)}
          </em>
        )
      }
      return <React.Fragment key={key}>{part}</React.Fragment>
    })
}

interface MarkdownLiteProps {
  text: string
  className?: string
}

export function MarkdownLite({ text, className = '' }: MarkdownLiteProps) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')

  const blocks: React.ReactNode[] = []
  let paragraph: string[] = []
  let listItems: { ordered: boolean; text: string }[] = []
  let codeBlock: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const joined = paragraph.join(' ').trim()
    if (joined) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-relaxed">
          {renderInline(joined, `p-${blocks.length}`)}
        </p>,
      )
    }
    paragraph = []
  }

  const flushList = () => {
    if (listItems.length === 0) return
    const ordered = listItems[0].ordered
    const items = listItems.map((it, idx) => (
      <li key={`li-${idx}`} className="leading-relaxed ml-1">
        {renderInline(it.text, `li-${blocks.length}-${idx}`)}
      </li>
    ))
    blocks.push(
      ordered ? (
        <ol key={`ol-${blocks.length}`} className="list-decimal list-inside space-y-1 my-1">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="list-disc list-inside space-y-1 my-1">
          {items}
        </ul>
      ),
    )
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Bloco de código cercado por ```
    if (line.trim().startsWith('```')) {
      if (codeBlock) {
        blocks.push(
          <pre
            key={`pre-${blocks.length}`}
            className="my-1 p-2 rounded bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto font-mono text-xs whitespace-pre-wrap"
          >
            {codeBlock.join('\n')}
          </pre>,
        )
        codeBlock = null
      } else {
        flushParagraph()
        flushList()
        codeBlock = []
      }
      continue
    }
    if (codeBlock) {
      codeBlock.push(rawLine)
      continue
    }

    // Linha vazia: fecha parágrafo/lista correntes
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }

    // Títulos markdown
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      const cls =
        level === 1
          ? 'text-base font-bold mt-2 mb-1'
          : level === 2
            ? 'text-sm font-bold mt-2 mb-1'
            : 'text-sm font-semibold mt-1.5 mb-0.5'
      blocks.push(
        <p key={`h-${blocks.length}`} className={cls}>
          {renderInline(heading[2], `h-${blocks.length}`)}
        </p>,
      )
      continue
    }

    // Listas
    const unordered = line.match(/^\s*[-*•]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (unordered) {
      flushParagraph()
      listItems.push({ ordered: false, text: unordered[1] })
      continue
    }
    if (ordered) {
      flushParagraph()
      listItems.push({ ordered: true, text: ordered[1] })
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }
  flushParagraph()
  flushList()
  if (codeBlock) {
    blocks.push(
      <pre
        key={`pre-${blocks.length}`}
        className="my-1 p-2 rounded bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto font-mono text-xs whitespace-pre-wrap"
      >
        {codeBlock.join('\n')}
      </pre>,
    )
  }

  return <div className={`space-y-1.5 ${className}`}>{blocks}</div>
}
