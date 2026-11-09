/// <reference path="../pb_data/types.d.ts" />

/**
 * portal_ticket_triage.js — Triagem automática por IA do Portal do Cliente (v2).
 * Todas as funções auxiliares são declaradas INLINE dentro do callback routerAdd para compatibilidade com o pool JSVM do PocketBase.
 */

routerAdd(
  'POST',
  '/backend/v1/ai/portal-triage',
  (e) => {
    // --- Helpers inline ---
    const recordHistory = function (app, data) {
      try {
        const col = app.findCollectionByNameOrId('portal_triage_history')
        if (!col) return
        const rec = new Record(col)
        rec.set('ticket_id', data.ticketId || '')
        rec.set('ticket_number', data.ticketNumber || '')
        rec.set('title', (data.title || '').slice(0, 300))
        rec.set('suggested_category_id', data.suggestedCategoryId || '')
        rec.set('suggested_category_name', data.suggestedCategoryName || '')
        rec.set('suggested_subcategory_id', data.suggestedSubcategoryId || '')
        rec.set('suggested_subcategory_name', data.suggestedSubcategoryName || '')
        rec.set('queue_id', data.queueId || '')
        rec.set('queue_name', data.queueName || '')
        rec.set('confidence', data.confidence || 0)
        rec.set('reason', (data.reason || '').slice(0, 1000))
        rec.set('applied', Boolean(data.applied))
        rec.set('source', data.source || 'portal')
        rec.set('match_method', data.matchMethod || 'ai')
        app.save(rec)
      } catch (err) {
        console.warn('[PORTAL_TRIAGE] Falha ao registrar portal_triage_history:', err)
      }
    }

    const getQueueName = function (app, queueId) {
      if (!queueId) return ''
      try {
        const q = app.findRecordById('queues', queueId)
        return q ? q.getString('name') || '' : ''
      } catch (_) {
        return ''
      }
    }

    const heuristicMatch = function (text, categories) {
      if (!text) return null
      const clean = text.toLowerCase()
      const keywordsMap = [
        { words: ['vpn', 'acesso remoto', 'anydesk', 'teamviewer', 'openvpn'], boost: 0.85 },
        {
          words: [
            'internet',
            'navegação',
            'sem rede',
            'conexão',
            'wi-fi',
            'wifi',
            'cabo de rede',
            'roteador',
            'link',
          ],
          boost: 0.8,
        },
        {
          words: [
            'email',
            'e-mail',
            'outlook',
            'webmail',
            'caixa postal',
            'troca de senha de email',
          ],
          boost: 0.8,
        },
        {
          words: ['impressora', 'impressão', 'toner', 'imprimir', 'papel preso', 'scanner'],
          boost: 0.8,
        },
        {
          words: [
            'computador',
            'notebook',
            'desktop',
            'não liga',
            'tela azul',
            'formatação',
            'lentidão',
          ],
          boost: 0.75,
        },
        {
          words: [
            'senha',
            'login',
            'bloqueio',
            'desbloqueio',
            'reset de senha',
            'usuário bloqueado',
          ],
          boost: 0.8,
        },
        { words: ['sistema', 'erp', 'software', 'erro no sistema', 'banco de dados'], boost: 0.7 },
      ]

      let best = null
      let maxScore = 0

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i]
        const name = (cat.getString('name') || '').toLowerCase()
        const desc = (cat.getString('description') || '').toLowerCase()

        let score = 0
        if (name.length >= 4 && clean.includes(name)) {
          score += 0.6
        }

        for (let k = 0; k < keywordsMap.length; k++) {
          const entry = keywordsMap[k]
          for (let w = 0; w < entry.words.length; w++) {
            const word = entry.words[w]
            if (clean.includes(word) && (name.includes(word) || desc.includes(word))) {
              score = Math.max(score, entry.boost)
            }
          }
        }

        if (score > maxScore) {
          maxScore = score
          best = cat
        }
      }

      if (best && maxScore >= 0.5) {
        const isSub = Boolean(best.getString('parent'))
        return {
          categoryId: isSub ? best.getString('parent') : best.id,
          subcategoryId: isSub ? best.id : '',
          name: best.getString('name'),
          confidence: maxScore,
          reason: 'Encaixe heurístico por termos-chave ("' + best.getString('name') + '").',
        }
      }

      return null
    }

    const dbg = []
    const applied = {
      applied: false,
      ticketId: '',
      category: '',
      subcategory: '',
      queue: '',
      confidence: 0,
      reason: '',
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const ticketId = body.ticketId || body.ticket_id
    if (!ticketId) {
      return e.json(400, { error: 'ticketId é obrigatório' })
    }
    applied.ticketId = ticketId

    // 1. Carregar chamado
    let ticket
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (err) {
      return e.json(404, { error: 'Chamado não encontrado: ' + ticketId })
    }

    const title = ticket.getString('title') || ''
    const description = ticket.getString('description') || ''
    const ticketNumber = ticket.getString('number') || ticket.id
    dbg.push('chamado carregado: ' + ticketNumber + ' | "' + title + '"')

    // 2. Ler configurações globais
    let triageEnabled = true
    let minConfidence = 0.45
    let defaultQueueId = ''

    try {
      const settingsRecs = $app.findRecordsByFilter('system_settings', 'key = "global"', '', 1, 0)
      if (settingsRecs && settingsRecs.length > 0) {
        const s = settingsRecs[0]
        triageEnabled = s.getBool('portal_auto_triage_enabled')
        const cfgConf = s.getFloat('portal_triage_min_confidence')
        if (cfgConf && cfgConf > 0) minConfidence = cfgConf
        defaultQueueId = s.getString('portal_triage_default_queue') || ''
      }
    } catch (errSettings) {
      dbg.push('erro ao ler system_settings: ' + errSettings)
    }

    if (!defaultQueueId) {
      try {
        const queues = $app.findRecordsByFilter('queues', 'id != ""', 'name', 1, 0)
        if (queues.length > 0) defaultQueueId = queues[0].id
      } catch (_) {}
    }

    if (!triageEnabled) {
      applied.reason = 'Triagem automática desativada nas configurações.'
      dbg.push('triagem desativada')
      recordHistory($app, {
        ticketId,
        ticketNumber,
        title,
        suggestedCategoryId: '',
        suggestedCategoryName: '',
        suggestedSubcategoryId: '',
        suggestedSubcategoryName: '',
        queueId: defaultQueueId,
        queueName: getQueueName($app, defaultQueueId),
        confidence: 0,
        reason: applied.reason,
        applied: false,
        source: 'disabled',
        matchMethod: 'none',
      })
      return e.json(200, { ...applied, debug: dbg })
    }

    // 3. Montar catálogo completo de atividades e subatividades
    let allCategories = []
    try {
      allCategories = $app.findRecordsByFilter('tkt_categories', 'id != ""', 'name', 0, 0)
    } catch (errCats) {
      dbg.push('falha ao ler tkt_categories: ' + errCats)
    }

    const parentCategories = []
    const subcategoryMap = {}
    const categoryById = {}

    for (let i = 0; i < allCategories.length; i++) {
      const cat = allCategories[i]
      categoryById[cat.id] = cat
      const parentId = cat.getString('parent')
      if (parentId) {
        if (!subcategoryMap[parentId]) subcategoryMap[parentId] = []
        subcategoryMap[parentId].push(cat)
      } else {
        parentCategories.push(cat)
      }
    }

    // 4. Montar resumo de artigos da Base de Conhecimento
    let kbArticles = []
    try {
      kbArticles = $app.findRecordsByFilter(
        'knowledge_articles',
        'status = "published"',
        '-created',
        30,
        0,
      )
    } catch (_) {}

    const kbContext = []
    for (let k = 0; k < kbArticles.length; k++) {
      const art = kbArticles[k]
      const artTitle = art.getString('title') || ''
      const artCategory = art.getString('category') || ''
      const artActivity = art.getString('activity') || ''
      const artTokens = art.getString('tokens') || art.getString('tags') || ''
      const artSummary = (art.getString('content') || '').replace(/<[^>]*>?/gm, ' ').slice(0, 160)
      kbContext.push(
        '- ' +
          artTitle +
          ' (Ref: ' +
          (artActivity || artCategory || 'Geral') +
          (artTokens ? ', tags: ' + artTokens : '') +
          '): ' +
          artSummary,
      )
    }

    // 5. Montar texto do catálogo formatado para o prompt
    const catalogLines = []
    for (let p = 0; p < parentCategories.length; p++) {
      const pCat = parentCategories[p]
      const pId = pCat.id
      const pName = pCat.getString('name') || ''
      const pDesc = pCat.getString('description') || ''
      const pQueue = pCat.getString('queue') || ''
      let line = '[' + pId + '] ' + pName + (pDesc ? ' — ' + pDesc : '')
      if (pQueue) line += ' (Fila: ' + pQueue + ')'
      catalogLines.push(line)

      const subs = subcategoryMap[pId] || []
      for (let s = 0; s < subs.length; s++) {
        const sub = subs[s]
        const sId = sub.id
        const sName = sub.getString('name') || ''
        const sDesc = sub.getString('description') || ''
        const sQueue = sub.getString('queue') || pQueue
        let subLine = '   └── [' + sId + '] Sub: ' + sName + (sDesc ? ' — ' + sDesc : '')
        if (sQueue) subLine += ' (Fila: ' + sQueue + ')'
        catalogLines.push(subLine)
      }
    }

    // 6. Preparar prompt de triagem
    const promptText =
      'Analise o chamado abaixo aberto pelo cliente e classifique-o no catálogo de serviços:\n\n' +
      'TÍTULO: ' +
      title +
      '\n' +
      'DESCRIÇÃO: ' +
      (description || '(sem descrição)') +
      '\n\n' +
      '=== CATÁLOGO DE ATIVIDADES E SUBATIVIDADES ===\n' +
      catalogLines.join('\n') +
      '\n\n' +
      (kbContext.length > 0
        ? '=== REFERÊNCIAS DA BASE DE CONHECIMENTO ===\n' + kbContext.join('\n') + '\n\n'
        : '') +
      'INSTRUÇÕES:\n' +
      '1. Encontre a atividade principal (category_id) e a subatividade (subcategory_id, se houver correspondente no catálogo).\n' +
      '2. Considere termos do dia a dia: VPN, rede, internet, conexão, Wi-Fi, e-mail, Outlook, impressora, sistema, senha, login, lentidão, formatação, backup, acesso, etc.\n' +
      '3. Responda ESTRITAMENTE em formato JSON puro, sem crases e sem explicações externas:\n' +
      '{"category_id": "...", "subcategory_id": "...", "confidence": 0.85, "reason": "justificativa sucinta"}'

    dbg.push('prompt montado (' + promptText.length + ' chars)')

    // 7. Chamada ao agente ou $ai.chat
    let rawResponse = ''
    let matchMethod = 'agent'
    try {
      const agent = $ai.agent('portal-ticket-triage-agent')
      if (agent && typeof agent.send === 'function') {
        const res = agent.send(promptText)
        rawResponse = typeof res === 'string' ? res : res.text || res.reply || JSON.stringify(res)
        dbg.push('agente respondeu via .send()')
      } else if (agent && typeof agent.chat === 'function') {
        const res = agent.chat({ message: promptText })
        rawResponse = typeof res === 'string' ? res : res.content || res.text || JSON.stringify(res)
        dbg.push('agente respondeu via .chat()')
      } else {
        throw new Error('Agente não possui método send() nem chat()')
      }
    } catch (errAgent) {
      dbg.push('agente nativo falhou: ' + errAgent + ' — tentando fallback $ai.chat')
      try {
        const chatRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o classificador automático de chamados do Lógos AITSM. Responda APENAS com JSON: {"category_id", "subcategory_id", "confidence", "reason"}.',
            },
            { role: 'user', content: promptText },
          ],
        })
        if (chatRes && chatRes.choices && chatRes.choices.length > 0) {
          rawResponse = chatRes.choices[0].message.content || ''
          matchMethod = 'ai_chat'
          dbg.push('$ai.chat respondeu com sucesso')
        }
      } catch (errChat) {
        dbg.push('$ai.chat falhou: ' + errChat)
      }
    }

    // 8. Fazer parse do JSON retornado pela IA
    let parsed = null
    if (rawResponse) {
      try {
        let clean = rawResponse.trim()
        if (clean.startsWith('```json')) clean = clean.slice(7)
        if (clean.startsWith('```')) clean = clean.slice(3)
        if (clean.endsWith('```')) clean = clean.slice(0, -3)
        clean = clean.trim()

        const startIdx = clean.indexOf('{')
        const endIdx = clean.lastIndexOf('}')
        if (startIdx >= 0 && endIdx > startIdx) {
          clean = clean.slice(startIdx, endIdx + 1)
        }
        parsed = JSON.parse(clean)
        dbg.push('JSON parseado com sucesso: ' + JSON.stringify(parsed))
      } catch (errParse) {
        dbg.push('falha ao parsear JSON: ' + errParse + ' | raw: ' + rawResponse.slice(0, 100))
      }
    }

    let chosenCategoryId = ''
    let chosenSubcategoryId = ''
    let chosenConfidence = 0
    let chosenReason = ''

    if (parsed) {
      chosenCategoryId = (parsed.category_id || parsed.activity_id || '').trim()
      chosenSubcategoryId = (parsed.subcategory_id || parsed.subactivity_id || '').trim()
      chosenConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
      chosenReason = parsed.reason || ''
    }

    // 9. Fallback heurístico inteligente se IA não conseguiu ou confiança foi baixa
    if ((!chosenCategoryId || chosenConfidence < minConfidence) && allCategories.length > 0) {
      dbg.push('ativando busca heurística de contingência no catálogo')
      const hMatch = heuristicMatch(title + ' ' + description, allCategories)
      if (hMatch && hMatch.confidence >= 0.5) {
        dbg.push('match heurístico encontrado: ' + hMatch.name + ' (' + hMatch.confidence + ')')
        if (!chosenCategoryId || hMatch.confidence > chosenConfidence) {
          chosenCategoryId = hMatch.categoryId
          chosenSubcategoryId = hMatch.subcategoryId
          chosenConfidence = hMatch.confidence
          chosenReason = hMatch.reason
          matchMethod = 'heuristic'
        }
      }
    }

    // 10. Validar e resolver categorias e subcategorias encontradas
    let validCategory = null
    let validSubcategory = null

    if (chosenCategoryId && categoryById[chosenCategoryId]) {
      const candidate = categoryById[chosenCategoryId]
      if (candidate.getString('parent')) {
        validSubcategory = candidate
        const parentId = candidate.getString('parent')
        if (categoryById[parentId]) {
          validCategory = categoryById[parentId]
        }
      } else {
        validCategory = candidate
      }
    }

    if (chosenSubcategoryId && categoryById[chosenSubcategoryId]) {
      const candidateSub = categoryById[chosenSubcategoryId]
      validSubcategory = candidateSub
      const pId = candidateSub.getString('parent')
      if (pId && !validCategory && categoryById[pId]) {
        validCategory = categoryById[pId]
      }
    }

    // 11. Determinar fila de destino
    let targetQueueId = ''
    if (validSubcategory && validSubcategory.getString('queue')) {
      targetQueueId = validSubcategory.getString('queue')
    } else if (validCategory && validCategory.getString('queue')) {
      targetQueueId = validCategory.getString('queue')
    }

    // 12. Avaliar se aplica ou cai em fallback
    let shouldApply = false
    let finalReason = chosenReason || ''

    if (validCategory && chosenConfidence >= minConfidence) {
      shouldApply = true
      if (!targetQueueId) {
        targetQueueId = defaultQueueId
      }
    } else {
      targetQueueId = defaultQueueId
      if (!validCategory) {
        finalReason = chosenReason || 'Atividade não identificada com precisão no catálogo.'
      } else {
        finalReason =
          'Confiança (' +
          chosenConfidence.toFixed(2) +
          ') abaixo do mínimo exigido (' +
          minConfidence +
          '). ' +
          (chosenReason ? 'Motivo IA: ' + chosenReason : '')
      }
    }

    const finalCategoryName = validCategory ? validCategory.getString('name') : ''
    const finalSubcategoryName = validSubcategory ? validSubcategory.getString('name') : ''
    const finalQueueName = getQueueName($app, targetQueueId)

    // 13. Persistir no chamado
    try {
      let changed = false
      if (shouldApply && validCategory) {
        ticket.set('category', validCategory.id)
        changed = true
      }
      if (shouldApply && validSubcategory) {
        ticket.set('subcategory', validSubcategory.id)
        changed = true
      }
      if (targetQueueId) {
        ticket.set('queue', targetQueueId)
        changed = true
      }

      if (changed) {
        $app.save(ticket)
        dbg.push('chamado atualizado com sucesso!')
      }

      applied.applied = shouldApply
      applied.category = finalCategoryName
      applied.subcategory = finalSubcategoryName
      applied.queue = finalQueueName
      applied.confidence = chosenConfidence
      applied.reason = finalReason
    } catch (errSave) {
      dbg.push('falha ao salvar chamado: ' + errSave)
      applied.reason = 'Erro ao persistir no chamado: ' + errSave
    }

    // 14. Registrar no histórico de triagem (portal_triage_history)
    recordHistory($app, {
      ticketId,
      ticketNumber,
      title,
      suggestedCategoryId: validCategory ? validCategory.id : '',
      suggestedCategoryName: finalCategoryName,
      suggestedSubcategoryId: validSubcategory ? validSubcategory.id : '',
      suggestedSubcategoryName: finalSubcategoryName,
      queueId: targetQueueId,
      queueName: finalQueueName,
      confidence: chosenConfidence,
      reason: finalReason,
      applied: applied.applied,
      source: 'portal',
      matchMethod: matchMethod,
    })

    return e.json(200, { ...applied, debug: dbg })
  },
  $apis.requireAuth(),
)

