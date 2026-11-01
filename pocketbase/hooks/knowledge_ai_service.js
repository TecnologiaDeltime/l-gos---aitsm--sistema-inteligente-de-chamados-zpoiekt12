/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook para as rotas de IA da Base de Conhecimento (KB)
 * 1. POST /backend/v1/kb/generate-draft
 *    Gera rascunho de artigo da KB com base na nota de encerramento/solução bem-sucedida de chamado.
 *    Prioriza técnicos seniores (posição/cargo contendo 'Sênior', 'Senior', 'N2', 'N3', 'Especialista', 'Líder', 'Gerente', 'Qualidade').
 *    NUNCA publica automaticamente: salva em knowledge_drafts com status 'Pendente de Revisão'.
 *
 * 2. POST /backend/v1/kb/curate-articles
 *    Monitora e analisa artigos desatualizados (> 90 dias sem atualização),
 *    incompletos (sem resumo, sem conteúdo detalhado < 150 caracteres, sem categoria/tags),
 *    ou potencialmente ineficazes (poucas visualizações ou feedbacks de chamados reincidentes).
 *    Usa o agente nativo para sugerir melhorias concretas e salva/atualiza na coleção knowledge_curations.
 *
 * 3. POST /backend/v1/kb/curations/{id}/apply
 *    Aplica as melhorias sugeridas pelo agente diretamente no artigo da KB e atualiza o status para 'Aplicada'.
 *
 * 4. POST /backend/v1/kb/curations/{id}/reject
 *    Marca a recomendação de cura como 'Recusada' com justificativa da equipe.
 */

