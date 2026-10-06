import pb from '@/lib/pocketbase/client'

export interface KnowledgeArticle {
  id: string
  title: string
  summary?: string
  content: string
  content_html?: string
  category?: string
  activity?: string
  tokens?: string[]
  attachment?: string
  attachment_name?: string
  tags?: string
  author?: string
  views?: number
  created: string
  updated: string
  expand?: {
    category?: { id: string; name: string }
    activity?: { id: string; name: string }
    author?: { id: string; name: string; avatar?: string; email?: string }
  }
}

export const getKnowledgeArticles = (filter?: string) =>
  pb.collection('knowledge_articles').getFullList<KnowledgeArticle>({
    filter,
    sort: '-created',
    expand: 'category,activity,author',
  })

export const getKnowledgeArticleById = (id: string) =>
  pb.collection('knowledge_articles').getOne<KnowledgeArticle>(id, {
    expand: 'category,activity,author',
  })

export const createKnowledgeArticle = (data: FormData | Partial<KnowledgeArticle>) =>
  pb.collection('knowledge_articles').create<KnowledgeArticle>(data, {
    expand: 'category,activity,author',
  })

export const updateKnowledgeArticle = (id: string, data: FormData | Partial<KnowledgeArticle>) =>
  pb.collection('knowledge_articles').update<KnowledgeArticle>(id, data, {
    expand: 'category,activity,author',
  })

export const deleteKnowledgeArticle = (id: string) => pb.collection('knowledge_articles').delete(id)

export const incrementArticleViews = async (id: string, currentViews: number = 0) => {
  try {
    return await pb.collection('knowledge_articles').update<KnowledgeArticle>(id, {
      views: (currentViews || 0) + 1,
    })
  } catch {
    // Falha silenciosa para não travar a visualização
    return null
  }
}

export const getArticleAttachmentUrl = (article: KnowledgeArticle) => {
  if (!article.attachment) return ''
  return pb.files.getURL(article, article.attachment)
}

/**
 * Upload de imagem/logotipo para ser embutida no corpo do artigo ou em ticket_attachments
 */
export const uploadArticleInlineImage = async (file: File): Promise<string> => {
  // Converte a imagem para Data URL (Base64) se for razoável (<2MB)
  // ou faz upload como anexo compartilhado se houver coleção.
  // Data URL Base64 para imagens/logotipos comuns (PNG/JPEG/SVG/WebP) garante
  // que o HTML seja 100% autossuficiente e funcione tanto em dev, prod e impressão.
  if (file.size <= 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(file)
    })
  }

  // Para imagens maiores, também podemos usar FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (e) => reject(e)
    reader.readAsDataURL(file)
  })
}
