import { useEffect, useState } from 'react'
import { BookOpen, Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getKnowledgeArticles, KnowledgeArticle } from '@/services/knowledge'

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    getKnowledgeArticles()
      .then(setArticles)
      .catch(() => {})
  }, [])

  const filtered = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Pesquisar procedimentos na base de conhecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" /> Criar Artigo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((art) => (
          <div
            key={art.id}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-blue-600">
              <BookOpen className="h-5 w-5" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{art.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {art.summary || art.content.slice(0, 150)}
            </p>
            <div className="flex justify-between items-center text-[10px] text-slate-400 border-t pt-2">
              <span>Tags: {art.tags || 'geral'}</span>
              <span>{art.views || 0} visualizações</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
