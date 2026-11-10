/**
 * Hook do Agente Nativo de IA para Resposta e Sugestão de Tags em Chamados ITSM
 * Rotas:
 * - POST /backend/v1/ai/ticket-draft : Gera rascunho de resposta para o chamado usando o agente nativo 'ticket-responder-agent'
 * - POST /backend/v1/ai/ticket-tags  : Analisa contexto do chamado e gera lista de tags relevantes sugeridas pela IA
 * - GET  /backend/v1/ai/ticket-settings : Retorna a configuração vigente de IA para chamados
 * - POST /backend/v1/ai/ticket-settings : Salva configuração de IA para chamados (admin/gestor)
 *
 * Automação:
 * - onRecordAfterCreateSuccess('tickets') : Se resposta automática estiver habilitada, gera e posta uma interação pública gerada por IA
 */

// ROTA: POST /backend/v1/ai/ticket-draft
routerAdd('POST', '/backend/v1/ai/ticket-draft', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const ticketId = body.ticketId || body.ticket_id
  const customPrompt = body.prompt || body.custom_prompt || ''

  if (!ticketId) {
    return e.json(400, { error: 'ticketId é obrigatório.' })
  }

  let ticket
  try {
    ticket = e.app.findRecordById('tickets', ticketId)
  } catch (err) {
    return e.json(404, { error: 'Chamado não encontrado.' })
  }

  // Buscar configurações
  let settings = {
    enabled: true,
    mode: 'both',
    include_kb: true,
    include_history: true,
    include_asset: true,
    system_instructions: '',
    tag_suggestions_enabled: true,
  }

  try {
    const settingsRecs = e.app.findRecordsByFilter(
      'ai_ticket_settings',
      'scope = "global"',
      '',
      1,
      0,
    )
    if (settingsRecs.length > 0) {
      const s = settingsRecs[0]
      settings.enabled = s.getBool('enabled')
      settings.mode = s.getString('mode') || 'both'
      settings.include_kb = s.getBool('include_kb')
      settings.include_history = s.getBool('include_history')
      settings.include_asset = s.getBool('include_asset')
      settings.system_instructions = s.getString('system_instructions') || ''
      settings.tag_suggestions_enabled = s.getBool('tag_suggestions_enabled')
    }
  } catch (errSettings) {
    console.warn('[AI_TICKET] Erro ao ler ai_ticket_settings:', errSettings)
  }

  if (!settings.enabled) {
    return e.json(400, {
      error: 'A funcionalidade de IA para chamados está desativada nas configurações.',
    })
  }

  try {
    const number = ticket.getString('number') || ticket.id
    const title = ticket.getString('title') || 'Sem título'
    const description = ticket.getString('description') || 'Sem descrição'
    const requesterName = ticket.getString('requester_name') || 'Solicitante'
    const source = ticket.getString('source') || 'Portal'
    const priority = ticket.getString('priority') || 'Média'
    const type = ticket.getString('type') || 'Incidente'

    let promptText =
      'Contexto do Chamado:\n' +
      '- Número: ' +
      number +
      '\n' +
      '- Solicitante: ' +
      requesterName +
      '\n' +
      '- Origem: ' +
      source +
      '\n' +
      '- Tipo: ' +
      type +
      '\n' +
      '- Prioridade: ' +
      priority +
      '\n' +
      '- Título: ' +
      title +
      '\n' +
      '- Descrição:\n"""\n' +
      description +
      '\n"""\n\n'

    // Ativos / CIs
    if (settings.include_asset) {
      const eqId = ticket.getString('equipment')
      const ciId = ticket.getString('configuration_item')
      let assetInfo = ''

      if (eqId) {
        try {
          const eq = e.app.findRecordById('equipments', eqId)
          if (eq) {
            assetInfo +=
              'Equipamento: ' +
              (eq.getString('name') || eq.getString('hostname') || '') +
              ' | Tipo: ' +
              (eq.getString('type') || '') +
              ' | SO: ' +
              (eq.getString('operating_system') || '') +
              ' | IP: ' +
              (eq.getString('ip_address') || '') +
              ' | Local: ' +
              (eq.getString('location') || '') +
              '\n'
          }
        } catch (_) {}
      }

      if (ciId) {
        try {
          const ci = e.app.findRecordById('configuration_items', ciId)
          if (ci) {
            assetInfo +=
              'Item de Configuração (CI): ' +
              ci.getString('name') +
              ' | Tipo: ' +
              ci.getString('type') +
              ' | Marca/Modelo: ' +
              ci.getString('brand') +
              ' ' +
              ci.getString('model') +
              '\n'
          }
        } catch (_) {}
      }

      if (assetInfo) {
        promptText += 'Dados do Ativo / Equipamento Vinculado:\n' + assetInfo + '\n'
      }
    }

    // Histórico de Interações recentes
    if (settings.include_history) {
      try {
        const interactions = e.app.findRecordsByFilter(
          'ticket_interactions',
          'ticket = "' + ticket.id + '"',
          '-created',
          6,
          0,
        )
        if (interactions.length > 0) {
          promptText += 'Histórico de Interações Recentes (mais recentes primeiro):\n'
          for (let i = interactions.length - 1; i >= 0; i--) {
            const inter = interactions[i]
            const interType = inter.getString('type') || 'Público'
            const interOrigin = inter.getString('origin') || 'Manual'
            const content = inter.getString('content') || ''
            const snippet = content.length > 300 ? content.substring(0, 300) + '...' : content
            promptText += '- [' + interType + ' | Origem: ' + interOrigin + ']: ' + snippet + '\n'
          }
          promptText += '\n'
        }
      } catch (_) {}
    }

    // Artigos de base de conhecimento relevantes
    if (settings.include_kb) {
      try {
        const categoryId = ticket.getString('category')
        let articles = []
        if (categoryId) {
          articles = e.app.findRecordsByFilter(
            'knowledge_articles',
            'category = "' + categoryId + '"',
            '-views',
            3,
            0,
          )
        }
        if (articles.length === 0) {
          articles = e.app.findRecordsByFilter('knowledge_articles', 'id != ""', '-views', 3, 0)
        }

        if (articles.length > 0) {
          promptText += 'Procedimentos de Referência da Base de Conhecimento:\n'
          for (let j = 0; j < articles.length; j++) {
            const art = articles[j]
            const artTitle = art.getString('title')
            const artSummary = art.getString('summary') || ''
            promptText +=
              '* ' + artTitle + ': ' + (artSummary || 'Artigo técnico disponível') + '\n'
          }
          promptText += '\n'
        }
      } catch (_) {}
    }

    if (settings.system_instructions) {
      promptText +=
        'Instruções Adicionais da Organização:\n' + settings.system_instructions + '\n\n'
    }

    if (customPrompt) {
      promptText += 'Solicitação do Operador:\n' + customPrompt + '\n\n'
    }

    promptText +=
      'Por favor, elabore uma resposta completa, atenciosa e resolutiva direcionada ao solicitante ' +
      requesterName +
      '. A resposta deve ter introdução cordial, diagnóstico claro com passos práticos numerados (se aplicável), e orientações de próximos passos. Não inclua placeholders como "[Seu Nome]", assine como "Equipe de Suporte e Atendimento".'

    // Invocar o agente nativo do Skip Cloud com fallback robusto
    let replyText = ''
    let agentInvoked = false

    try {
      const agent = $ai.agent('ticket-responder-agent')
      if (agent && typeof agent.chat === 'function') {
        const agentResponse = agent.chat({ message: promptText })
        replyText =
          typeof agentResponse === 'string'
            ? agentResponse
            : (agentResponse &&
                (agentResponse.content ||
                  agentResponse.reply ||
                  agentResponse.text ||
                  agentResponse.message)) ||
              ''
        agentInvoked = Boolean(replyText && replyText.trim().length > 0)
      } else if (agent && typeof agent.send === 'function') {
        const agentResponse = agent.send(promptText)
        replyText =
          typeof agentResponse === 'string'
            ? agentResponse
            : (agentResponse &&
                (agentResponse.content ||
                  agentResponse.reply ||
                  agentResponse.text ||
                  agentResponse.message)) ||
              ''
        agentInvoked = Boolean(replyText && replyText.trim().length > 0)
      }
    } catch (agentErr) {
      console.warn(
        '[AI_TICKET] Falha na chamada de agent.chat/send, acionando fallback $ai.chat:',
        agentErr.message || agentErr,
      )
    }

    if (!agentInvoked) {
      try {
        const fallbackRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o Agente de IA do Lógos AITSM especialista em atendimento e suporte técnico ITIL. Elabore respostas cordiais, resolutivas, com diagnóstico claro e passos práticos numerados. Assine sempre como "Equipe de Suporte e Atendimento".',
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
        })
        replyText =
          typeof fallbackRes === 'string'
            ? fallbackRes
            : (fallbackRes && (fallbackRes.content || fallbackRes.reply || fallbackRes.text)) || ''
      } catch (fallbackErr) {
        console.error(
          '[AI_TICKET] Fallback $ai.chat também falhou:',
          fallbackErr.message || fallbackErr,
        )
      }
    }

    return e.json(200, {
      ticketId: ticket.id,
      ticketNumber: ticket.getString('number') || ticket.id,
      draft: replyText,
      mode: settings.mode,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AI_TICKET] Erro ao gerar rascunho de resposta:', err)
    return e.json(500, {
      error: 'Erro ao gerar resposta com o agente de IA: ' + (err.message || String(err)),
    })
  }
})

