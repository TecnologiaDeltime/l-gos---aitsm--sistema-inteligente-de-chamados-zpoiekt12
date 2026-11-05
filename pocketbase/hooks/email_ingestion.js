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
    var attachments = Array.isArray(body.attachments) ? body.attachments : []

    // Helper inline para decodificar base64 em Uint8Array
    var base64ToUint8 = function (base64Str) {
      if (!base64Str) return null
      // Remove possível cabeçalho data:...;base64,
      var clean = base64Str.replace(/^data:[^;]+;base64,/, '').replace(/[\s\r\n]+/g, '')
      clean = clean.replace(/=/g, '')
      while (clean.length % 4 !== 0) {
        clean += 'A'
      }
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var len = (clean.length * 3) / 4
      var byteArray = new Uint8Array(len)
      var byteIdx = 0
      var charIdx = 0

      while (charIdx < clean.length) {
        var enc1 = chars.indexOf(clean.charAt(charIdx++))
        var enc2 = chars.indexOf(clean.charAt(charIdx++))
        var enc3 = chars.indexOf(clean.charAt(charIdx++))
        var enc4 = chars.indexOf(clean.charAt(charIdx++))
        if (enc1 === -1 || enc2 === -1 || enc3 === -1 || enc4 === -1) {
          break
        }
        var bits24 = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4
        var b1 = (bits24 >> 16) & 0xff
        var b2 = (bits24 >> 8) & 0xff
        var b3 = bits24 & 0xff
        byteArray[byteIdx++] = b1
        if (enc3 !== 64) {
          byteArray[byteIdx++] = b2
          if (enc4 !== 64) {
            byteArray[byteIdx++] = b3
          }
        }
      }
      return byteArray.subarray(0, byteIdx)
    }

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

    // Limpar HTML do corpo caso venha com tags — preservando a formatação:
    // quebras estruturais (<br>, </p>, </div>, </li>...) viram quebras de linha
    // reais e \n NÃO é colapsado (apenas espaços/tabs redundantes), para que a
    // descrição do chamado e o corpo das interações cheguem com parágrafos.
    var cleanBody = emailBody
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h[1-6]|blockquote|pre|table|ul|ol)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
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
          if (contact.getString('user')) {
            userId = contact.getString('user')
          }
        }
      } catch (_) {}
    }

    // Se ainda não temos um userId válido, obter o ID do admin padrão do sistema para uploaded_by
    var defaultAdminId = userId
    if (!defaultAdminId) {
      try {
        var adminRecord = $app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
        defaultAdminId = adminRecord.id
      } catch (_) {
        try {
          var anyAdmins = $app.findRecordsByFilter(
            '_pb_users_auth_',
            'role = "admin" || role = "gestor"',
            '',
            1,
            0,
          )
          if (anyAdmins.length > 0) {
            defaultAdminId = anyAdmins[0].id
          }
        } catch (_) {}
      }
    }
    var uploadedByUserId = userId || defaultAdminId

    // Helper interno para salvar anexos do e-mail vinculados a ticket e opcionalmente a interaction
    var saveEmailAttachments = function (ticketRecordId, interactionRecordId) {
      var savedCount = 0
      if (!attachments || attachments.length === 0) return savedCount

      var attachCol = $app.findCollectionByNameOrId('ticket_attachments')
      for (var a = 0; a < attachments.length; a++) {
        var att = attachments[a]
        if (!att) continue
        var filename = (att.filename || att.name || 'anexo_' + (a + 1) + '.bin').trim()
        var contentType = att.content_type || att.type || 'application/octet-stream'
        var dataBase64 = att.data_base64 || att.base64 || att.data || ''
        var fileUrl = att.url || ''

        try {
          var attachRec = new Record(attachCol)
          attachRec.set('ticket', ticketRecordId)
          if (interactionRecordId) {
            attachRec.set('interaction', interactionRecordId)
          }
          attachRec.set('file_name', filename)
          attachRec.set('file_type', contentType)
          attachRec.set('uploaded_by', uploadedByUserId)

          var fileObj = null
          if (dataBase64) {
            var byteData = base64ToUint8(dataBase64)
            if (byteData && byteData.length > 0) {
              fileObj = $filesystem.fileFromBytes(byteData, filename)
              attachRec.set('file_size', byteData.length)
            }
          } else if (fileUrl) {
            try {
              fileObj = $filesystem.fileFromURL(fileUrl)
            } catch (_) {}
            if (att.size || att.file_size) {
              attachRec.set('file_size', att.size || att.file_size)
            }
          }

          if (fileObj) {
            attachRec.set('file', fileObj)
          }

          $app.save(attachRec)
          savedCount++
        } catch (attErr) {
          $app
            .logger()
            .error(
              'email_ingestion: save attachment error',
              'file',
              filename,
              'err',
              attErr.message,
            )
        }
      }
      return savedCount
    }

    // -------------------------------------------------------------
    // DETECÇÃO DE RESPOSTA (REPLY DETECTION)
    // -------------------------------------------------------------
    var isReply = false
    var extractedTicketNumber = ''

    // Padrão de reply no assunto: Re:, RES:, Fwd:, ENC:, R:
    var replyPrefixRegex = /^\s*(re|res|fwd|fw|enc|r)\s*:\s*/i
    var hasReplyPrefix = replyPrefixRegex.test(subject)

    // Extração do número do ticket do assunto
    // Regex principal: # followed by 1 to 6 digits, or Ticket #NNNN or #[NNNN]
    var matchNum = subject.match(/(?:ticket\s*#?|#)\s*\[?(\d{1,6})\]?/i)
    if (matchNum && matchNum[1]) {
      extractedTicketNumber = matchNum[1]
    }

    // Se temos padrão de reply ou menção explícita de Ticket #NNNN / #NNNN
    if (extractedTicketNumber && (hasReplyPrefix || /ticket\s*#?\s*\d+/i.test(subject))) {
      // Tentar localizar o ticket pelo número
      var existingTickets = []
      try {
        existingTickets = $app.findRecordsByFilter(
          'tickets',
          'number = "' +
            extractedTicketNumber +
            '" || number = "#' +
            extractedTicketNumber +
            '" || id = "' +
            extractedTicketNumber +
            '"',
          '-created',
          1,
          0,
        )
      } catch (_) {}

      if (existingTickets.length > 0) {
        var existingTicket = existingTickets[0]
        isReply = true

        var currentStatus = existingTicket.getString('status')
        var isClosed =
          currentStatus === 'Fechado' ||
          currentStatus === 'Resolvido' ||
          currentStatus === 'Cancelado' ||
          currentStatus === 'Encerrado'

        // Se o ticket estava fechado/resolvido/cancelado, reabre (prática recomendada ITSM)
        if (isClosed) {
          existingTicket.set('status', 'Reaberto')
          var currentReopen = existingTicket.getInt('reopen_count') || 0
          existingTicket.set('reopen_count', currentReopen + 1)
          $app.save(existingTicket)

          // Registrar no histórico a reabertura via resposta de e-mail
          try {
            var historyCol = $app.findCollectionByNameOrId('ticket_history')
            var hist = new Record(historyCol)
            hist.set('ticket', existingTicket.id)
            hist.set('user', uploadedByUserId)
            hist.set('action', 'Reabertura via E-mail')
            hist.set('field', 'status')
            hist.set('old_value', currentStatus)
            hist.set('new_value', 'Reaberto')
            $app.save(hist)
          } catch (_) {}
        }

        // Determinar tipo da interação: se remetente for o solicitante do ticket => "Público", senão => "Interno" ou "Público"
        var ticketRequesterEmail = (existingTicket.getString('requester_email') || '').toLowerCase()
        var interactionType =
          from.toLowerCase() === ticketRequesterEmail ||
          from.toLowerCase().indexOf(ticketRequesterEmail) !== -1
            ? 'Público'
            : 'Público'

        // Criar registro na coleção ticket_interactions
        var interactionsCol = $app.findCollectionByNameOrId('ticket_interactions')
        var interaction = new Record(interactionsCol)
        interaction.set('ticket', existingTicket.id)
        interaction.set('author', uploadedByUserId)
        interaction.set('type', interactionType)
        interaction.set('content', cleanBody)
        interaction.set('origin', 'Automático')
        interaction.set('billing_status', 'Não Faturável')
        $app.save(interaction)

        // Salvar anexos do reply se houver
        var savedAttachs = saveEmailAttachments(existingTicket.id, interaction.id)

        // Notificar o operador responsável pelo chamado
        var assignedToId = existingTicket.getString('assigned_to')
        if (assignedToId && assignedToId !== uploadedByUserId) {
          try {
            var notifsCol = $app.findCollectionByNameOrId('notifications')
            var notif = new Record(notifsCol)
            notif.set('user', assignedToId)
            notif.set('ticket', existingTicket.id)
            notif.set('title', 'Nova resposta no Chamado #' + existingTicket.getString('number'))
            notif.set(
              'message',
              requesterName +
                ' respondeu por e-mail: ' +
                cleanBody.substring(0, 120) +
                (cleanBody.length > 120 ? '...' : ''),
            )
            notif.set('type', 'Interação')
            notif.set('read', false)
            $app.save(notif)
          } catch (_) {}
        }

        return e.json(200, {
          status: 'replied',
          message:
            'Resposta adicionada como interação ao chamado #' +
            existingTicket.getString('number') +
            (isClosed ? ' (Chamado reaberto)' : ''),
          ticket_id: existingTicket.id,
          ticket_number: existingTicket.getString('number'),
          interaction_id: interaction.id,
          reopened: isClosed,
          attachments_count: savedAttachs,
        })
      }
    }

    // -------------------------------------------------------------
    // NOVO TICKET (FLUXO PADRÃO)
    // -------------------------------------------------------------
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

    // Criar Ticket
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

    // Processar e salvar anexos do novo ticket
    var ticketAttachmentsCount = saveEmailAttachments(ticket.id, null)

    // Triage Automática (se houver categorias ou AI)
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
      attachments_count: ticketAttachmentsCount,
      triage_suggestions: triageSuggestion,
    })
  } catch (err) {
    $app.logger().error('email_ingestion error', 'error', err.message)
    return e.json(500, { error: err.message || 'Erro no processamento do e-mail' })
  }
})
