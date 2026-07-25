import pb from '@/lib/pocketbase/client'

export interface KnowledgeArticle {
  id: string
  title: string
  summary?: string
  content: string
  category?: string
  tags?: string
  views?: number
  created: string
  updated: string
  expand?: any
}

export const getKnowledgeArticles = (filter?: string) =>
  pb.collection('knowledge_articles').getFullList<KnowledgeArticle>({
    filter,
    sort: '-created',
    expand: 'category,author',
  })

export const createKnowledgeArticle = (data: Partial<KnowledgeArticle>) =>
  pb.collection('knowledge_articles').create<KnowledgeArticle>(data)