// ROTA: POST /backend/v1/ai/ticket-tags
routerAdd('POST', '/backend/v1/ai/ticket-tags', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const ticketId = body.ticketId || body.ticket_id
  if (!ticketId) {
    return e.json(400, { error: 'ticketId é obrigatório.' })
  }

  let ticket
  try {
    ticket = e.app.findRecordById('tickets', ticketId)
  } catch (err) {
    return e.json(404, { error: 'Chamado não encontrado.' })
  }

  // Buscar configurações de IA
  let settings = {
    enabled: true,
    tag_suggestions_enabled: true,
  }

  try {
    const settingsRecs = e.app.findRecordsByFilter(
      'ai_ticket_settings',
      'scope = "global"',
      '',
      1,
      0,
    )
    if (settingsRecs.length > 0) {
      const s = settingsRecs[0]
      settings.enabled = s.getBool('enabled')
      settings.tag_suggestions_enabled = s.getBool('tag_suggestions_enabled')
    }
  } catch (errSettings) {
    console.warn('[AI_TICKET] Erro ao ler ai_ticket_settings em ticket-tags:', errSettings)
  }

  if (!settings.enabled || !settings.tag_suggestions_enabled) {
    return e.json(400, {
      error: 'A funcionalidade de sugestão de tags por IA está desativada nas configurações.',
    })
  }

  try {
    const number = ticket.getString('number') || ticket.id
    const title = ticket.getString('title') || 'Sem título'
    const description = ticket.getString('description') || 'Sem descrição'
    const currentTags = ticket.getString('tags') || ''
    const type = ticket.getString('type') || 'Incidente'
    const priority = ticket.getString('priority') || 'Média'

    let categoryName = ''
    const catId = ticket.getString('category')
    if (catId) {
      try {
        const cat = e.app.findRecordById('tkt_categories', catId)
        if (cat) categoryName = cat.getString('name')
      } catch (_) {}
    }

    let assetName = ''
    const eqId = ticket.getString('equipment')
    const ciId = ticket.getString('configuration_item')
    if (eqId) {
      try {
        const eq = e.app.findRecordById('equipments', eqId)
        if (eq) assetName = eq.getString('name') || eq.getString('hostname') || ''
      } catch (_) {}
    }
    if (ciId && !assetName) {
      try {
        const ci = e.app.findRecordById('configuration_items', ciId)
        if (ci) assetName = ci.getString('name') || ''
      } catch (_) {}
    }

    let promptText =
      'Você é um assistente especialista em ITSM e Service Desk (ITIL 4).\n' +
      'Sua tarefa é analisar o chamado abaixo e sugerir entre 3 e 7 tags/palavras-chave curtas e altamente relevantes (em português, sem acento ou com acento padronizado, minúsculas ou capitalizadas, ex: "rede", "vpn", "impressora", "lentidao", "outlook", "windows", "acesso", "hardware", "wifi", "erp").\n\n' +
      'Contexto do Chamado:\n' +
      '- Número: ' +
      number +
      '\n' +
      '- Tipo: ' +
      type +
      '\n' +
      '- Prioridade: ' +
      priority +
      '\n' +
      (categoryName ? '- Categoria: ' + categoryName + '\n' : '') +
      (assetName ? '- Ativo Envolvido: ' + assetName + '\n' : '') +
      (currentTags ? '- Tags Atuais: ' + currentTags + '\n' : '') +
      '- Título: ' +
      title +
      '\n' +
      '- Descrição: ' +
      description +
      '\n\n' +
      'REQUISITO OBRIGATÓRIO DE SAÍDA:\n' +
      'Responda ESTRITAMENTE em formato JSON com o campo "tags": array de strings. Sem explicações ou markdown em volta. Exemplo:\n' +
      '{"tags": ["vpn", "conectividade", "rede-interna", "home-office"]}'

    const agent = $ai.agent('ticket-responder-agent')
    const agentResponse = agent.send(promptText)

    const rawReply =
      typeof agentResponse === 'string'
        ? agentResponse
        : agentResponse.reply || agentResponse.text || JSON.stringify(agentResponse)

    let tags = []

    // Tentar extrair JSON da resposta
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.tags)) {
          tags = parsed.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
        }
      }
    } catch (_) {}

    // Fallback: se não encontrou JSON, separar por vírgulas ou quebras de linha
    if (tags.length === 0) {
      const cleaned = rawReply
        .replace(/[\[\]"'{}]/g, '')
        .split(/[,\n•\-\*]/)
        .map((t) => t.trim().replace(/^tags:\s*/i, ''))
        .filter((t) => t.length > 1 && t.length < 30)

      tags = Array.from(new Set(cleaned)).slice(0, 8)
    }

    // Normalizar tags (minúsculas, trim, sem duplicatas)
    const normalizedTags = Array.from(
      new Set(tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 1 && t !== 'tags')),
    ).slice(0, 8)

    return e.json(200, {
      ticketId: ticket.id,
      ticketNumber: ticket.getString('number') || ticket.id,
      currentTags: currentTags
        ? currentTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      suggestedTags: normalizedTags,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AI_TICKET] Erro ao sugerir tags para o chamado:', err)
    return e.json(500, {
      error: 'Erro ao gerar tags com o agente de IA: ' + (err.message || String(err)),
    })
  }
})