// ROTA AUXILIAR: GET /backend/v1/ai/portal-triage/history?ticketId=...
routerAdd(
  'GET',
  '/backend/v1/ai/portal-triage/history',
  (e) => {
    try {
      const ticketId = e.requestInfo().query.ticketId || e.requestInfo().query.ticket_id || ''
      const limit = parseInt(e.requestInfo().query.limit || '50', 10)

      let filter = 'id != ""'
      if (ticketId) {
        filter += ' && ticket_id = "' + ticketId.replace(/"/g, '') + '"'
      }

      const recs = $app.findRecordsByFilter('portal_triage_history', filter, '-created', limit, 0)
      const list = []
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i]
        list.push({
          id: r.id,
          ticket_id: r.getString('ticket_id'),
          ticket_number: r.getString('ticket_number'),
          title: r.getString('title'),
          suggested_category_id: r.getString('suggested_category_id'),
          suggested_category_name: r.getString('suggested_category_name'),
          suggested_subcategory_id: r.getString('suggested_subcategory_id'),
          suggested_subcategory_name: r.getString('suggested_subcategory_name'),
          queue_id: r.getString('queue_id'),
          queue_name: r.getString('queue_name'),
          confidence: r.getFloat('confidence'),
          reason: r.getString('reason'),
          applied: r.getBool('applied'),
          source: r.getString('source'),
          match_method: r.getString('match_method'),
          created: r.getString('created'),
        })
      }

      return e.json(200, { items: list, total: list.length })
    } catch (err) {
      return e.json(500, { error: 'Falha ao buscar histórico de triagem: ' + err })
    }
  },
  $apis.requireAuth(),
)
