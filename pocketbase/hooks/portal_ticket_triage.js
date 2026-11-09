/**
 * portal_ticket_triage.js — Triagem automática por IA do Portal do Cliente.
 *
 * Chamado a partir do frontend (fire-and-forget) via POST /backend/v1/ai/portal-triage
 * { ticketId }. O agente nativo `portal-ticket-triage-agent` lê título + descrição,
 * encontra a atividade (tkt_categories) correspondente no catálogo e distribui para
 * a fila (queues) configurada nessa atividade.
 *
 * IMPORTANTE (scoping do JSVM): TODO o corpo das lógicas deve ficar INLINE dentro
 * de cada callback — nenhum helper/constante de topo pode ser referenciado dentro
 * de callbacks do PocketBase.
 */

routerAdd(
  'POST',
  '/backend/v1/ai/portal-triage',
  (e) => {
    const dbg = []
    const applied = { applied: false, reason: '', confidence: 0, activity: '', queue: '' }

    // --- 1. Autenticação: apenas operadores autenticados disparam a triagem -----
    const auth = e.auth
    if (!auth || !auth.id) {
      return e.json(401, { error: 'Não autenticado.' })
    }

    // --- 2. Payload -------------------------------------------------------------
    let payload = {}
    try {
      payload = e.requestInfo().body
    } catch (err) {
      payload = {}
    }
    const ticketId = payload.ticketId
    dbg.push('ticketId=' + (ticketId || 'vazio'))
    if (!ticketId) {
      return e.json(400, { error: 'ticketId é obrigatório.', debug: dbg })
    }

    // --- 3. Configurações (system_settings, key=global) ---------------------------
    let triageEnabled = true
    let minConfidence = 0.4
    let defaultQueueId = ''
    try {
      const settingsRecords = $app.findRecordsByFilter(
        'system_settings',
        'key = "global"',
        '',
        1,
        0,
      )
      if (settingsRecords.length > 0) {
        const s = settingsRecords[0]
        triageEnabled = s.getBool('portal_auto_triage_enabled')
        minConfidence = s.getFloat('portal_triage_min_confidence')
        if (minConfidence <= 0) minConfidence = 0.4
        defaultQueueId = s.getString('portal_triage_default_queue')
        dbg.push('settings: enabled=' + triageEnabled + ' minConf=' + minConfidence)
      } else {
        dbg.push('settings: registro global não encontrado, usando defaults')
      }
    } catch (err) {
      dbg.push('settings: erro ao ler (' + err + '), usando defaults')
    }

    if (!triageEnabled) {
      applied.reason = 'Triagem automática desativada nas configurações.'
      dbg.push('triagem desativada')
      return e.json(200, { ...applied, debug: dbg })
    }

    // --- 4. Carregar o chamado ---------------------------------------------------
    let ticket = null
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (err) {
      return e.json(404, { error: 'Chamado não encontrado.', debug: dbg })
    }

    // Segurança: o chamado precisa pertencer à empresa do usuário autenticado
    // (portal) OU o usuário precisa ser admin/gestor disparando manualmente.
    const authEmail = auth.getString('email') || ''
    const ticketRequesterEmail = ticket.getString('requester_email') || ''
    let isOwnerCompany = false
    try {
      const companyId = ticket.getString('company')
      if (companyId && auth.getString('company')) {
        isOwnerCompany = companyId === auth.getString('company')
      }
    } catch (err) {
      isOwnerCompany = false
    }
    const role = (auth.getString('role') || '').toLowerCase()
    const isPrivileged = role === 'admin' || role === 'gestor'
    const matchesRequester = authEmail && ticketRequesterEmail && authEmail === ticketRequesterEmail
    if (!matchesRequester && !isOwnerCompany && !isPrivileged) {
      return e.json(403, {
        error: 'Sem permissão para disparar a triagem deste chamado.',
        debug: dbg,
      })
    }

    // --- 5. Já triagido? (com fila e categoria preenchidas, não refaz) -----------
    try {
      const currentQueue = ticket.getString('queue')
      const currentCategory = ticket.getString('category')
      if (currentQueue && currentCategory) {
        applied.reason = 'Chamado já possui fila e categoria definidas — triagem ignorada.'
        dbg.push('já triagido: queue=' + currentQueue + ' category=' + currentCategory)
        return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
      }
    } catch (err) {
      dbg.push('verificação de triagem prévia: ' + err)
    }

    // --- 6. Texto do chamado ------------------------------------------------------
    const title = ticket.getString('title') || ''
    const description = ticket.getString('description') || ''
    if (!title && !description) {
      applied.reason = 'Chamado sem título e descrição — nada para o agente analisar.'
      dbg.push('sem texto')
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    // --- 7. Catálogo: atividades (tkt_categories) + filas (queues) ---------------
    // tkt_categories: id, name, queue (relation -> queues), parent (self)
    // queues: id, name
    let activityList = []
    try {
      activityList = $app.findRecordsByFilter('tkt_categories', '', '-created', 500, 0)
    } catch (err) {
      dbg.push('catálogo: erro ao listar tkt_categories (' + err + ')')
    }
    if (!activityList || activityList.length === 0) {
      applied.reason = 'Catálogo de atividades vazio — sem destino possível.'
      dbg.push('catálogo vazio')
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    // Mapa id->nome para exibição, e lista textual para o prompt do agente.
    let catalogLines = []
    for (const act of activityList) {
      const actId = act.id
      const actName = act.getString('name') || 'Sem nome'
      let actQueue = act.getString('queue')
      let queueName = ''
      if (actQueue) {
        try {
          const q = $app.findRecordById('queues', actQueue)
          queueName = q ? q.getString('name') || '' : ''
        } catch (err) {
          queueName = ''
        }
      }
      catalogLines.push(
        '- id: ' + actId + ' | atividade: ' + actName + ' | fila vinculada: ' + queueName,
      )
      applied.activity = applied.activity || actName
    }
    dbg.push('catálogo: ' + catalogLines.length + ' atividades')

    // --- 8. Agente nativo (definido na migração 0141) ----------------------------
    let agentResponse = null
    try {
      agentResponse = $ai
        .agent('portal-ticket-triage-agent')
        .prompt(
          'Analise o chamado abaixo e escolha a atividade do catálogo que melhor se ' +
            'enquadra. Responda ESTRITAMENTE em JSON com as chaves activity_id (string), ' +
            'confidence (número de 0 a 1) e reason (string curta).\n\n' +
            '=== CATÁLOGO DE ATIVIDADES ===\n' +
            catalogLines.join('\n') +
            '\n\n=== CHAMADO ===\n' +
            'Título: ' +
            title +
            '\n' +
            'Descrição: ' +
            description +
            '\n',
        )
    } catch (err) {
      dbg.push('agente: erro (' + err + ')')
      applied.reason = 'Falha ao consultar o agente de IA.'
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    // --- 9. Interpretar resposta do agente ---------------------------------------
    let chosenActivityId = ''
    let chosenConfidence = 0
    let chosenReason = ''
    try {
      const raw = agentResponse.reply || agentResponse || ''
      let text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      // Extrair o primeiro bloco JSON da resposta
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(text.slice(start, end + 1))
        chosenActivityId = parsed.activity_id || parsed.activityId || ''
        chosenConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
        chosenReason = parsed.reason || ''
      } else {
        dbg.push('agente: resposta sem JSON')
      }
    } catch (err) {
      dbg.push('agente: falha ao interpretar resposta (' + err + ')')
      applied.reason = 'Resposta do agente não pôde ser interpretada.'
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    dbg.push(
      'agente: id=' + chosenActivityId + ' conf=' + chosenConfidence + ' reason=' + chosenReason,
    )

    // --- 10. Validar atividade escolhida contra o catálogo -----------------------
    let chosen = null
    if (chosenActivityId) {
      for (const act of activityList) {
        if (act.id === chosenActivityId) {
          chosen = act
          break
        }
      }
    }
    if (!chosen) {
      applied.reason = 'Atividade escolhida pelo agente não existe no catálogo.'
      dbg.push('atividade inexistente: ' + chosenActivityId)
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    // --- 11. Destino: fila da atividade escolhida, com fallback -------------------
    let matchedActivityName = ''
    let matchedQueueId = ''
    let matchedCategoryId = ''
    let matchedSubcategoryId = ''
    let matchedConfidence = 0
    let matchedReason = chosenReason

    if (chosen && chosenConfidence >= minConfidence) {
      matchedActivityName = chosen.getString('name') || ''
      matchedQueueId = chosen.getString('queue') || ''
      matchedCategoryId = chosen.id
      matchedConfidence = chosenConfidence
      // Se a atividade escolhida é uma subatividade (tem parent), a categoria
      // do chamado é a atividade principal e a subatividade é a escolhida.
      try {
        const parentId = chosen.getString('parent')
        if (parentId) {
          matchedSubcategoryId = chosen.id
          matchedCategoryId = parentId
        }
      } catch (err) {
        dbg.push('parent/subcategory: ' + err)
      }
      if (!matchedQueueId) {
        matchedQueueId = defaultQueueId
        dbg.push('atividade sem fila; usando fila padrão das settings')
      }
    } else {
      // Fallback: agente não encaixou (atividade inexistente ou confiança
      // abaixo do mínimo) — o chamado vai para o destino padrão configurável.
      matchedQueueId = defaultQueueId
      matchedReason = chosen
        ? 'Confiança ' + chosenConfidence + ' abaixo do mínimo (' + minConfidence + ').'
        : 'Atividade escolhida pelo agente não existe no catálogo.'
      dbg.push('fallback para fila padrão')
    }

    if (!matchedQueueId) {
      applied.reason = matchedReason || 'Sem fila vinculada à atividade e sem fila padrão.'
      dbg.push('sem destino')
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    let queueName = ''
    try {
      const q = $app.findRecordById('queues', matchedQueueId)
      queueName = q ? q.getString('name') || '' : ''
    } catch (err) {
      dbg.push('fila destino não encontrada: ' + matchedQueueId)
      return e.json(200, { ...applied, reason: 'Fila destino inexistente.', debug: dbg })
    }

    // --- 12. Aplicar: categoria (se houve encaixe) + fila no chamado -------------
    try {
      if (matchedCategoryId) {
        ticket.set('category', matchedCategoryId)
      }
      if (matchedSubcategoryId) {
        ticket.set('subcategory', matchedSubcategoryId)
      }
      ticket.set('queue', matchedQueueId)
      $app.save(ticket)
      applied.applied = true
      applied.confidence = matchedConfidence
      applied.queue = queueName
      applied.activity = matchedActivityName
      applied.reason = matchedReason
      dbg.push('aplicado: category=' + matchedCategoryId + ' queue=' + matchedQueueId)
    } catch (err) {
      dbg.push('falha ao salvar chamado: ' + err)
      applied.reason = 'Falha ao persistir categoria e fila no chamado.'
      return e.json(200, { ...applied, reason: applied.reason, debug: dbg })
    }

    return e.json(200, { ...applied, debug: dbg })
  },
  $apis.requireAuth(),
)