// ROTA: GET /backend/v1/ai/ticket-settings
routerAdd('GET', '/backend/v1/ai/ticket-settings', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }

  let settings = {
    id: '',
    scope: 'global',
    enabled: true,
    mode: 'both',
    auto_reply_internal: true,
    auto_reply_portal: true,
    include_kb: true,
    include_history: true,
    include_asset: true,
    system_instructions: 'Seja cordial, profissional e forneça passos técnicos objetivos e claros.',
    tag_suggestions_enabled: true,
  }

  try {
    const records = e.app.findRecordsByFilter('ai_ticket_settings', 'scope = "global"', '', 1, 0)
    if (records.length > 0) {
      const rec = records[0]
      settings.id = rec.id
      settings.scope = rec.getString('scope') || 'global'
      settings.enabled = rec.getBool('enabled')
      settings.mode = rec.getString('mode') || 'both'
      settings.auto_reply_internal = rec.getBool('auto_reply_internal')
      settings.auto_reply_portal = rec.getBool('auto_reply_portal')
      settings.include_kb = rec.getBool('include_kb')
      settings.include_history = rec.getBool('include_history')
      settings.include_asset = rec.getBool('include_asset')
      settings.system_instructions = rec.getString('system_instructions') || ''
      settings.tag_suggestions_enabled = rec.getBool('tag_suggestions_enabled')
    }
  } catch (err) {
    console.warn('[AI_TICKET] Erro ao buscar ai_ticket_settings:', err)
  }

  return e.json(200, settings)
})

