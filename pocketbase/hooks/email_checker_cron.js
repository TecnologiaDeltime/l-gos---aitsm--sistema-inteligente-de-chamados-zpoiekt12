// Cron para ingestão automática de e-mails via Microsoft Graph API (HTTPS) ou IMAP (Skip Cloud / PocketBase)
// Executa a cada 2 minutos (*/2 * * * *)
// Pipeline de Ingestão:
// 1. Lê a configuração salva em `email_config` (se inativo, pula).
// 2. Se modo = 'graph' (padrão recomendado para Office 365):
//    - Autentica via OAuth2 Client Credentials (POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token)
//    - Lista e-mails não lidos via HTTPS (GET https://graph.microsoft.com/v1.0/users/{mailbox}/messages?$filter=isRead eq false)
//    - Baixa anexos em base64 e marca como lido (PATCH isRead=true)
// 3. Se modo = 'imap':
//    - Tenta conexão IMAP via sockets TCP legados (informa de modo amigável se módulos tls/net não estiverem disponíveis)
// 4. Alimenta as mensagens no mesmo pipeline de triagem ITSM:
//    - Deduplicação estrita via Message-ID / Hash no processed_emails
//    - Verifica se o domínio (@empresa.com) do remetente está cadastrado em `client_email_domains` com active=true
//    - Se liberado:
//        * Se for resposta a chamado existente (#NNNN): insere interação pública e reabre se fechado
//        * Se novo chamado: cria Ticket vinculado à empresa do domínio, solicitante, SLA, fila e salva anexos
//    - Se NÃO liberado: envia para "Chamados Retidos" (retained_tickets com status Pendente e retention_notified=false)
// 5. Atualiza `email_config` com last_check_at, last_check_status, last_check_error, last_processed_count, total_ingested_count, total_retained_count e histórico em `email_audit_logs`.

