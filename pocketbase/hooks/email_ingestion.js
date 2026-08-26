// Hook de Ingestão de E-mails via HTTP Webhook / Simulação de Ingestão
// Endpoint: POST /backend/v1/emails/ingest
routerAdd('POST', '/backend/v1/emails/ingest', (e) => {
  try {
    var body = e.requestInfo().body || {}
    var from = (body.from || body.from_email || '').trim()
    var fromName = (body.from_name || body.name || '').trim()
    var subject = (body.subject || body.title || '').trim()
    var emailBody = (body.body || body.description || body.text || '').trim()
    var token = (body.token || '').trim()

    // Se enviado token, valida contra email_config ou autorização
    var authUser = e.auth
    var isAuth = !!authUser

    var configs = []
    try {
      configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
    } catch (_) {}

    var config = configs.length > 0 ? configs[0] : null

    if (!isAuth) {
      var expectedToken = config ? config.getString('webhook_token') : ''
      if (!expectedToken || token !== expectedToken) {
        return e.json(401, { error: 'Token de webhook inválido ou não autenticado.' })
      }
    }

    if (!from || !subject) {
      return e.badRequestError('Campos "from" (remetente) e "subject" (assunto) são obrigatórios.')
    }

    // Limpar HTML básico do corpo caso venha com tags
    var cleanBody = emailBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanBody) {
      cleanBody = subject
    }

    // 1. Extrair domínio do remetente
    var domain = ''
    var atIndex = from.lastIndexOf('@')
    if (atIndex !== -1) {
      domain = from.substring(atIndex).toLowerCase().trim() // ex: @empresa.com.br
    }

    // 2. Verificar domínio contra client_email_domains
    var domainAllowed = false
    var matchedCompanyId = ''

    if (domain) {
      // Remover o '@' se pesquisar variantes
      var plainDomain = domain.startsWith('@') ? domain.substring(1) : domain
      var domainWithAt = '@' + plainDomain

      try {
        var activeDomains = $app.findRecordsByFilter(
          'client_email_domains',
          'active = true',
          '',
          500,
          0,
        )
        for (var i = 0; i < activeDomains.length; i++) {
          var d = (activeDomains[i].getString('domain') || '').toLowerCase().trim()
          if (d === domainWithAt || d === plainDomain || d === domain) {
            domainAllowed = true
            matchedCompanyId = activeDomains[i].getString('client')
            break
          }
        }
      } catch (_) {}
    }

    // 3. Se domínio NÃO estiver em nenhuma lista de domínios permitidos:
    if (!domainAllowed) {
      // Salvar em retained_tickets
      var retainedCol = $app.findCollectionByNameOrId('retained_tickets')
      var retained = new Record(retainedCol)
      retained.set('from_email', from)
      retained.set('from_name', fromName)
      retained.set('subject', subject)
      retained.set('body', cleanBody)
      retained.set('domain', domain)
      retained.set(
        'reason',
        'Domínio de e-mail não autorizado (' + (domain || 'desconhecido') + ')',
      )
      retained.set('status', 'Pendente')
      $app.save(retained)

      // Registrar também tentativa bloqueada para auditoria histórica
      try {
        var blockedAttemptsCol = $app.findCollectionByNameOrId('blocked_attempts')
        var bAttempt = new Record(blockedAttemptsCol)
        bAttempt.set('requester_email', from)
        bAttempt.set('channel', 'Email')
        bAttempt.set('blocked', true)
        bAttempt.set('notes', 'Chamado retido para revisão por domínio não autorizado: ' + domain)
        $app.save(bAttempt)
      } catch (_) {}

      return e.json(200, {
        status: 'retained',
        message: 'E-mail recebido e retido para moderação (domínio não autorizado).',
        retained_id: retained.id,
      })
    }

    // 4. Domínio PERMITIDO: Cruzar remetente com a coleção `users`
    var userId = ''
    var userCompanyId = matchedCompanyId
    var userUnitId = ''
    var userDeptId = ''
    var requesterName = fromName || from.split('@')[0]
    var requesterPhone = ''
    var contractId = ''

    try {
      var userRecords = $app.findRecordsByFilter(
        '_pb_users_auth_',
        'email = "' + from.toLowerCase() + '"',
        '',
        1,
        0,
      )
      if (userRecords.length > 0) {
        var matchedUser = userRecords[0]
        userId = matchedUser.id
        requesterName = matchedUser.getString('name') || requesterName
        requesterPhone = matchedUser.getString('phone') || matchedUser.getString('mobile') || ''
        if (matchedUser.getString('company')) {
          userCompanyId = matchedUser.getString('company')
        }
        userUnitId = matchedUser.getString('unit') || ''
      }
    } catch (_) {}

    // Se não achou em users, tentar buscar em client_contacts
    if (!userId && userCompanyId) {
      try {
        var contactRecords = $app.findRecordsByFilter(
          'client_contacts',
          'email = "' + from.toLowerCase() + '"',
          '',
          1,
          0,
        )
        if (contactRecords.length > 0) {
          var contact = contactRecords[0]
          requesterName = contact.getString('full_name') || requesterName
          requesterPhone =
            contact.getString('phone') || contact.getString('cell_phone') || requesterPhone
          userUnitId = contact.getString('unit') || userUnitId
        }
      } catch (_) {}
    }

    // Buscar contrato ativo da empresa
    if (userCompanyId) {
      try {
        var contractRecords = $app.findRecordsByFilter(
          'contracts',
          'company = "' + userCompanyId + '" && status = "Ativo"',
          '-created',
          1,
          0,
        )
        if (contractRecords.length > 0) {
          contractId = contractRecords[0].id
        }
      } catch (_) {}
    }

    // 5. Criar Ticket
    var ticketsCol = $app.findCollectionByNameOrId('tickets')
    var ticket = new Record(ticketsCol)
    ticket.set('title', subject)
    ticket.set('description', cleanBody)
    ticket.set('source', 'E-mail')
    ticket.set('status', 'Novo')
    ticket.set('type', 'Incidente')
    ticket.set('priority', 'Média')
    ticket.set('impact', 'Médio')
    ticket.set('urgency', 'Média')
    ticket.set('requester_name', requesterName)
    ticket.set('requester_email', from)
    if (requesterPhone) ticket.set('requester_phone', requesterPhone)
    if (userCompanyId) ticket.set('company', userCompanyId)
    if (userUnitId) ticket.set('unit', userUnitId)
    if (userDeptId) ticket.set('department', userDeptId)
    if (contractId) ticket.set('contract', contractId)

    $app.save(ticket)

    // 6. Triage Automática (se houver categorias ou AI)
    // Executará também via trigger/lógica inline para salvar triage_suggestions
    var triageSuggestion = null
    try {
      var categories = $app.findRecordsByFilter('tkt_categories', 'active = true', 'name', 100, 0)
      var fullText = (subject + ' ' + cleanBody).toLowerCase()

      var bestCategory = null
      var bestScore = 0
      var suggestedType = 'Incidente'

      // Classificação heurística de tipo
      if (/dúvida|duvida|como fa|pergunta|esclarecer|orienta/i.test(fullText)) {
        suggestedType = 'Dúvida'
      } else if (
        /solicito|solicita|acesso|novo|criar|instalar|liberar|comprar|troca/i.test(fullText)
      ) {
        suggestedType = 'Requisição de Serviço'
      } else if (
        /problema recorrente|falha geral|indisponibilidade sistêmica|raiz/i.test(fullText)
      ) {
        suggestedType = 'Problema'
      }

      for (var c = 0; c < categories.length; c++) {
        var cat = categories[c]
        var catName = (cat.getString('name') || '').toLowerCase()
        var catDesc = (cat.getString('description') || '').toLowerCase()
        var score = 0

        var words = catName.split(/[\s,/-]+/)
        for (var w = 0; w < words.length; w++) {
          var word = words[w].trim()
          if (word.length >= 3 && fullText.indexOf(word) !== -1) {
            score += 2
          }
        }
        if (catDesc && fullText.indexOf(catDesc) !== -1) {
          score += 3
        }

        if (score > bestScore) {
          bestScore = score
          bestCategory = cat
        }
      }

      // Se Skip AI estiver disponível, tentar aprimorar a sugestão
      var aiEnhanced = false
      try {
        var catListStr = categories
          .map(function (c) {
            return (
              c.id +
              ': ' +
              c.getString('name') +
              (c.getString('parent') ? ' (Subcategoria)' : ' (Categoria)')
            )
          })
          .join('\n')

        var reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente ITSM de triagem de chamados. Classifique o chamado retornando APENAS um JSON no formato: {"type": "Incidente|Requisição de Serviço|Problema|Dúvida", "category_id": "ID_DA_CATEGORIA_OU_VAZIO", "service_name": "Nome da atividade ou vazio", "confidence": 0.85, "reason": "Breve justificativa em português"}',
            },
            {
              role: 'user',
              content:
                'Título: ' +
                subject +
                '\nDescrição: ' +
                cleanBody +
                '\n\nCatálogo disponível:\n' +
                catListStr,
            },
          ],
        })

        var aiContent = reply.choices[0].message.content
        var matchJson = aiContent.match(/\{[\s\S]*\}/)
        if (matchJson) {
          var parsed = JSON.parse(matchJson[0])
          triageSuggestion = {
            type: parsed.type || suggestedType,
            category: parsed.category_id || (bestCategory ? bestCategory.id : ''),
            category_name: bestCategory ? bestCategory.getString('name') : '',
            service: parsed.service_name || '',
            confidence: parsed.confidence || 0.85,
            reason: parsed.reason || 'Sugerido por IA com base no catálogo de serviços.',
            source: 'ai_fast',
          }
          aiEnhanced = true
        }
      } catch (_) {}

      if (!aiEnhanced && bestCategory) {
        triageSuggestion = {
          type: suggestedType,
          category: bestCategory.id,
          category_name: bestCategory.getString('name'),
          service: bestCategory.getString('name'),
          confidence: Math.min(0.9, 0.5 + bestScore * 0.1),
          reason: 'Sugerido com base na correspondência de palavras-chave do catálogo.',
          source: 'keyword_match',
        }
      }

      if (triageSuggestion) {
        ticket.set('triage_suggestions', triageSuggestion)
        $app.save(ticket)
      }
    } catch (err) {
      $app.logger().error('email_ingestion: triage suggestion error', 'error', err.message)
    }

    return e.json(200, {
      status: 'created',
      message: 'Chamado criado com sucesso a partir do e-mail!',
      ticket_id: ticket.id,
      ticket_number: ticket.getString('number'),
      triage_suggestions: triageSuggestion,
    })
  } catch (err) {
    $app.logger().error('email_ingestion error', 'error', err.message)
    return e.json(500, { error: err.message || 'Erro no processamento do e-mail' })
  }
})
