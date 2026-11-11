onRecordCreate((e) => {
  var companyId = e.record.getString('company')
  if (companyId) {
    try {
      var company = $app.findRecordById('companies', companyId)
      var companyCode = company.getString('code') || 'SEM_COD'

      var existingTickets = $app.findRecordsByFilter(
        'tickets',
        'company = "' + companyId + '"',
        '-created',
        0,
        0,
      )

      var maxSeq = 0
      for (var i = 0; i < existingTickets.length; i++) {
        var num = existingTickets[i].getString('number')
        var match = num.match(/(\d+)\s*$/)
        if (match) {
          var seq = parseInt(match[1], 10)
          if (seq > maxSeq) maxSeq = seq
        }
      }

      var nextSeq = maxSeq + 1
      var seqStr = String(nextSeq)
      while (seqStr.length < 5) seqStr = '0' + seqStr
      e.record.set('number', companyCode + ' - ' + seqStr)
    } catch (err) {
      $app
        .logger()
        .error('ticket_on_create: failed to generate ticket number', 'error', err.message)
    }
  }

  // IMPORTANTE: NÃO há early-return sem subcategoria — a resolução de SLA abaixo
  // roda SEMPRE (atividade > atividade-mãe > cliente > contrato > padrão 30/240),
  // para nenhum chamado nascer sem prazo (causa-raiz do bug do CLI-001 - 00031).
  var subCategoryId = e.record.getString('subcategory')
  if (subCategoryId) {
    try {
      var subCat = $app.findRecordById('tkt_categories', subCategoryId)
      var parent = subCat.getString('parent')
      if (parent) {
        var impact = subCat.getString('impact')
        var urgency = subCat.getString('urgency')
        var priority = subCat.getString('priority')

        if (impact) e.record.set('impact', impact)
        if (urgency) e.record.set('urgency', urgency)
        if (priority) e.record.set('priority', priority)
      }
    } catch (err) {
      $app.logger().error('ticket_on_create: failed to read subcategory', 'error', err.message)
    }
  }

  // Resolução de SLA conforme ordem de precedência:
  // 1. Atividade do catálogo (subcategoria)
  // 2. Cliente (company)
  // 3. Contrato
  // 4. Padrão do sistema (30 min resposta / 240 min solução)
  try {
    var now = new Date()
    var targetResp = 0
    var targetSol = 0
    var slaSource = ''

    var actName = ''
    if (subCategoryId) {
      try {
        var act = $app.findRecordById('tkt_categories', subCategoryId)
        var actResp = act.getInt('sla_response_minutes') || 0
        var actSol = act.getInt('sla_solution_minutes') || 0
        if (actResp > 0) targetResp = actResp
        if (actSol > 0) targetSol = actSol
        actName = act.getString('name') || ''
      } catch (_) {}
    }

    // 1b. Categoria principal (atividade): preenche POR CAMPO o que a
    // subatividade não define — 0/0 no pai NUNCA vence a subatividade.
    var categoryId = e.record.getString('category')
    if (categoryId && (targetResp <= 0 || targetSol <= 0)) {
      try {
        var mainCat = $app.findRecordById('tkt_categories', categoryId)
        if (mainCat) {
          if (targetResp <= 0) targetResp = mainCat.getInt('sla_response_minutes') || 0
          if (targetSol <= 0) targetSol = mainCat.getInt('sla_solution_minutes') || 0
          if (!actName) actName = mainCat.getString('name') || ''
        }
      } catch (_) {}
    }
    if (targetResp > 0 || targetSol > 0) {
      if (targetResp <= 0) targetResp = 30
      if (targetSol <= 0) targetSol = 240
      slaSource = 'Atividade: ' + (actName || 'Catálogo')
    }

    if (!targetResp && !targetSol && companyId) {
      try {
        var comp = $app.findRecordById('companies', companyId)
        var compResp = comp.getInt('sla_response_minutes') || 0
        var compSol = comp.getInt('sla_solution_minutes') || 0
        if (compResp > 0 || compSol > 0) {
          targetResp = compResp > 0 ? compResp : 30
          targetSol = compSol > 0 ? compSol : 240
          slaSource = 'Cliente: ' + (comp.getString('trade_name') || 'Configuração do Cliente')
        }
      } catch (_) {}
    }

    var contractId = e.record.getString('contract')
    if (!targetResp && !targetSol && contractId) {
      try {
        var cntr = $app.findRecordById('contracts', contractId)
        var cntrResp = cntr.getInt('sla_response_time') || 0
        var cntrSol = cntr.getInt('sla_solution_time') || 0
        if (cntrResp > 0 || cntrSol > 0) {
          targetResp = cntrResp > 0 ? cntrResp : 30
          targetSol = cntrSol > 0 ? cntrSol : 240
          slaSource = 'Contrato'
        }
      } catch (_) {}
    }

    if (!targetResp && !targetSol) {
      targetResp = 30
      targetSol = 240
      slaSource = 'Padrão do Sistema'
    }

    // Contabilidade por expediente (empresa operadora, company_settings):
    // só desloca o prazo quando há horário de funcionamento cadastrado;
    // sem cadastro => calendário contínuo 24x7 (comportamento atual).
    var createdMs = now.getTime()
    try {
      var createdStr = e.record.getString('created')
      if (createdStr) {
        var cMs = new Date(createdStr).getTime()
        if (!isNaN(cMs)) createdMs = cMs
      }
    } catch (_) {}

    if (!e.record.getString('sla_response_deadline') && targetResp > 0) {
      var respDeadline = bhComputeDeadline(createdMs, targetResp, TZ_OFFSET_SAO_PAULO_MIN)
      if (!respDeadline) {
        respDeadline = new Date(createdMs + targetResp * 60000).toISOString()
      }
      e.record.set('sla_response_deadline', respDeadline)
    }
    if (!e.record.getString('sla_solution_deadline') && targetSol > 0) {
      var solDeadline = bhComputeDeadline(createdMs, targetSol, TZ_OFFSET_SAO_PAULO_MIN)
      if (!solDeadline) {
        solDeadline = new Date(createdMs + targetSol * 60000).toISOString()
      }
      e.record.set('sla_solution_deadline', solDeadline)
    }
    if (slaSource && !e.record.getString('sla_source')) {
      e.record.set('sla_source', slaSource)
    }
  } catch (slaErr) {
    $app.logger().error('ticket_on_create: failed to resolve SLA', 'error', slaErr.message)
  }

  return e.next()
}, 'tickets')

