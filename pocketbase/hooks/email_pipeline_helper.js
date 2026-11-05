// Helper compartilhado para processamento de e-mail no backend ITSM
// Executa o pipeline completo:
// 1. Deduplicação por message_id / hash de remetente + assunto + data
// 2. Triagem por domínio em client_email_domains
// 3. Se domínio não liberado: retém em retained_tickets (status Pendente)
// 4. Se domínio liberado:
//    a) Se reply de chamado (#NNNN ou Ticket #NNNN): adiciona interação e reabre se fechado
//    b) Se novo chamado: cria Ticket com vínculo ao cliente, usuário/contato, SLA, fila e anexos
// 5. Registra o resultado em processed_emails para idempotência estrita

module.exports = {
  // Limpa texto simples de HTML preservando a formatação: quebras estruturais
  // (<br>, </p>, </div>, </li>...) viram quebras de linha reais e \n NÃO é
  // colapsado (apenas espaços/tabs redundantes), para que a descrição do
  // chamado e o corpo das interações cheguem com os parágrafos do e-mail.
  cleanText: function (text) {
    if (!text) return ''
    return String(text)
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
  },

  // Extrai domínio do e-mail em formato minúsculo (@dominio.com.br)
  extractDomain: function (email) {
    if (!email) return ''
    var atIndex = email.lastIndexOf('@')
    if (atIndex === -1) return ''
    return email.substring(atIndex).toLowerCase().trim()
  },

  // Helper inline para decodificar base64 em Uint8Array
  base64ToUint8: function (base64Str) {
    if (!base64Str) return null
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
  },

  // Verifica se o messageId ou o hash já foi processado
  isAlreadyProcessed: function (messageId, dedupeHash) {
    if (messageId) {
      try {
        var existing = $app.findRecordsByFilter(
          'processed_emails',
          'message_id = "' + messageId + '"',
          '',
          1,
          0,
        )
        if (existing && existing.length > 0) return true
      } catch (_) {}
    }
    if (dedupeHash) {
      try {
        var existingByHash = $app.findRecordsByFilter(
          'processed_emails',
          'dedupe_hash = "' + dedupeHash + '"',
          '',
          1,
          0,
        )
        if (existingByHash && existingByHash.length > 0) return true
      } catch (_) {}
    }
    return false
  },

  // Registra no banco o e-mail processado para evitar duplicidade futura
  recordProcessedEmail: function (data) {
    try {
      var col = $app.findCollectionByNameOrId('processed_emails')
      var rec = new Record(col)
      rec.set('message_id', data.messageId || 'MSG-' + $security.randomString(16))
      rec.set('dedupe_hash', data.dedupeHash || '')
      rec.set('from_email', data.fromEmail || '')
      rec.set('from_name', data.fromName || '')
      rec.set('subject', data.subject || '')
      rec.set('outcome', data.outcome || 'skipped')
      rec.set('ticket_id', data.ticketId || '')
      rec.set('ticket_number', data.ticketNumber || '')
      rec.set('retained_id', data.retainedId || '')
      rec.set('interaction_id', data.interactionId || '')
      rec.set('details', data.details || '')
      rec.set('processed_at', new Date().toISOString())
      $app.save(rec)
    } catch (err) {
      $app.logger().error('recordProcessedEmail error', 'error', err.message)
    }
  },

  // Executa o pipeline de ingestão para um único e-mail
  // Retorna { status: 'created'|'replied'|'retained'|'skipped', ticketId, ticketNumber, retainedId, interactionId, reason }
  processEmailMessage: function (msg) {
    var from = (msg.from || msg.from_email || '').trim()
    var fromName = (msg.from_name || msg.name || '').trim()
    var subject = (msg.subject || msg.title || '').trim()
    var bodyRaw = (msg.body || msg.description || msg.text || '').trim()
    var messageId = (msg.message_id || msg.messageId || msg.uid || '').trim()
    var attachments = Array.isArray(msg.attachments) ? msg.attachments : []

    if (!from || !subject) {
      return { status: 'skipped', reason: 'E-mail sem remetente ou assunto.' }
    }

    var cleanBody = this.cleanText(bodyRaw)
    if (!cleanBody) cleanBody = subject

    // Calcular hash de deduplicação
    var dedupeKey = [from.toLowerCase(), subject.toLowerCase(), cleanBody.substring(0, 150)].join(
      '|',
    )
    var dedupeHash = $security.md5(dedupeKey)
    if (!messageId) {
      messageId = 'HASH-' + dedupeHash
    }

    // Idempotência: verificar se já foi processado
    if (this.isAlreadyProcessed(messageId, dedupeHash)) {
      return {
        status: 'skipped',
        reason: 'E-mail já processado anteriormente (idempotência garantida).',
        messageId: messageId,
      }
    }

    // 1. Extrair domínio do remetente
    var domain = this.extractDomain(from)

    // 2. Verificar domínio em client_email_domains
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
      } catch (domErr) {
        $app.logger().error('processEmail: check domain error', 'error', domErr.message)
      }
    }

    // 3. Se domínio NÃO liberado em nenhum cliente => Enviar para "Chamados Retidos"
    if (!domainAllowed) {
      var retainedId = ''
      try {
        var retainedCol = $app.findCollectionByNameOrId('retained_tickets')
        var retained = new Record(retainedCol)
        retained.set('from_email', from)
        retained.set('from_name', fromName)
        retained.set('subject', subject)
        retained.set('body', cleanBody)
        if (msg.raw_html || msg.html) {
          retained.set('email_html', msg.raw_html || msg.html)
        }
        retained.set('domain', domain)
        retained.set(
          'reason',
          'Domínio de e-mail não autorizado (' + (domain || 'desconhecido') + ')',
        )
        retained.set('status', 'Pendente')
        retained.set('retention_notified', false) // Flag para o agente de 5 minutos notificar
        $app.save(retained)
        retainedId = retained.id

        // Registrar tentativa bloqueada para auditoria
        try {
          var blockedCol = $app.findCollectionByNameOrId('blocked_attempts')
          var bAttempt = new Record(blockedCol)
          bAttempt.set('requester_email', from)
          bAttempt.set('channel', 'Email')
          bAttempt.set('blocked', true)
          bAttempt.set(
            'notes',
            'Chamado retido para moderação por domínio não cadastrado: ' + domain,
          )
          $app.save(bAttempt)
        } catch (_) {}

        // Registrar em processed_emails para não reprocessar
        this.recordProcessedEmail({
          messageId: messageId,
          dedupeHash: dedupeHash,
          fromEmail: from,
          fromName: fromName,
          subject: subject,
          outcome: 'ticket_retained',
          retainedId: retainedId,
          details: 'Retido em moderação: domínio ' + (domain || 'desconhecido') + ' não liberado.',
        })

        return {
          status: 'retained',
          retained_id: retainedId,
          message:
            'E-mail retido para moderação em /tickets/retained (domínio não liberado no cliente).',
          domain: domain,
        }
      } catch (retErr) {
        $app.logger().error('processEmail: save retained error', 'error', retErr.message)
        return {
          status: 'skipped',
          reason: 'Falha ao reter chamado: ' + retErr.message,
        }
      }
    }

    // 4. Domínio PERMITIDO: identificar solicitante
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

    // Cruzar com contatos de clientes se não encontrou em users
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

    // Uploaded by padrão (admin de inovação ou primeiro admin)
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
          if (anyAdmins.length > 0) defaultAdminId = anyAdmins[0].id
        } catch (_) {}
      }
    }
    var uploadedByUserId = userId || defaultAdminId

    var self = this
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
        var contentId = (att.content_id || att.contentId || '').replace(/[<>]/g, '').trim()

        try {
          var attachRec = new Record(attachCol)
          attachRec.set('ticket', ticketRecordId)
          if (interactionRecordId) {
            attachRec.set('interaction', interactionRecordId)
          }
          if (contentId) {
            attachRec.set('content_id', contentId)
          }
          attachRec.set('file_name', filename)
          attachRec.set('file_type', contentType)
          attachRec.set('uploaded_by', uploadedByUserId)

          var fileObj = null
          if (dataBase64) {
            var byteData = self.base64ToUint8(dataBase64)
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
            .error('saveEmailAttachments: error', 'file', filename, 'err', attErr.message)
        }
      }
      return savedCount
    }

    // -------------------------------------------------------------
    // DETECÇÃO DE RESPOSTA (REPLY DETECTION)
    // -------------------------------------------------------------
    var isReply = false
    var extractedTicketNumber = ''
    var replyPrefixRegex = /^\s*(re|res|fwd|fw|enc|r)\s*:\s*/i
    var hasReplyPrefix = replyPrefixRegex.test(subject)

    var matchNum = subject.match(/(?:ticket\s*#?|#)\s*\[?(\d{1,6})\]?/i)
    if (matchNum && matchNum[1]) {
      extractedTicketNumber = matchNum[1]
    }

    if (extractedTicketNumber && (hasReplyPrefix || /ticket\s*#?\s*\d+/i.test(subject))) {
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

        if (isClosed) {
          existingTicket.set('status', 'Reaberto')
          var currentReopen = existingTicket.getInt('reopen_count') || 0
          existingTicket.set('reopen_count', currentReopen + 1)
          $app.save(existingTicket)

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

        var interactionsCol = $app.findCollectionByNameOrId('ticket_interactions')
        var interaction = new Record(interactionsCol)
        interaction.set('ticket', existingTicket.id)
        interaction.set('author', uploadedByUserId)
        interaction.set('type', 'Público')
        interaction.set('content', cleanBody)
        if (msg.raw_html || msg.html) {
          interaction.set('email_html', msg.raw_html || msg.html)
        }
        interaction.set('origin', 'Automático')
        interaction.set('billing_status', 'Não Faturável')
        $app.save(interaction)

        var savedAttachs = saveEmailAttachments(existingTicket.id, interaction.id)

        // Notificar operador responsável
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

        this.recordProcessedEmail({
          messageId: messageId,
          dedupeHash: dedupeHash,
          fromEmail: from,
          fromName: fromName,
          subject: subject,
          outcome: 'ticket_replied',
          ticketId: existingTicket.id,
          ticketNumber: existingTicket.getString('number'),
          interactionId: interaction.id,
          details:
            'Resposta registrada como interação no chamado #' + existingTicket.getString('number'),
        })

        return {
          status: 'replied',
          ticket_id: existingTicket.id,
          ticket_number: existingTicket.getString('number'),
          interaction_id: interaction.id,
          reopened: isClosed,
          attachments_count: savedAttachs,
        }
      }
    }

    // -------------------------------------------------------------
    // NOVO CHAMADO
    // -------------------------------------------------------------
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

    var ticketsCol = $app.findCollectionByNameOrId('tickets')
    var ticket = new Record(ticketsCol)
    ticket.set('title', subject)
    ticket.set('description', cleanBody)
    if (msg.raw_html || msg.html) {
      ticket.set('email_html', msg.raw_html || msg.html)
    }
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

    // Fila padrão se houver
    try {
      var queues = $app.findRecordsByFilter('queues', 'active = true', 'priority', 1, 0)
      if (queues.length > 0) {
        ticket.set('queue', queues[0].id)
      }
    } catch (_) {}

    $app.save(ticket)

    var ticketAttachmentsCount = saveEmailAttachments(ticket.id, null)

    // Triagem Automática (categorias)
    var triageSuggestion = null
    try {
      var categories = $app.findRecordsByFilter('tkt_categories', 'active = true', 'name', 100, 0)
      var fullText = (subject + ' ' + cleanBody).toLowerCase()
      var bestCategory = null
      var bestScore = 0

      for (var c = 0; c < categories.length; c++) {
        var cat = categories[c]
        var catName = (cat.getString('name') || '').toLowerCase()
        var words = catName.split(/[\s,/-]+/)
        var score = 0
        for (var w = 0; w < words.length; w++) {
          var word = words[w].trim()
          if (word.length >= 3 && fullText.indexOf(word) !== -1) {
            score += 2
          }
        }
        if (score > bestScore) {
          bestScore = score
          bestCategory = cat
        }
      }

      if (bestCategory) {
        triageSuggestion = {
          type: 'Incidente',
          category: bestCategory.id,
          category_name: bestCategory.getString('name'),
          confidence: Math.min(0.9, 0.5 + bestScore * 0.1),
          reason: 'Sugerido com base na correspondência de palavras-chave do catálogo.',
          source: 'keyword_match',
        }
        ticket.set('triage_suggestions', triageSuggestion)
        $app.save(ticket)
      }
    } catch (_) {}

    // Registrar em processed_emails
    this.recordProcessedEmail({
      messageId: messageId,
      dedupeHash: dedupeHash,
      fromEmail: from,
      fromName: fromName,
      subject: subject,
      outcome: 'ticket_created',
      ticketId: ticket.id,
      ticketNumber: ticket.getString('number'),
      details:
        'Chamado criado com sucesso vinculado ao cliente ' + (userCompanyId || 'Sem Empresa'),
    })

    return {
      status: 'created',
      ticket_id: ticket.id,
      ticket_number: ticket.getString('number'),
      attachments_count: ticketAttachmentsCount,
      triage_suggestions: triageSuggestion,
      company_id: userCompanyId,
    }
  },
}
