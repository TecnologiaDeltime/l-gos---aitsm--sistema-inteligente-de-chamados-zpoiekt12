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

export interface KnowledgeDraft {
  id: string
  title: string
  problem_description?: string
  resolution_steps?: string
  content: string
  content_html?: string
  summary?: string
  tags?: string
  tokens?: string[]
  category?: string
  activity?: string
  source_ticket?: string
  source_ticket_number?: string
  source_technician_name?: string
  source_technician_seniority?: string
  status: 'Pendente de Revisão' | 'Aprovado' | 'Publicado' | 'Descartado'
  published_article?: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created: string
  updated: string
  expand?: {
    category?: { id: string; name: string }
    activity?: { id: string; name: string }
    source_ticket?: { id: string; number: string; title: string; solution?: string }
    published_article?: KnowledgeArticle
    reviewed_by?: { id: string; name: string; email?: string }
  }
}

export interface KnowledgeCuration {
  id: string
  article: string
  article_title: string
  flag_reason: 'Desatualizado' | 'Incompleto' | 'Falhando em Resolver' | 'Múltiplos Fatores'
  diagnostic_details?: string
  suggested_improvements: string
  suggested_content?: string
  suggested_summary?: string
  suggested_tags?: string
  status: 'Pendente' | 'Aplicada' | 'Recusada'
  action_by?: string
  action_at?: string
  action_notes?: string
  created: string
  updated: string
  expand?: {
    article?: KnowledgeArticle
    action_by?: { id: string; name: string; email?: string }
  }
}

/**
 * Busca rascunhos de artigos gerados por IA
 */
export const getKnowledgeDrafts = (filter?: string) =>
  pb.collection('knowledge_drafts').getFullList<KnowledgeDraft>({
    filter,
    sort: '-created',
    expand: 'category,activity,source_ticket,published_article,reviewed_by',
  })

export const getKnowledgeDraftById = (id: string) =>
  pb.collection('knowledge_drafts').getOne<KnowledgeDraft>(id, {
    expand: 'category,activity,source_ticket,published_article,reviewed_by',
  })

export const updateKnowledgeDraft = (id: string, data: Partial<KnowledgeDraft>) =>
  pb.collection('knowledge_drafts').update<KnowledgeDraft>(id, data)

export const deleteKnowledgeDraft = (id: string) => pb.collection('knowledge_drafts').delete(id)

/**
 * Chamada de IA para geração automática de rascunho de artigo a partir de chamado encerrado
 */
export const generateDraftWithAi = async (
  ticketId?: string,
): Promise<{ success: boolean; draft: KnowledgeDraft }> => {
  return pb.send('/backend/v1/kb/generate-draft', {
    method: 'POST',
    body: { ticket_id: ticketId || undefined },
  })
}

/**
 * Publica um rascunho aprovado diretamente como artigo oficial na base de conhecimento
 */
export const publishDraftToKnowledgeBase = async (
  draft: KnowledgeDraft,
  authorId?: string,
): Promise<KnowledgeArticle> => {
  // Cria o artigo final
  const newArticle = await createKnowledgeArticle({
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    content_html: draft.content_html,
    category: draft.category || undefined,
    activity: draft.activity || undefined,
    tags: draft.tags,
    tokens: draft.tokens,
    author: authorId || undefined,
    views: 0,
  })

  // Atualiza o rascunho como Publicado e vincula o artigo
  await updateKnowledgeDraft(draft.id, {
    status: 'Publicado',
    published_article: newArticle.id,
    reviewed_by: authorId || undefined,
    reviewed_at: new Date().toISOString(),
  })

  return newArticle
}

/**
 * Busca registros de cura de artigos
 */
export const getKnowledgeCurations = (filter?: string) =>
  pb.collection('knowledge_curations').getFullList<KnowledgeCuration>({
    filter,
    sort: '-created',
    expand: 'article,action_by',
  })

/**
 * Dispara o monitoramento e diagnóstico de curação de artigos com o agente de IA
 */
export const runKnowledgeCurationAnalysis = async (): Promise<{
  success: boolean
  flagged_count: number
  curations: KnowledgeCuration[]
  message?: string
}> => {
  return pb.send('/backend/v1/kb/curate-articles', {
    method: 'POST',
    body: {},
  })
}

/**
 * Aplica melhorias sugeridas pela IA no artigo correspondente
 */
export const applyCurationSuggestion = async (
  curationId: string,
  data?: { content?: string; summary?: string; tags?: string; notes?: string },
): Promise<{ success: boolean; message: string }> => {
  return pb.send(`/backend/v1/kb/curations/${curationId}/apply`, {
    method: 'POST',
    body: data || {},
  })
}

/**
 * Recusa a recomendação de melhoria sugerida pela IA
 */
export const rejectCurationSuggestion = async (
  curationId: string,
  notes?: string,
): Promise<{ success: boolean; message: string }> => {
  return pb.send(`/backend/v1/kb/curations/${curationId}/reject`, {
    method: 'POST',
    body: { notes: notes || '' },
  })
}