// ROTA: POST /backend/v1/ai/ticket-settings
routerAdd('POST', '/backend/v1/ai/ticket-settings', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { error: 'Autenticação necessária.' })
  }

  const role = authRecord.getString('role')
  if (role !== 'admin' && role !== 'gestor') {
    return e.json(403, {
      error: 'Apenas Administradores e Gestores podem alterar as configurações de IA.',
    })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  try {
    let rec
    const records = e.app.findRecordsByFilter('ai_ticket_settings', 'scope = "global"', '', 1, 0)
    if (records.length > 0) {
      rec = records[0]
    } else {
      const col = e.app.findCollectionByNameOrId('ai_ticket_settings')
      rec = new Record(col)
      rec.set('scope', 'global')
    }

    if (body.enabled !== undefined) rec.set('enabled', !!body.enabled)
    if (body.mode) rec.set('mode', body.mode) // 'suggestion' | 'automatic' | 'both'
    if (body.auto_reply_internal !== undefined)
      rec.set('auto_reply_internal', !!body.auto_reply_internal)
    if (body.auto_reply_portal !== undefined) rec.set('auto_reply_portal', !!body.auto_reply_portal)
    if (body.include_kb !== undefined) rec.set('include_kb', !!body.include_kb)
    if (body.include_history !== undefined) rec.set('include_history', !!body.include_history)
    if (body.include_asset !== undefined) rec.set('include_asset', !!body.include_asset)
    if (body.system_instructions !== undefined)
      rec.set('system_instructions', String(body.system_instructions))
    if (body.tag_suggestions_enabled !== undefined)
      rec.set('tag_suggestions_enabled', !!body.tag_suggestions_enabled)

    e.app.save(rec)

    const updated = {
      id: rec.id,
      scope: rec.getString('scope') || 'global',
      enabled: rec.getBool('enabled'),
      mode: rec.getString('mode') || 'both',
      auto_reply_internal: rec.getBool('auto_reply_internal'),
      auto_reply_portal: rec.getBool('auto_reply_portal'),
      include_kb: rec.getBool('include_kb'),
      include_history: rec.getBool('include_history'),
      include_asset: rec.getBool('include_asset'),
      system_instructions: rec.getString('system_instructions') || '',
      tag_suggestions_enabled: rec.getBool('tag_suggestions_enabled'),
    }

    return e.json(200, {
      message: 'Configurações de IA salvas com sucesso.',
      settings: updated,
    })
  } catch (err) {
    console.error('[AI_TICKET] Erro ao salvar configurações de IA:', err)
    return e.json(500, {
      error: 'Falha ao salvar configurações de IA: ' + (err.message || String(err)),
    })
  }
})