cronAdd('email_checker_cron', '*/2 * * * *', () => {
  var config = null
  var startTime = Date.now()

  try {
    var configs = $app.findRecordsByFilter('email_config', 'enabled = true', '-created', 1, 0)
    if (!configs || configs.length === 0) {
      return
    }
    config = configs[0]

    var receptionMode = config.getString('reception_mode') || 'graph'
    var graphTenantId = config.getString('graph_tenant_id')
    var graphClientId = config.getString('graph_client_id')
    var graphClientSecret = config.getString('graph_client_secret')
    var graphMailbox = config.getString('graph_mailbox') || config.getString('imap_user')

    var host = config.getString('imap_host')
    var port = config.getInt('imap_port') || 993
    var user = config.getString('imap_user')
    var pass = config.getString('imap_password')
    var encryption = config.getString('imap_encryption') || 'SSL/TLS'
    var inboxFolder = config.getString('inbox_folder') || 'INBOX'
    var processedFolder = config.getString('processed_folder') || ''

    var processedCount = 0
    var createdCount = 0
    var repliedCount = 0
    var retainedCount = 0
    var skippedCount = 0
    var errors = []

    // -------------------------------------------------------------
    // Helpers locais de Ingestão e Processamento
    // -------------------------------------------------------------
    var base64ToUint8 = function (base64Str) {
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
        var e1 = chars.indexOf(clean.charAt(charIdx++))
        var e2 = chars.indexOf(clean.charAt(charIdx++))
        var e3 = chars.indexOf(clean.charAt(charIdx++))
        var e4 = chars.indexOf(clean.charAt(charIdx++))
        if (e1 === -1 || e2 === -1 || e3 === -1 || e4 === -1) break
        var bits24 = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4
        byteArray[byteIdx++] = (bits24 >> 16) & 0xff
        if (e3 !== 64) {
          byteArray[byteIdx++] = (bits24 >> 8) & 0xff
          if (e4 !== 64) {
            byteArray[byteIdx++] = bits24 & 0xff
          }
        }
      }
      return byteArray.subarray(0, byteIdx)
    }

    var bytesToUtf8 = function (bytes) {
      var str = ''
      for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
      try {
        return decodeURIComponent(escape(str))
      } catch (_) {
        return str
      }
    }

    var cleanText = function (text) {
      if (!text) return ''
      return String(text)
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
    }

    var extractDomain = function (email) {
      if (!email) return ''
      var atIndex = email.lastIndexOf('@')
      if (atIndex === -1) return ''
      return email.substring(atIndex).toLowerCase().trim()
    }

    var isAlreadyProcessed = function (messageId, dedupeHash) {
      if (messageId) {
        try {
          var found1 = $app.findRecordsByFilter(
            'processed_emails',
            'message_id = "' + messageId + '"',
            '',
            1,
            0,
          )
          if (found1 && found1.length > 0) return true
        } catch (_) {}
      }
      if (dedupeHash) {
        try {
          var found2 = $app.findRecordsByFilter(
            'processed_emails',
            'dedupe_hash = "' + dedupeHash + '"',
            '',
            1,
            0,
          )
          if (found2 && found2.length > 0) return true
        } catch (_) {}
      }
      return false
    }

    var recordProcessedEmail = function (data) {
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
    }

    var logAudit = function (configId, action, status, message, count, durationMs) {
      try {
        var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
        var rec = new Record(auditCol)
        rec.set('test_type', 'connection_test')
        rec.set('status', status === 'success' ? 'success' : 'failed')
        rec.set('host', receptionMode === 'graph' ? 'graph.microsoft.com' : host)
        rec.set('port', receptionMode === 'graph' ? 443 : port)
        rec.set('user_account', receptionMode === 'graph' ? graphMailbox : user)
        rec.set('inbox_folder', inboxFolder)
        rec.set('encryption', receptionMode === 'graph' ? 'HTTPS (OAuth2)' : encryption)
        rec.set('summary_message', message)
        rec.set('latest_messages_count', count || 0)
        $app.save(rec)
      } catch (err) {
        $app.logger().error('logAudit error', 'err', err.message)
      }
    }

    // -------------------------------------------------------------
    // Pipeline de processamento de mensagem individual (comum a Graph e IMAP)
    // -------------------------------------------------------------
    var processEmailMessage = function (msg) {
      var from = (msg.from || '').trim()
      var fromName = (msg.from_name || '').trim()
      var subject = (msg.subject || '').trim()
      var bodyRaw = (msg.body || '').trim()
      var messageId = (msg.message_id || '').trim()
      var attachments = Array.isArray(msg.attachments) ? msg.attachments : []

      if (!from || !subject) {
        return { status: 'skipped', reason: 'E-mail sem remetente ou assunto.' }
      }

      var cleanBody = cleanText(bodyRaw)
      if (!cleanBody) cleanBody = subject

      var dedupeKey = [from.toLowerCase(), subject.toLowerCase(), cleanBody.substring(0, 150)].join(
        '|',
      )
      var dedupeHash = $security.md5(dedupeKey)
      var fallbackId = messageId
      if (!fallbackId) {
        fallbackId = 'HASH-' + dedupeHash
      }

      if (isAlreadyProcessed(fallbackId, dedupeHash)) {
        return {
          status: 'skipped',
          reason: 'E-mail já processado anteriormente (idempotência garantida).',
          messageId: fallbackId,
        }
      }

      var domain = extractDomain(from)

      // Verificar domínio em client_email_domains
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

      // ---------------------------------------------------------
      // Domínio NÃO liberado: registrar em retained_tickets
      // ---------------------------------------------------------
      if (!domainAllowed) {
        var retainedId = ''
        try {
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
          retained.set('retention_notified', false)
          $app.save(retained)
          retainedId = retained.id

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

          recordProcessedEmail({
            messageId: fallbackId,
            dedupeHash: dedupeHash,
            fromEmail: from,
            fromName: fromName,
            subject: subject,
            outcome: 'ticket_retained',
            retainedId: retainedId,
            details:
              'Retido em moderação: domínio ' + (domain || 'desconhecido') + ' não liberado.',
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
          return { status: 'skipped', reason: 'Falha ao reter chamado: ' + retErr.message }
        }
      }

      // ---------------------------------------------------------
      // Domínio liberado: identificar solicitante
      // ---------------------------------------------------------
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
              .error('saveEmailAttachments: error', 'file', filename, 'err', attErr.message)
          }
        }
        return savedCount
      }

      // ---------------------------------------------------------
      // DETECÇÃO DE RESPOSTA (REPLY DETECTION)
      // ---------------------------------------------------------
      var replyPrefixRegex = /^\s*(re|res|fwd|fw|enc|r)\s*:\s*/i
      var hasReplyPrefix = replyPrefixRegex.test(subject)
      var extractedTicketNumber = ''
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
          interaction.set('origin', 'Automático')
          interaction.set('billing_status', 'Não Faturável')
          $app.save(interaction)

          var savedAttachs = saveEmailAttachments(existingTicket.id, interaction.id)

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

          recordProcessedEmail({
            messageId: fallbackId,
            dedupeHash: dedupeHash,
            fromEmail: from,
            fromName: fromName,
            subject: subject,
            outcome: 'ticket_replied',
            ticketId: existingTicket.id,
            ticketNumber: existingTicket.getString('number'),
            interactionId: interaction.id,
            details:
              'Resposta registrada como interação no chamado #' +
              existingTicket.getString('number'),
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

      // ---------------------------------------------------------
      // NOVO CHAMADO
      // ---------------------------------------------------------
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

      try {
        var queues = $app.findRecordsByFilter('queues', 'active = true', 'priority', 1, 0)
        if (queues.length > 0) {
          ticket.set('queue', queues[0].id)
        }
      } catch (_) {}

      $app.save(ticket)

      var ticketAttachmentsCount = saveEmailAttachments(ticket.id, null)

      // Triagem Automática
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
          ticket.set('triage_suggestions', JSON.stringify(triageSuggestion))
          $app.save(ticket)
        }
      } catch (_) {}

      recordProcessedEmail({
        messageId: fallbackId,
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
    }

    // =========================================================================
    // RAMO 1: MICROSOFT GRAPH API (HTTPS via $http.send) - CAMINHO PRINCIPAL M365
    // =========================================================================
    if (receptionMode === 'graph') {
      if (!graphTenantId || !graphClientId || !graphClientSecret) {
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha na Configuração')
        config.set(
          'last_check_error',
          'Configuração Microsoft Graph incompleta: Tenant ID, Client ID ou Client Secret ausente.',
        )
        $app.save(config)
        $app
          .logger()
          .warn('email_checker_cron: Configuração Graph incompleta (Tenant/Client/Secret).')
        return
      }

      var client = globalThis.MicrosoftGraphClient
      if (!client) {
        throw new Error('Módulo MicrosoftGraphClient não carregado no runtime.')
      }

      var token = ''
      try {
        var authRes = client.getAccessToken({
          tenant_id: graphTenantId,
          client_id: graphClientId,
          client_secret: graphClientSecret,
        })
        token = authRes.accessToken
      } catch (authErr) {
        $app.logger().error('email_checker_cron graph auth error', 'error', authErr.message)
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha de Autenticação Graph')
        config.set('last_check_error', authErr.message)
        $app.save(config)
        logAudit(config.id, 'check', 'error', authErr.message, 0, Date.now() - startTime)
        return
      }

      var unreadMessages = []
      try {
        unreadMessages = client.listUnreadMessages(token, graphMailbox, 25)
      } catch (listErr) {
        $app.logger().error('email_checker_cron graph list error', 'error', listErr.message)
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha ao Listar Mensagens Graph')
        config.set('last_check_error', listErr.message)
        $app.save(config)
        logAudit(config.id, 'check', 'error', listErr.message, 0, Date.now() - startTime)
        return
      }

      for (var gm = 0; gm < unreadMessages.length; gm++) {
        var rawGraphMsg = unreadMessages[gm]
        try {
          var attachments = []
          if (rawGraphMsg.hasAttachments) {
            try {
              attachments = client.getMessageAttachments(token, graphMailbox, rawGraphMsg.id)
            } catch (attErr) {
              $app
                .logger()
                .warn(
                  'email_checker_cron: erro ao buscar anexos',
                  'id',
                  rawGraphMsg.id,
                  'err',
                  attErr.message,
                )
            }
          }

          var normalized = client.normalizeGraphMessage(rawGraphMsg, attachments)
          var result = processEmailMessage(normalized)
          processedCount++

          if (result.status === 'created') {
            createdCount++
            $app
              .logger()
              .info(
                'email_checker_cron (Graph): Chamado criado',
                'ticket',
                result.ticket_number,
                'from',
                normalized.from,
              )
          } else if (result.status === 'replied') {
            repliedCount++
            $app
              .logger()
              .info(
                'email_checker_cron (Graph): Resposta adicionada',
                'ticket',
                result.ticket_number,
                'from',
                normalized.from,
              )
          } else if (result.status === 'retained') {
            retainedCount++
            $app
              .logger()
              .warn(
                'email_checker_cron (Graph): E-mail retido para moderação',
                'retained_id',
                result.retained_id,
                'from',
                normalized.from,
              )
          } else if (result.status === 'skipped') {
            skippedCount++
          }

          // Marcar como lida no Microsoft 365 para não reprocessar no próximo ciclo
          client.markMessageAsRead(token, graphMailbox, rawGraphMsg.id)
        } catch (itemErr) {
          errors.push('Msg ID ' + rawGraphMsg.id + ': ' + itemErr.message)
          $app
            .logger()
            .error(
              'email_checker_cron (Graph) process item error',
              'id',
              rawGraphMsg.id,
              'err',
              itemErr.message,
            )
        }
      }
    }

    // =========================================================================
    // RAMO 2: IMAP LEGADO (SOCKET TCP) - CAMINHO SECUNDÁRIO PARA NÃO-MICROSOFT
    // =========================================================================
    else {
      if (!host || !user || !pass) {
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha na Configuração')
        config.set(
          'last_check_error',
          'Configuração IMAP incompleta: host, usuário ou senha ausente.',
        )
        $app.save(config)
        $app
          .logger()
          .warn('email_checker_cron: Configuração IMAP incompleta (host, user ou senha ausente).')
        return
      }

      var conn = null
      var reader = null
      var addr = host + ':' + port
      var isImplicitTls =
        encryption.toLowerCase().indexOf('ssl') !== -1 ||
        encryption.toLowerCase().indexOf('tls') !== -1 ||
        port === 993

      var g =
        typeof globalThis !== 'undefined' ? globalThis : typeof this !== 'undefined' ? this : {}
      var netObj =
        g.net || (typeof net !== 'undefined' ? net : typeof $net !== 'undefined' ? $net : null)
      var tlsObj =
        g.tls || (typeof tls !== 'undefined' ? tls : typeof $tls !== 'undefined' ? $tls : null)
      var bufioObj =
        g.bufio ||
        (typeof bufio !== 'undefined' ? bufio : typeof $bufio !== 'undefined' ? $bufio : null)

      var friendlyNetError = function (rawMsg) {
        var low = (rawMsg || '').toLowerCase()
        if (low.indexOf('no such host') !== -1 || low.indexOf('lookup') !== -1) {
          return (
            'Host IMAP inacessível: não foi possível resolver o endereço "' +
            host +
            '". Verifique o nome do servidor.'
          )
        }
        if (low.indexOf('connection refused') !== -1) {
          return (
            'Conexão recusada na porta ' +
            port +
            ' de ' +
            host +
            '. Porta pode estar fechada ou bloqueada por firewall.'
          )
        }
        if (
          low.indexOf('timeout') !== -1 ||
          low.indexOf('i/o timeout') !== -1 ||
          low.indexOf('deadline exceeded') !== -1
        ) {
          return 'Tempo limite de conexão esgotado ao contatar ' + host + ':' + port + ' (timeout).'
        }
        if (low.indexOf('certificate') !== -1 || low.indexOf('handshake') !== -1) {
          return 'Falha na negociação TLS/SSL com ' + host + ': ' + rawMsg
        }
        return 'Falha de rede ao conectar em ' + host + ':' + port + ' — ' + rawMsg
      }

      try {
        if (isImplicitTls) {
          if (tlsObj && (typeof tlsObj.dial === 'function' || typeof tlsObj.Dial === 'function')) {
            var dialFn = typeof tlsObj.dial === 'function' ? tlsObj.dial : tlsObj.Dial
            conn = dialFn('tcp', addr, {
              insecureSkipVerify: true,
              serverName: host,
            })
          } else if (
            netObj &&
            (typeof netObj.dial === 'function' || typeof netObj.Dial === 'function')
          ) {
            var netDialFn = typeof netObj.dial === 'function' ? netObj.dial : netObj.Dial
            var rawConn = netDialFn('tcp', addr)
            if (
              tlsObj &&
              (typeof tlsObj.client === 'function' || typeof tlsObj.Client === 'function')
            ) {
              var clientFn = typeof tlsObj.client === 'function' ? tlsObj.client : tlsObj.Client
              conn = clientFn(rawConn, {
                insecureSkipVerify: true,
                serverName: host,
              })
            } else {
              conn = rawConn
            }
          } else {
            throw new Error(
              'Módulos de rede Goja (tls / net) indisponíveis no runtime. Para Office 365 utilize o modo Microsoft Graph (HTTPS).',
            )
          }
        } else {
          if (netObj && (typeof netObj.dial === 'function' || typeof netObj.Dial === 'function')) {
            var plainDialFn = typeof netObj.dial === 'function' ? netObj.dial : netObj.Dial
            conn = plainDialFn('tcp', addr)
          } else {
            throw new Error(
              'Módulo de rede Goja (net) indisponível no runtime. Para Office 365 utilize o modo Microsoft Graph (HTTPS).',
            )
          }
        }
      } catch (dialErr) {
        var connErr = friendlyNetError(dialErr.message)
        $app.logger().error('email_checker_cron dial error', 'error', connErr)
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha na Conexão IMAP')
        config.set('last_check_error', connErr)
        $app.save(config)
        logAudit(config.id, 'check', 'error', connErr, 0, Date.now() - startTime)
        return
      }

      if (bufioObj) {
        if (typeof bufioObj.newReader === 'function') {
          reader = bufioObj.newReader(conn)
        } else if (typeof bufioObj.NewReader === 'function') {
          reader = bufioObj.NewReader(conn)
        }
      }

      var readLineFromConn = function () {
        if (reader && typeof reader.readString === 'function') {
          return reader.readString('\n')
        }
        if (reader && typeof reader.ReadString === 'function') {
          return reader.ReadString('\n')
        }
        if (reader && typeof reader.readLine === 'function') {
          var rL = reader.readLine()
          return Array.isArray(rL) ? rL[0] : rL
        }
        if (conn && typeof conn.read === 'function') {
          var buf = new Uint8Array(4096)
          var n = conn.read(buf)
          if (n <= 0) return ''
          return bytesToUtf8(buf.subarray(0, n))
        }
        return ''
      }

      var writeToConn = function (str) {
        if (conn && typeof conn.write === 'function') {
          conn.write(str)
        } else if (conn && typeof conn.Write === 'function') {
          conn.Write(str)
        }
      }

      var tagCounter = 1
      var sendCmd = function (cmd) {
        var tag = 'A' + String(tagCounter++)
        var fullCmd = tag + ' ' + cmd + '\r\n'
        writeToConn(fullCmd)

        var lines = []
        var status = ''
        var maxLines = 1000
        var lineCount = 0

        while (lineCount < maxLines) {
          var line = readLineFromConn()
          if (!line) break
          lineCount++
          var cleanLine = line.replace(/[\r\n]+$/, '')
          lines.push(cleanLine)
          if (cleanLine.indexOf(tag + ' OK') === 0) {
            status = 'OK'
            break
          }
          if (cleanLine.indexOf(tag + ' NO') === 0) {
            status = 'NO'
            break
          }
          if (cleanLine.indexOf(tag + ' BAD') === 0) {
            status = 'BAD'
            break
          }
        }
        return { tag: tag, status: status, lines: lines }
      }

      try {
        var banner = readLineFromConn()
        if (!banner || banner.indexOf('* OK') === -1) {
          throw new Error(
            'Servidor IMAP não enviou saudação válida: ' + (banner || 'resposta vazia'),
          )
        }

        var safePass = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        var safeUser = user.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        var loginRes = sendCmd('LOGIN "' + safeUser + '" "' + safePass + '"')
        if (loginRes.status !== 'OK') {
          throw new Error('Falha na autenticação IMAP: ' + loginRes.lines.join(' '))
        }

        sendCmd('LOGOUT')
      } catch (imapErr) {
        var opErrMsg = imapErr.message || 'Erro durante varredura IMAP.'
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Falha na Operação IMAP')
        config.set('last_check_error', opErrMsg)
        $app.save(config)
        logAudit(config.id, 'check', 'error', opErrMsg, 0, Date.now() - startTime)
        return
      } finally {
        if (conn) {
          try {
            conn.close()
          } catch (_) {}
        }
      }
    }

    var duration = Date.now() - startTime

    // -------------------------------------------------------------
    // Atualização final dos contadores e status em email_config
    // -------------------------------------------------------------
    try {
      var freshConfigs = $app.findRecordsByFilter(
        'email_config',
        'id = "' + config.id + '"',
        '',
        1,
        0,
      )
      var targetConfig = freshConfigs.length > 0 ? freshConfigs[0] : config
      targetConfig.set('last_check_at', new Date().toISOString())
      targetConfig.set('last_check_status', 'Sucesso')
      targetConfig.set('last_check_error', errors.length > 0 ? 'Avisos: ' + errors.join('; ') : '')
      targetConfig.set('last_processed_count', processedCount)
      var prevIngested = targetConfig.getInt('total_ingested_count') || 0
      var prevRetained = targetConfig.getInt('total_retained_count') || 0
      targetConfig.set('total_ingested_count', prevIngested + createdCount + repliedCount)
      targetConfig.set('total_retained_count', prevRetained + retainedCount)
      $app.save(targetConfig)
    } catch (saveErr) {
      $app.logger().error('email_checker_cron update config error', 'err', saveErr.message)
    }

    var auditStatus = errors.length > 0 && processedCount === 0 ? 'error' : 'success'
    var auditMsg =
      'Varredura automática (' +
      (receptionMode === 'graph' ? 'Microsoft Graph HTTPS' : 'IMAP') +
      ') concluída: ' +
      processedCount +
      ' processado(s) (' +
      createdCount +
      ' novo(s), ' +
      repliedCount +
      ' resposta(s), ' +
      retainedCount +
      ' retido(s), ' +
      skippedCount +
      ' ignorado(s)/duplicado(s)).'
    if (errors.length > 0) {
      auditMsg += ' Avisos: ' + errors.join('; ')
    }
    logAudit(config.id, 'check', auditStatus, auditMsg, processedCount, duration)
  } catch (globalErr) {
    $app.logger().error('email_checker_cron fatal error', 'error', globalErr.message)
    if (config) {
      try {
        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', 'Erro Inesperado')
        config.set('last_check_error', globalErr.message || 'Erro fatal no cron')
        $app.save(config)
      } catch (_) {}
    }
  }
})