// =========================================================================
// TRIAGEM AUTOMÁTICA POR IA NA CRIAÇÃO DO CHAMADO (100% AUTÔNOMA E ASSÍNCRONA)
// Executa em onRecordAfterCreateSuccess para não bloquear a resposta da API de criação.
// Categoriza chamados criados sem categoria (Portal, E-mail, API ou Interno)
// aplicando Categoria, Subatividade, Fila e SLA calculados pelo expediente.
// =========================================================================
onRecordAfterCreateSuccess((e) => {
  try {
    var ticket = e.record
    if (!ticket) return e.next()

    // Se o chamado já foi categorizado manualmente na abertura, respeitar a escolha humana
    var existingCat = ticket.getString('category')
    var existingSub = ticket.getString('subcategory')
    if (existingCat || existingSub) {
      return e.next()
    }

    var ticketId = ticket.id
    var title = ticket.getString('title') || ''
    var description = ticket.getString('description') || ''
    var ticketNumber = ticket.getString('number') || ticketId

    if (!title && !description) {
      return e.next()
    }

    // Verificar se triagem automática está habilitada nas configurações
    var triageEnabled = true
    var minConfidence = 0.45
    var defaultQueueId = ''

    try {
      var settingsRecs = e.app.findRecordsByFilter('system_settings', 'key = "global"', '', 1, 0)
      if (settingsRecs && settingsRecs.length > 0) {
        var s = settingsRecs[0]
        if (typeof s.getBool === 'function') {
          triageEnabled = s.getBool('portal_auto_triage_enabled')
        }
        var cfgConf = s.getFloat('portal_triage_min_confidence')
        if (cfgConf && cfgConf > 0) minConfidence = cfgConf
        defaultQueueId = s.getString('portal_triage_default_queue') || ''
      }
    } catch (_) {}

    if (!defaultQueueId) {
      try {
        var queues = e.app.findRecordsByFilter('queues', 'id != ""', 'priority,name', 1, 0)
        if (queues.length > 0) defaultQueueId = queues[0].id
      } catch (_) {}
    }

    if (!triageEnabled) {
      return e.next()
    }

    // Carregar catálogo de atividades e subatividades
    var allCategories = []
    try {
      allCategories = e.app.findRecordsByFilter('tkt_categories', 'id != ""', 'name', 0, 0)
    } catch (errCats) {
      console.warn('[AI_AUTO_TRIAGE] Falha ao carregar tkt_categories:', errCats)
      return e.next()
    }

    if (!allCategories || allCategories.length === 0) {
      return e.next()
    }

    var parentCategories = []
    var subcategoryMap = {}
    var categoryById = {}

    for (var i = 0; i < allCategories.length; i++) {
      var cat = allCategories[i]
      categoryById[cat.id] = cat
      var parentId = cat.getString('parent')
      if (parentId) {
        if (!subcategoryMap[parentId]) subcategoryMap[parentId] = []
        subcategoryMap[parentId].push(cat)
      } else {
        parentCategories.push(cat)
      }
    }

    // Carregar artigos publicados da Base de Conhecimento para enriquecer o contexto
    var kbArticles = []
    try {
      kbArticles = e.app.findRecordsByFilter(
        'knowledge_articles',
        'status = "published"',
        '-created',
        30,
        0,
      )
    } catch (_) {}

    var kbContext = []
    for (var k = 0; k < kbArticles.length; k++) {
      var art = kbArticles[k]
      var artTitle = art.getString('title') || ''
      var artCategory = art.getString('category') || ''
      var artActivity = art.getString('activity') || ''
      var artTokens = art.getString('tokens') || art.getString('tags') || ''
      var artSummary = (art.getString('content') || '').replace(/<[^>]*>?/gm, ' ').slice(0, 160)
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

    // Montar texto do catálogo formatado para o prompt
    var catalogLines = []
    for (var p = 0; p < parentCategories.length; p++) {
      var pCat = parentCategories[p]
      var pId = pCat.id
      var pName = pCat.getString('name') || ''
      var pDesc = pCat.getString('description') || ''
      var pQueue = pCat.getString('queue') || ''
      var line = '[' + pId + '] ' + pName + (pDesc ? ' — ' + pDesc : '')
      if (pQueue) line += ' (Fila: ' + pQueue + ')'
      catalogLines.push(line)

      var subs = subcategoryMap[pId] || []
      for (var sIdx = 0; sIdx < subs.length; sIdx++) {
        var sub = subs[sIdx]
        var sId = sub.id
        var sName = sub.getString('name') || ''
        var sDesc = sub.getString('description') || ''
        var sQueue = sub.getString('queue') || pQueue
        var subLine = '   └── [' + sId + '] Sub: ' + sName + (sDesc ? ' — ' + sDesc : '')
        if (sQueue) subLine += ' (Fila: ' + sQueue + ')'
        catalogLines.push(subLine)
      }
    }

    var promptText =
      'Analise o chamado abaixo e classifique-o no catálogo de serviços de TI / ITSM:\n\n' +
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
      '3. Responda ESTRITAMENTE em formato JSON puro, sem markdown e sem explicações externas:\n' +
      '{"category_id": "...", "subcategory_id": "...", "confidence": 0.85, "reason": "justificativa sucinta em português"}'

    // Invocação da IA: Prioriza agente nativo com fallback para $ai.chat
    var rawResponse = ''
    var matchMethod = 'agent'

    try {
      var agent = $ai.agent('portal-ticket-triage-agent')
      if (agent && typeof agent.chat === 'function') {
        var resChat = agent.chat({ message: promptText })
        rawResponse =
          typeof resChat === 'string'
            ? resChat
            : (resChat && (resChat.content || resChat.text || resChat.reply)) ||
              JSON.stringify(resChat)
        matchMethod = 'agent'
      } else if (agent && typeof agent.send === 'function') {
        var resSend = agent.send(promptText)
        rawResponse =
          typeof resSend === 'string'
            ? resSend
            : (resSend && (resSend.text || resSend.reply || resSend.content)) ||
              JSON.stringify(resSend)
        matchMethod = 'agent'
      } else {
        throw new Error('Agente não possui método chat() nem send()')
      }
    } catch (errAgent) {
      try {
        var chatRes = $ai.chat({
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
        }
      } catch (errChat) {
        console.warn('[AI_AUTO_TRIAGE] Fallback $ai.chat também falhou:', errChat)
      }
    }

    // Parse do JSON da resposta
    var parsed = null
    if (rawResponse) {
      try {
        var clean = rawResponse.trim()
        if (clean.indexOf('```json') === 0) clean = clean.slice(7)
        if (clean.indexOf('```') === 0) clean = clean.slice(3)
        if (clean.lastIndexOf('```') === clean.length - 3) clean = clean.slice(0, -3)
        clean = clean.trim()

        var startIdx = clean.indexOf('{')
        var endIdx = clean.lastIndexOf('}')
        if (startIdx >= 0 && endIdx > startIdx) {
          clean = clean.slice(startIdx, endIdx + 1)
        }
        parsed = JSON.parse(clean)
      } catch (errParse) {
        console.warn(
          '[AI_AUTO_TRIAGE] Falha ao parsear JSON da IA:',
          errParse,
          'raw:',
          rawResponse.slice(0, 100),
        )
      }
    }

    var chosenCategoryId = ''
    var chosenSubcategoryId = ''
    var chosenConfidence = 0
    var chosenReason = ''

    if (parsed) {
      chosenCategoryId = (parsed.category_id || parsed.activity_id || '').trim()
      chosenSubcategoryId = (parsed.subcategory_id || parsed.subactivity_id || '').trim()
      chosenConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
      chosenReason = parsed.reason || ''
    }

    // Heurística de contingência se IA não conseguiu ou confiança < minConfidence
    if ((!chosenCategoryId || chosenConfidence < minConfidence) && allCategories.length > 0) {
      var heuristicMatch = function (text, categories) {
        if (!text) return null
        var cleanText = text.toLowerCase()
        var keywordsMap = [
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
          {
            words: ['sistema', 'erp', 'software', 'erro no sistema', 'banco de dados'],
            boost: 0.7,
          },
        ]

        var best = null
        var maxScore = 0

        for (var idx = 0; idx < categories.length; idx++) {
          var c = categories[idx]
          var name = (c.getString('name') || '').toLowerCase()
          var desc = (c.getString('description') || '').toLowerCase()
          var score = 0
          if (name.length >= 4 && cleanText.indexOf(name) !== -1) {
            score += 0.6
          }

          for (var kIdx = 0; kIdx < keywordsMap.length; kIdx++) {
            var entry = keywordsMap[kIdx]
            for (var wIdx = 0; wIdx < entry.words.length; wIdx++) {
              var word = entry.words[wIdx]
              if (
                cleanText.indexOf(word) !== -1 &&
                (name.indexOf(word) !== -1 || desc.indexOf(word) !== -1)
              ) {
                if (entry.boost > score) score = entry.boost
              }
            }
          }

          if (score > maxScore) {
            maxScore = score
            best = c
          }
        }

        if (best && maxScore >= 0.5) {
          var isSub = Boolean(best.getString('parent'))
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

      var hMatch = heuristicMatch(title + ' ' + description, allCategories)
      if (hMatch && hMatch.confidence >= 0.5) {
        if (!chosenCategoryId || hMatch.confidence > chosenConfidence) {
          chosenCategoryId = hMatch.categoryId
          chosenSubcategoryId = hMatch.subcategoryId
          chosenConfidence = hMatch.confidence
          chosenReason = hMatch.reason
          matchMethod = 'heuristic'
        }
      }
    }

    // Validar e resolver categorias e subcategorias (por ID ou por nome)
    var validCategory = null
    var validSubcategory = null

    var findCategoryByIdOrName = function (idOrName) {
      if (!idOrName) return null
      var term = String(idOrName).trim().toLowerCase()
      if (categoryById[idOrName]) return categoryById[idOrName]
      for (var i = 0; i < allCategories.length; i++) {
        var c = allCategories[i]
        if (c.id === idOrName) return c
        var cName = (c.getString('name') || '').trim().toLowerCase()
        if (cName === term) return c
      }
      for (var j = 0; j < allCategories.length; j++) {
        var cat = allCategories[j]
        var catName = (cat.getString('name') || '').trim().toLowerCase()
        if (term.length >= 3 && (catName.indexOf(term) !== -1 || term.indexOf(catName) !== -1)) {
          return cat
        }
      }
      return null
    }

    if (chosenCategoryId) {
      var candidate = findCategoryByIdOrName(chosenCategoryId)
      if (candidate) {
        if (candidate.getString('parent')) {
          validSubcategory = candidate
          var pId = candidate.getString('parent')
          if (categoryById[pId]) validCategory = categoryById[pId]
        } else {
          validCategory = candidate
        }
      }
    }

    if (chosenSubcategoryId) {
      var candidateSub = findCategoryByIdOrName(chosenSubcategoryId)
      if (candidateSub) {
        validSubcategory = candidateSub
        var parId = candidateSub.getString('parent')
        if (parId && !validCategory && categoryById[parId]) {
          validCategory = categoryById[parId]
        }
      }
    }

    // Se mesmo após IA + heurística ainda não tiver categoria, fallback para melhor correspondência no catálogo
    if (!validCategory && allCategories.length > 0) {
      var fallbackMatch = heuristicMatch(title + ' ' + description, allCategories)
      if (fallbackMatch && fallbackMatch.categoryId && categoryById[fallbackMatch.categoryId]) {
        validCategory = categoryById[fallbackMatch.categoryId]
        if (fallbackMatch.subcategoryId && categoryById[fallbackMatch.subcategoryId]) {
          validSubcategory = categoryById[fallbackMatch.subcategoryId]
        }
        chosenConfidence = Math.max(chosenConfidence, fallbackMatch.confidence || 0.4)
        chosenReason =
          chosenReason || fallbackMatch.reason || 'Classificado por aproximação no catálogo.'
        matchMethod = 'heuristic_fallback'
      } else {
        var rootCats = allCategories.filter(function (c) {
          return !c.getString('parent')
        })
        if (rootCats.length > 0) {
          validCategory = rootCats[0]
          chosenConfidence = Math.max(chosenConfidence, 0.3)
          chosenReason = chosenReason || 'Classificado na atividade padrão do catálogo.'
          matchMethod = 'catalog_default'
        }
      }
    }

    // Se temos subcategoria mas sem categoria principal resolvida, herda do parent
    if (validSubcategory && !validCategory && validSubcategory.getString('parent')) {
      var parRefId = validSubcategory.getString('parent')
      if (categoryById[parRefId]) validCategory = categoryById[parRefId]
    }

    // Se temos categoria principal mas sem subcategoria, e ela possui subatividades, tenta achar a melhor subatividade
    if (validCategory && !validSubcategory) {
      var subList = subcategoryMap[validCategory.id] || []
      if (subList.length > 0) {
        var textToMatch = (title + ' ' + description).toLowerCase()
        var bestSub = null
        for (var sI = 0; sI < subList.length; sI++) {
          var sName = (subList[sI].getString('name') || '').toLowerCase()
          if (sName && textToMatch.indexOf(sName) !== -1) {
            bestSub = subList[sI]
            break
          }
        }
        if (bestSub) {
          validSubcategory = bestSub
        } else {
          validSubcategory = subList[0]
        }
      }
    }

    // Determinar fila de destino
    var targetQueueId = ''
    if (validSubcategory && validSubcategory.getString('queue')) {
      targetQueueId = validSubcategory.getString('queue')
    } else if (validCategory && validCategory.getString('queue')) {
      targetQueueId = validCategory.getString('queue')
    }
    if (!targetQueueId) {
      targetQueueId = defaultQueueId
    }

    // Autonomia total: sempre aplicar categoria e subcategoria identificadas
    var shouldApply = Boolean(validCategory)
    var finalReason = chosenReason || 'Classificado automaticamente pela IA no catálogo.'
    if (chosenConfidence < minConfidence) {
      finalReason +=
        ' (Classificado com baixa confiança: ' + Math.round(chosenConfidence * 100) + '%)'
    }

    var finalCategoryName = validCategory ? validCategory.getString('name') : ''
    var finalSubcategoryName = validSubcategory ? validSubcategory.getString('name') : ''

    var finalQueueName = ''
    if (targetQueueId) {
      try {
        var qRec = e.app.findRecordById('queues', targetQueueId)
        if (qRec) finalQueueName = qRec.getString('name') || ''
      } catch (_) {}
    }

    // Resolver SLA do catálogo (subatividade > atividade > padrão 30/240 min)
    var applyCatalogSla = function (app, categoryId, subId) {
      var resp = 0
      var sol = 0
      var actName = ''
      if (subId) {
        try {
          var subRecord = app.findRecordById('tkt_categories', subId)
          resp = subRecord.getInt('sla_response_minutes') || 0
          sol = subRecord.getInt('sla_solution_minutes') || 0
          actName = subRecord.getString('name') || ''
        } catch (_) {}
      }
      if (categoryId && (resp <= 0 || sol <= 0)) {
        try {
          var mainRecord = app.findRecordById('tkt_categories', categoryId)
          if (mainRecord) {
            if (resp <= 0) resp = mainRecord.getInt('sla_response_minutes') || 0
            if (sol <= 0) sol = mainRecord.getInt('sla_solution_minutes') || 0
            if (!actName) actName = mainRecord.getString('name') || ''
          }
        } catch (_) {}
      }
      if (resp <= 0) resp = 30
      if (sol <= 0) sol = 240

      var respDl = null
      var solDl = null
      var offset =
        typeof globalThis.TZ_OFFSET_SAO_PAULO_MIN !== 'undefined'
          ? globalThis.TZ_OFFSET_SAO_PAULO_MIN
          : -180

      try {
        if (typeof globalThis.bhComputeDeadline === 'function') {
          var nowMs = Date.now()
          respDl = globalThis.bhComputeDeadline(nowMs, resp, offset)
          solDl = globalThis.bhComputeDeadline(nowMs, sol, offset)
        }
      } catch (_) {}

      if (!respDl) respDl = new Date(Date.now() + resp * 60000).toISOString()
      if (!solDl) solDl = new Date(Date.now() + sol * 60000).toISOString()

      return { resp: resp, sol: sol, respDl: respDl, solDl: solDl, actName: actName }
    }

    // Persistir categorização no chamado
    try {
      var freshTicket = e.app.findRecordById('tickets', ticketId)
      var changed = false

      if (validCategory) {
        freshTicket.set('category', validCategory.id)
        changed = true
      }
      if (validSubcategory) {
        freshTicket.set('subcategory', validSubcategory.id)
        changed = true

        // Herdar impacto/urgência/prioridade da subatividade se definidos
        var subImpact = validSubcategory.getString('impact')
        var subUrgency = validSubcategory.getString('urgency')
        var subPriority = validSubcategory.getString('priority')
        if (subImpact) freshTicket.set('impact', subImpact)
        if (subUrgency) freshTicket.set('urgency', subUrgency)
        if (subPriority) freshTicket.set('priority', subPriority)
      }
      if (targetQueueId && !freshTicket.getString('queue')) {
        freshTicket.set('queue', targetQueueId)
        changed = true
      }

      if (validCategory || validSubcategory) {
        var slaResult = applyCatalogSla(
          e.app,
          validCategory ? validCategory.id : '',
          validSubcategory ? validSubcategory.id : '',
        )
        if (!freshTicket.getString('sla_response_at')) {
          freshTicket.set('sla_response_deadline', slaResult.respDl)
        }
        freshTicket.set('sla_solution_deadline', slaResult.solDl)
        freshTicket.set('sla_source', 'Atividade: ' + (slaResult.actName || 'Catálogo'))
        changed = true
      }

      var triageSuggestionObj = {
        type: freshTicket.getString('type') || 'Incidente',
        category: validCategory ? validCategory.id : '',
        category_name: finalCategoryName,
        subcategory: validSubcategory ? validSubcategory.id : '',
        subcategory_name: finalSubcategoryName,
        queue: targetQueueId,
        queue_name: finalQueueName,
        confidence: chosenConfidence,
        reason: finalReason,
        source: matchMethod,
        applied: shouldApply,
      }
      freshTicket.set('triage_suggestions', triageSuggestionObj)
      changed = true

      if (changed) {
        e.app.save(freshTicket)
        console.log(
          '[AI_AUTO_TRIAGE] Chamado ' +
            ticketNumber +
            ' categorizado com sucesso por IA: ' +
            finalCategoryName +
            ' > ' +
            finalSubcategoryName +
            ' (confiança: ' +
            Math.round(chosenConfidence * 100) +
            '%)',
        )
      }
    } catch (errSaveTicket) {
      console.warn(
        '[AI_AUTO_TRIAGE] Falha ao persistir categorização no chamado ' + ticketNumber + ':',
        errSaveTicket,
      )
    }

    // Registrar no histórico de triagem (portal_triage_history) para auditoria e métricas
    try {
      var histCol = e.app.findCollectionByNameOrId('portal_triage_history')
      if (histCol) {
        var rec = new Record(histCol)
        rec.set('ticket_id', ticketId)
        rec.set('ticket_number', ticketNumber)
        rec.set('title', title.slice(0, 300))
        rec.set('suggested_category_id', validCategory ? validCategory.id : '')
        rec.set('suggested_category_name', finalCategoryName)
        rec.set('suggested_subcategory_id', validSubcategory ? validSubcategory.id : '')
        rec.set('suggested_subcategory_name', finalSubcategoryName)
        rec.set('queue_id', targetQueueId)
        rec.set('queue_name', finalQueueName)
        rec.set('confidence', chosenConfidence)
        rec.set('reason', finalReason.slice(0, 1000))
        rec.set('applied', shouldApply)
        rec.set('source', 'IA')
        rec.set('match_method', matchMethod)
        e.app.save(rec)
      }
    } catch (errHist) {
      console.warn('[AI_AUTO_TRIAGE] Falha ao registrar portal_triage_history:', errHist)
    }
  } catch (errGlobal) {
    console.warn('[AI_AUTO_TRIAGE] Erro global na triagem automática (não bloqueante):', errGlobal)
  }

  return e.next()
}, 'tickets')