// HOOK DE RESPOSTA AUTOMÁTICA EM CHAMADOS CRIADOS
onRecordAfterCreateSuccess((e) => {
  try {
    const ticket = e.record
    if (!ticket) return

    let settings = {
      enabled: true,
      mode: 'both',
      auto_reply_internal: true,
      auto_reply_portal: true,
      include_kb: true,
      include_history: true,
      include_asset: true,
      system_instructions: '',
      tag_suggestions_enabled: true,
    }

    try {
      const records = e.app.findRecordsByFilter('ai_ticket_settings', 'scope = "global"', '', 1, 0)
      if (records.length > 0) {
        const s = records[0]
        settings.enabled = s.getBool('enabled')
        settings.mode = s.getString('mode') || 'both'
        settings.auto_reply_internal = s.getBool('auto_reply_internal')
        settings.auto_reply_portal = s.getBool('auto_reply_portal')
        settings.include_kb = s.getBool('include_kb')
        settings.include_history = s.getBool('include_history')
        settings.include_asset = s.getBool('include_asset')
        settings.system_instructions = s.getString('system_instructions') || ''
        settings.tag_suggestions_enabled = s.getBool('tag_suggestions_enabled')
      }
    } catch (_) {}

    if (!settings.enabled) return

    // Resposta automática ativa apenas nos modos 'automatic' ou 'both'
    if (settings.mode !== 'automatic' && settings.mode !== 'both') return

    const source = (ticket.getString('source') || '').toLowerCase()
    const isPortal = source === 'portal'

    if (isPortal && !settings.auto_reply_portal) return
    if (!isPortal && !settings.auto_reply_internal) return

    // Evitar duplicidade se já houver interações
    const existingInteractions = e.app.findRecordsByFilter(
      'ticket_interactions',
      'ticket = "' + ticket.id + '"',
      '',
      1,
      0,
    )
    if (existingInteractions.length > 0) return

    console.log('[AI_TICKET] Gerando resposta automática para o chamado:', ticket.id)

    const number = ticket.getString('number') || ticket.id
    const title = ticket.getString('title') || 'Sem título'
    const description = ticket.getString('description') || 'Sem descrição'
    const requesterName = ticket.getString('requester_name') || 'Solicitante'
    const priority = ticket.getString('priority') || 'Média'
    const type = ticket.getString('type') || 'Incidente'

    let promptText =
      'Contexto do Chamado (Recém-aberto):\n' +
      '- Número: ' +
      number +
      '\n' +
      '- Solicitante: ' +
      requesterName +
      '\n' +
      '- Origem: ' +
      (ticket.getString('source') || 'Portal') +
      '\n' +
      '- Tipo: ' +
      type +
      '\n' +
      '- Prioridade: ' +
      priority +
      '\n' +
      '- Título: ' +
      title +
      '\n' +
      '- Descrição:\n"""\n' +
      description +
      '\n"""\n\n'

    if (settings.include_asset) {
      const eqId = ticket.getString('equipment')
      const ciId = ticket.getString('configuration_item')
      let assetInfo = ''
      if (eqId) {
        try {
          const eq = e.app.findRecordById('equipments', eqId)
          if (eq) {
            assetInfo +=
              'Equipamento: ' + (eq.getString('name') || eq.getString('hostname') || '') + '\n'
          }
        } catch (_) {}
      }
      if (ciId) {
        try {
          const ci = e.app.findRecordById('configuration_items', ciId)
          if (ci) {
            assetInfo += 'Item de Configuração (CI): ' + ci.getString('name') + '\n'
          }
        } catch (_) {}
      }
      if (assetInfo) promptText += 'Ativo:\n' + assetInfo + '\n'
    }

    if (settings.include_kb) {
      try {
        const categoryId = ticket.getString('category')
        let articles = []
        if (categoryId) {
          articles = e.app.findRecordsByFilter(
            'knowledge_articles',
            'category = "' + categoryId + '"',
            '-views',
            3,
            0,
          )
        }
        if (articles.length === 0) {
          articles = e.app.findRecordsByFilter('knowledge_articles', 'id != ""', '-views', 3, 0)
        }
        if (articles.length > 0) {
          promptText += 'Base de Conhecimento Relevante:\n'
          for (let j = 0; j < articles.length; j++) {
            promptText += '* ' + articles[j].getString('title') + '\n'
          }
          promptText += '\n'
        }
      } catch (_) {}
    }

    if (settings.system_instructions) {
      promptText += 'Instruções Organizacionais:\n' + settings.system_instructions + '\n\n'
    }

    promptText +=
      'Redija uma primeira resposta oficial de acolhimento e diagnóstico inicial resolutivo, cumprimentando ' +
      requesterName +
      ' e fornecendo orientações práticas preliminares ou próximos passos. Assine como "Equipe de Suporte e Atendimento".'

    let replyText = ''
    let agentInvoked = false

    try {
      const agent = $ai.agent('ticket-responder-agent')
      if (agent && typeof agent.chat === 'function') {
        const agentResponse = agent.chat({ message: promptText })
        replyText =
          typeof agentResponse === 'string'
            ? agentResponse
            : (agentResponse &&
                (agentResponse.content ||
                  agentResponse.reply ||
                  agentResponse.text ||
                  agentResponse.message)) ||
              ''
        agentInvoked = Boolean(replyText && replyText.trim().length > 0)
      } else if (agent && typeof agent.send === 'function') {
        const agentResponse = agent.send(promptText)
        replyText =
          typeof agentResponse === 'string'
            ? agentResponse
            : (agentResponse &&
                (agentResponse.content ||
                  agentResponse.reply ||
                  agentResponse.text ||
                  agentResponse.message)) ||
              ''
        agentInvoked = Boolean(replyText && replyText.trim().length > 0)
      }
    } catch (agentErr) {
      console.warn(
        '[AI_TICKET] Falha na chamada de agent.chat/send em onRecordAfterCreateSuccess, acionando fallback $ai.chat:',
        agentErr.message || agentErr,
      )
    }

    if (!agentInvoked) {
      try {
        const fallbackRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o Agente de IA do Lógos AITSM especialista em atendimento e suporte técnico ITIL. Elabore respostas cordiais, resolutivas, com diagnóstico claro e passos práticos numerados. Assine sempre como "Equipe de Suporte e Atendimento".',
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
        })
        replyText =
          typeof fallbackRes === 'string'
            ? fallbackRes
            : (fallbackRes && (fallbackRes.content || fallbackRes.reply || fallbackRes.text)) || ''
      } catch (fallbackErr) {
        console.error(
          '[AI_TICKET] Fallback $ai.chat em onRecordAfterCreateSuccess também falhou:',
          fallbackErr.message || fallbackErr,
        )
      }
    }

    if (!replyText || replyText.trim().length === 0) return

    // Criar interação pública no chamado
    // IMPORTANTE:
    // - origin = 'Automático' (não debita franquia do cliente!)
    // - duration_minutes = 0
    // - hour_type = 'Não Faturável'
    // - billing_status = 'Não Faturável'
    const interCol = e.app.findCollectionByNameOrId('ticket_interactions')
    const newInter = new Record(interCol)
    newInter.set('ticket', ticket.id)

    const assignedTo = ticket.getString('assigned_to')
    if (assignedTo) {
      newInter.set('author', assignedTo)
    }

    newInter.set('type', 'Público')
    newInter.set('origin', 'Automático')
    newInter.set('duration_minutes', 0)
    newInter.set('hour_type', 'Não Faturável')
    newInter.set('billing_status', 'Não Faturável')

    const formattedContent = '🤖 **[Resposta Automática por IA]**\n\n' + replyText

    newInter.set('content', formattedContent)
    e.app.save(newInter)

    console.log('[AI_TICKET] Resposta automática salva com sucesso para o chamado:', ticket.id)
  } catch (err) {
    console.warn('[AI_TICKET] Erro ao executar resposta automática de IA:', err)
  } finally {
    e.next()
  }
}, 'tickets')