routerAdd(
  'POST',
  '/backend/v1/kb/generate-draft',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const ticketId = body.ticket_id

      let ticketRecord = null
      if (ticketId) {
        try {
          ticketRecord = $app.findRecordById('tickets', ticketId)
        } catch (_) {
          return e.badRequestError('Chamado não encontrado.')
        }
      } else {
        // Se não forneceu ID, busca o melhor chamado encerrado/resolvido com solução válida
        // Priorizando técnicos seniores
        const closedTickets = $app.findRecordsByFilter(
          'tickets',
          '(status = "Resolvido" || status = "Encerrado") && solution != ""',
          '-resolution_date,-updated',
          30,
          0,
        )

        if (!closedTickets || closedTickets.length === 0) {
          return e.badRequestError(
            'Nenhum chamado encerrado com solução registrada foi encontrado para gerar artigos.',
          )
        }

        // Critério de Senioridade: buscar cargo do técnico responsável
        let bestCandidate = closedTickets[0]
        let foundSenior = false

        for (let i = 0; i < closedTickets.length; i++) {
          const t = closedTickets[i]
          const assignedId = t.getString('assigned_to')
          if (assignedId) {
            try {
              const userRec = $app.findRecordById('users', assignedId)
              const pos = (userRec.getString('position') || '').toLowerCase()
              const role = (userRec.getString('role') || '').toLowerCase()
              if (
                pos.includes('senior') ||
                pos.includes('sênior') ||
                pos.includes('n2') ||
                pos.includes('n3') ||
                pos.includes('especialista') ||
                pos.includes('líder') ||
                pos.includes('lider') ||
                pos.includes('qualidade') ||
                role === 'admin' ||
                role === 'gestor'
              ) {
                bestCandidate = t
                foundSenior = true
                break
              }
            } catch (_) {}
          }
        }

        ticketRecord = bestCandidate
      }

      const ticketNumber = ticketRecord.getString('number')
      const ticketTitle = ticketRecord.getString('title')
      const ticketDesc = ticketRecord.getString('description')
      const ticketSolution = ticketRecord.getString('solution')
      const ticketRootCause = ticketRecord.getString('root_cause')
      const categoryId = ticketRecord.getString('category')
      const subcategoryId = ticketRecord.getString('subcategory')
      const assignedId = ticketRecord.getString('assigned_to')

      let technicianName = 'Técnico'
      let technicianSeniority = 'Pleno / Padrão'

      if (assignedId) {
        try {
          const techRec = $app.findRecordById('users', assignedId)
          technicianName = techRec.getString('name') || techRec.getString('email') || 'Técnico'
          const pos = techRec.getString('position') || ''
          const role = techRec.getString('role') || ''
          const posLower = pos.toLowerCase()
          if (
            posLower.includes('senior') ||
            posLower.includes('sênior') ||
            posLower.includes('n3') ||
            posLower.includes('especialista')
          ) {
            technicianSeniority = 'Sênior (' + (pos || 'Especialista') + ')'
          } else if (posLower.includes('n2') || posLower.includes('qualidade')) {
            technicianSeniority = 'Nível 2 / Avançado (' + (pos || 'Analista N2') + ')'
          } else if (role === 'admin' || role === 'gestor') {
            technicianSeniority = 'Gestão / Especialista (' + (role || 'Gestor') + ')'
          } else {
            technicianSeniority = pos ? pos : 'Analista'
          }
        } catch (_) {}
      }

      // Montar prompt para o agente nativo kb-curator-agent
      const userPrompt =
        'Com base nas informações do chamado resolvido abaixo, gere um rascunho de artigo para a Base de Conhecimento ITSM.\n' +
        'O rascunho deve ter: título atrativo e claro, resumo objetivo, descrição do problema/sintoma, passos exatos de resolução e lista de tags recomendadas.\n\n' +
        'DADOS DO CHAMADO:\n' +
        '- Número: ' +
        ticketNumber +
        '\n' +
        '- Título original: ' +
        ticketTitle +
        '\n' +
        '- Descrição do chamado: ' +
        ticketDesc +
        '\n' +
        '- Solução registrada pelo técnico: ' +
        ticketSolution +
        '\n' +
        (ticketRootCause ? '- Causa Raiz: ' + ticketRootCause + '\n' : '') +
        '- Técnico Responsável: ' +
        technicianName +
        ' (' +
        technicianSeniority +
        ')\n\n' +
        'INSTRUÇÕES DE FORMATO (Retorne OBRIGATORIAMENTE um JSON válido com esta estrutura exata, sem blocos markdown adicionais):\n' +
        '{\n' +
        '  "title": "Título claro do procedimento ou solução de erro",\n' +
        '  "summary": "Resumo em 1 ou 2 frases do artigo",\n' +
        '  "problem_description": "Descrição detalhada do sintoma/problema que o usuário ou técnico enfrenta",\n' +
        '  "resolution_steps": "1. Primeiro passo...\\n2. Segundo passo...\\n3. Passo final e validação...",\n' +
        '  "content": "Texto completo formatado em Markdown com seções ## Problema e ## Passos de Resolução",\n' +
        '  "tags": "tag1, tag2, tag3, palavra-chave"\n' +
        '}'

      let aiResult = null
      let parsed = null

      try {
        const agentResponse = $ai.agent('kb-curator-agent').chat({
          user_id: userId,
          message: userPrompt,
        })
        aiResult = agentResponse.content
      } catch (agentErr) {
        // Fallback para $ai.chat caso ocorra qualquer instabilidade no agente
        try {
          const directReply = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é um especialista em base de conhecimento ITIL. Responda em JSON puro contendo { title, summary, problem_description, resolution_steps, content, tags }.',
              },
              { role: 'user', content: userPrompt },
            ],
          })
          aiResult = directReply.choices[0].message.content
        } catch (chatErr) {
          return e.json(503, {
            error: 'Serviço de IA temporariamente indisponível: ' + (chatErr.message || ''),
          })
        }
      }

      if (aiResult) {
        try {
          // Extrai JSON mesmo se a IA envolveu em ```json ... ```
          let cleaned = aiResult.trim()
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '')
            const lastIndex = cleaned.lastIndexOf('```')
            if (lastIndex !== -1) {
              cleaned = cleaned.substring(0, lastIndex)
            }
          }
          parsed = JSON.parse(cleaned.trim())
        } catch (_) {
          // Fallback estruturado manual se o parsing JSON direto falhar
          parsed = {
            title: 'Procedimento: ' + ticketTitle,
            summary: ticketSolution.slice(0, 160),
            problem_description: ticketDesc,
            resolution_steps: ticketSolution,
            content:
              '## Problema\n' +
              ticketDesc +
              '\n\n## Passos de Resolução\n' +
              ticketSolution +
              '\n\n*Nota de Encerramento validada pelo técnico ' +
              technicianName +
              '*',
            tags: 'procedimento, ' + ticketTitle.toLowerCase().split(' ').slice(0, 3).join(', '),
          }
        }
      }

      // Tags e tokens
      const tagsList = (parsed.tags || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      // Criar o rascunho em knowledge_drafts (status 'Pendente de Revisão')
      const draftsCol = $app.findCollectionByNameOrId('knowledge_drafts')
      const draftRecord = new Record(draftsCol)

      draftRecord.set('title', parsed.title || 'Artigo: ' + ticketTitle)
      draftRecord.set('problem_description', parsed.problem_description || ticketDesc)
      draftRecord.set('resolution_steps', parsed.resolution_steps || ticketSolution)
      draftRecord.set(
        'content',
        parsed.content || '## Problema\n' + ticketDesc + '\n\n## Solução\n' + ticketSolution,
      )
      draftRecord.set('summary', parsed.summary || ticketSolution.slice(0, 160))
      draftRecord.set('tags', parsed.tags || 'suporte, ti')
      draftRecord.set('tokens', tagsList)
      draftRecord.set('category', categoryId || null)
      draftRecord.set('activity', subcategoryId || null)
      draftRecord.set('source_ticket', ticketRecord.id)
      draftRecord.set('source_ticket_number', ticketNumber)
      draftRecord.set('source_technician_name', technicianName)
      draftRecord.set('source_technician_seniority', technicianSeniority)
      draftRecord.set('status', 'Pendente de Revisão')

      $app.save(draftRecord)

      return e.json(200, {
        success: true,
        draft_id: draftRecord.id,
        draft: {
          id: draftRecord.id,
          title: draftRecord.getString('title'),
          problem_description: draftRecord.getString('problem_description'),
          resolution_steps: draftRecord.getString('resolution_steps'),
          content: draftRecord.getString('content'),
          summary: draftRecord.getString('summary'),
          tags: draftRecord.getString('tags'),
          status: draftRecord.getString('status'),
          source_ticket_number: ticketNumber,
          source_technician_name: technicianName,
          source_technician_seniority: technicianSeniority,
        },
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao gerar rascunho de artigo com IA',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/kb/curate-articles',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      // 1. Carregar artigos existentes
      const articles = $app.findRecordsByFilter('knowledge_articles', '', '-updated', 200, 0)

      if (!articles || articles.length === 0) {
        return e.json(200, {
          success: true,
          flagged_count: 0,
          curations: [],
          message: 'Nenhum artigo encontrado para monitorar.',
        })
      }

      const now = new Date().getTime()
      const STALE_DAYS_MS = 60 * 24 * 60 * 60 * 1000 // 60 dias sem atualização

      const flaggedArticles = []

      // 2. Análise algorítmica de integridade
      for (let i = 0; i < articles.length; i++) {
        const art = articles[i]
        const updatedStr = art.getString('updated') || art.getString('created')
        const updatedTime = updatedStr ? new Date(updatedStr).getTime() : 0
        const ageMs = now - updatedTime
        const isStale = ageMs > STALE_DAYS_MS

        const content = art.getString('content') || ''
        const summary = art.getString('summary') || ''
        const tags = art.getString('tags') || ''
        const category = art.getString('category') || ''

        const isIncomplete =
          content.trim().length < 100 || !summary.trim() || (!tags.trim() && !category)

        const views = art.getInt('views') || 0
        // Se tem muitas visualizações e pouco conteúdo, ou criado há muito tempo com baixa efetividade
        const isIneffective = views === 0 && ageMs > 30 * 24 * 60 * 60 * 1000

        let reason = ''
        const details = []

        if (isStale && isIncomplete) {
          reason = 'Múltiplos Fatores'
          details.push('Não atualizado há mais de 60 dias e com conteúdo/resumo incompleto.')
        } else if (isStale) {
          reason = 'Desatualizado'
          details.push(
            'Sem atualizações recentes há mais de ' + Math.floor(ageMs / 86400000) + ' dias.',
          )
        } else if (isIncomplete) {
          reason = 'Incompleto'
          if (content.trim().length < 100) details.push('Conteúdo muito curto (< 100 caracteres).')
          if (!summary.trim()) details.push('Falta campo de Resumo do procedimento.')
          if (!tags.trim()) details.push('Sem palavras-chave/tags para indexação.')
        } else if (isIneffective) {
          reason = 'Falhando em Resolver'
          details.push('Artigo sem visualizações ou taxa de uso nula após período de publicação.')
        }

        if (reason) {
          flaggedArticles.push({
            article: art,
            reason: reason,
            diagnostic: details.join(' '),
          })
        }
      }

      // Se nenhum caiu nos filtros estritos, seleciona os artigos mais antigos para propor melhoria
      if (flaggedArticles.length === 0 && articles.length > 0) {
        flaggedArticles.push({
          article: articles[articles.length - 1],
          reason: 'Incompleto',
          diagnostic:
            'Artigo com potencial de expansão com procedimentos passo a passo e tags atualizadas.',
        })
      }

      const curationsCol = $app.findCollectionByNameOrId('knowledge_curations')
      const createdCurations = []

      // 3. Para cada artigo sinalizado, solicitar melhorias ao agente de IA
      for (let j = 0; j < flaggedArticles.length; j++) {
        const item = flaggedArticles[j]
        const art = item.article

        // Verificar se já tem curação pendente para não duplicar
        const existing = $app.findRecordsByFilter(
          'knowledge_curations',
          'article = "' + art.id + '" && status = "Pendente"',
          '-created',
          1,
          0,
        )

        if (existing && existing.length > 0) {
          createdCurations.push(existing[0])
          continue
        }

        const prompt =
          'O seguinte artigo da base de conhecimento foi sinalizado pelo monitoramento automático:\n' +
          '- Título: ' +
          art.getString('title') +
          '\n' +
          '- Resumo atual: ' +
          (art.getString('summary') || '(vazio)') +
          '\n' +
          '- Conteúdo atual: ' +
          (art.getString('content') || '(muito curto/vazio)') +
          '\n' +
          '- Motivo da sinalização: ' +
          item.reason +
          '\n' +
          '- Diagnóstico: ' +
          item.diagnostic +
          '\n\n' +
          'Forneça melhorias concretas para a equipe técnica em JSON puro no seguinte formato exato:\n' +
          '{\n' +
          '  "suggested_improvements": "Explicação pontual das falhas e lista de sugestões de melhoria para o técnico",\n' +
          '  "suggested_summary": "Novo resumo claro e padronizado",\n' +
          '  "suggested_content": "Texto aprimorado e completo em Markdown incluindo seções de Sintoma, Resolução e Validação",\n' +
          '  "suggested_tags": "tag1, tag2, tag3, termo-tecnico"\n' +
          '}'

        let aiText = ''
        try {
          const res = $ai.agent('kb-curator-agent').chat({
            user_id: userId,
            message: prompt,
          })
          aiText = res.content
        } catch (_) {
          try {
            const fallbackRes = $ai.chat({
              model: 'fast',
              messages: [
                {
                  role: 'system',
                  content:
                    'Você é um curador ITIL. Retorne JSON estruturado com { suggested_improvements, suggested_summary, suggested_content, suggested_tags }.',
                },
                { role: 'user', content: prompt },
              ],
            })
            aiText = fallbackRes.choices[0].message.content
          } catch (e2) {
            aiText = ''
          }
        }

        let parsedSuggestion = {
          suggested_improvements:
            'Revisar clareza dos passos, adicionar requisitos de sistema e ampliar palavras-chave para busca.',
          suggested_summary:
            art.getString('summary') || 'Guia técnico atualizado com passos recomendados.',
          suggested_content:
            art.getString('content') +
            '\n\n### Validação\nCertifique-se de realizar o teste funcional com o usuário antes do encerramento.',
          suggested_tags: art.getString('tags') || 'procedimento, suporte',
        }

        if (aiText) {
          try {
            let clean = aiText.trim()
            if (clean.startsWith('```')) {
              clean = clean.replace(/^```json/i, '').replace(/^```/, '')
              const idx = clean.lastIndexOf('```')
              if (idx !== -1) clean = clean.substring(0, idx)
            }
            const p = JSON.parse(clean.trim())
            parsedSuggestion = {
              suggested_improvements:
                p.suggested_improvements || parsedSuggestion.suggested_improvements,
              suggested_summary: p.suggested_summary || parsedSuggestion.suggested_summary,
              suggested_content: p.suggested_content || parsedSuggestion.suggested_content,
              suggested_tags: p.suggested_tags || parsedSuggestion.suggested_tags,
            }
          } catch (_) {}
        }

        const curRec = new Record(curationsCol)
        curRec.set('article', art.id)
        curRec.set('article_title', art.getString('title'))
        curRec.set('flag_reason', item.reason)
        curRec.set('diagnostic_details', item.diagnostic)
        curRec.set('suggested_improvements', parsedSuggestion.suggested_improvements)
        curRec.set('suggested_summary', parsedSuggestion.suggested_summary)
        curRec.set('suggested_content', parsedSuggestion.suggested_content)
        curRec.set('suggested_tags', parsedSuggestion.suggested_tags)
        curRec.set('status', 'Pendente')

        $app.save(curRec)
        createdCurations.push(curRec)
      }

      return e.json(200, {
        success: true,
        flagged_count: createdCurations.length,
        curations: createdCurations.map((c) => ({
          id: c.id,
          article_id: c.getString('article'),
          article_title: c.getString('article_title'),
          flag_reason: c.getString('flag_reason'),
          diagnostic_details: c.getString('diagnostic_details'),
          suggested_improvements: c.getString('suggested_improvements'),
          suggested_content: c.getString('suggested_content'),
          suggested_summary: c.getString('suggested_summary'),
          suggested_tags: c.getString('suggested_tags'),
          status: c.getString('status'),
        })),
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao curar artigos da base de conhecimento',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/kb/curations/{id}/apply',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const curationId = e.request.pathValue('id')
      const curRec = $app.findRecordById('knowledge_curations', curationId)
      const articleId = curRec.getString('article')
      const artRec = $app.findRecordById('knowledge_articles', articleId)

      const body = e.requestInfo().body || {}
      const finalContent = body.content || curRec.getString('suggested_content')
      const finalSummary = body.summary || curRec.getString('suggested_summary')
      const finalTags = body.tags || curRec.getString('suggested_tags')

      // Atualiza o artigo da KB
      if (finalContent) artRec.set('content', finalContent)
      if (finalSummary) artRec.set('summary', finalSummary)
      if (finalTags) {
        artRec.set('tags', finalTags)
        const tagsArr = finalTags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
        artRec.set('tokens', tagsArr)
      }
      $app.save(artRec)

      // Atualiza o registro de curação
      curRec.set('status', 'Aplicada')
      curRec.set('action_by', userId)
      curRec.set('action_at', new Date().toISOString())
      curRec.set('action_notes', body.notes || 'Melhoria de IA aceita e aplicada ao artigo.')
      $app.save(curRec)

      return e.json(200, {
        success: true,
        message: 'Melhorias aplicadas com sucesso ao artigo da base de conhecimento.',
        article_id: artRec.id,
        curation_id: curRec.id,
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao aplicar melhorias no artigo.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/kb/curations/{id}/reject',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const curationId = e.request.pathValue('id')
      const curRec = $app.findRecordById('knowledge_curations', curationId)
      const body = e.requestInfo().body || {}

      curRec.set('status', 'Recusada')
      curRec.set('action_by', userId)
      curRec.set('action_at', new Date().toISOString())
      curRec.set('action_notes', body.notes || 'Sugestão recusada pela equipe técnica.')
      $app.save(curRec)

      return e.json(200, {
        success: true,
        message: 'Sugestão de melhoria recusada com sucesso.',
        curation_id: curRec.id,
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao recusar melhoria de cura.',
      })
    }
  },
  $apis.requireAuth(),
)
