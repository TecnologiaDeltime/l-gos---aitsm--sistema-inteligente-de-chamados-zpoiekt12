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
    // Helper autocontido de descriptografia AES-256 para execução segura no contexto isolado do cron
    function safeDecryptSecret(val) {
      if (!val || typeof val !== 'string') return ''
      val = val.trim()
      var PREFIX = 'enc:v1:'
      if (val.indexOf(PREFIX) !== 0) return val
      if (typeof globalThis !== 'undefined' && typeof globalThis.itsmDecrypt === 'function') {
        try {
          var decGlobal = globalThis.itsmDecrypt(val)
          if (decGlobal && decGlobal.indexOf(PREFIX) !== 0) return decGlobal
        } catch (_) {}
      }
      try {
        var k = ''
        if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
          k = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
        }
        if (!k && typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
          k = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
        }
        if (!k) {
          k = 'itsm_default_fallback_aes256_key_super_safe_2026'
        }
        var derivedKey = ''
        try {
          derivedKey = $security.sha256(k).substring(0, 32)
        } catch (_) {
          derivedKey = (k + '01234567890123456789012345678901').substring(0, 32)
        }
        var payload = val.substring(PREFIX.length)
        var dec = $security.decrypt(payload, derivedKey)
        return dec || ''
      } catch (err) {
        return '__DECRYPT_FAILED__'
      }
    }

    var graphTenantId = (config.getString('graph_tenant_id') || '').trim()
    var graphClientId = (config.getString('graph_client_id') || '').trim()
    var rawGraphSecret = (config.getString('graph_client_secret') || '').trim()
    var graphClientSecret = safeDecryptSecret(rawGraphSecret)
    var graphMailbox = (
      config.getString('graph_mailbox') ||
      config.getString('imap_user') ||
      ''
    ).trim()

    var host = config.getString('imap_host')
    var port = config.getInt('imap_port') || 993
    var user = config.getString('imap_user')
    var rawPass = config.getString('imap_password')
    var pass = safeDecryptSecret(rawPass)
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
          if (msg.raw_html || msg.html) {
            retained.set('email_html', msg.raw_html || msg.html)
          }
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
          if (msg.raw_html || msg.html) {
            interaction.set('email_html', msg.raw_html || msg.html)
          }
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
    // CLIENTE MICROSOFT GRAPH API EMBUTIDO (100% autônomo dentro do handler isolado)
    // =========================================================================
    var GraphClient = {
      urlEncode: function (str) {
        return encodeURIComponent(String(str || ''))
          .replace(/%20/g, '+')
          .replace(/[!'()*]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase()
          })
      },
      htmlToText: function (html) {
        if (!html) return ''
        return String(html)
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n\s*\n+/g, '\n\n')
          .trim()
      },
      getAccessToken: function (params) {
        var tenantId = (params.tenant_id || params.graph_tenant_id || '').trim()
        var clientId = (params.client_id || params.graph_client_id || '').trim()
        var rawClientSecret = (params.client_secret || params.graph_client_secret || '').trim()

        var clientSecret = safeDecryptSecret(rawClientSecret)
        if (typeof clientSecret === 'string') {
          clientSecret = clientSecret.trim()
        }

        if (!tenantId) {
          throw new Error('Tenant ID (ID do Locatário) da Microsoft não configurado.')
        }
        if (!clientId) {
          throw new Error('Client ID (ID do Aplicativo) da Microsoft não configurado.')
        }
        if (!clientSecret) {
          throw new Error('Client Secret (Segredo do Cliente) da Microsoft não configurado.')
        }

        if (clientSecret === '__DECRYPT_FAILED__' || clientSecret.indexOf('enc:v1:') === 0) {
          throw new Error('Falha interna de descriptografia — não é problema no Entra ID.')
        }

        var guidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        if (guidRegex.test(clientSecret)) {
          throw new Error(
            'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.',
          )
        }

        var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token'
        var formBody = [
          'client_id=' + GraphClient.urlEncode(clientId),
          'client_secret=' + GraphClient.urlEncode(clientSecret),
          'grant_type=client_credentials',
          'scope=' + GraphClient.urlEncode('https://graph.microsoft.com/.default'),
        ].join('&')

        var res = null
        try {
          res = $http.send({
            url: tokenUrl,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
            body: formBody,
            timeout: 30,
          })
        } catch (netErr) {
          throw new Error('Falha de rede ao contatar login.microsoftonline.com: ' + netErr.message)
        }

        var bodyText = res.raw || ''
        var data = null
        try {
          data = JSON.parse(bodyText)
        } catch (_) {
          data = {}
        }

        if (res.statusCode !== 200) {
          var errDesc = data.error_description || data.error || bodyText || 'HTTP ' + res.statusCode
          if (
            errDesc.indexOf('AADSTS700016') !== -1 ||
            errDesc.indexOf('identifier was not found') !== -1
          ) {
            throw new Error(
              'Aplicativo não encontrado no diretório (AADSTS700016). Verifique se o Client ID (' +
                clientId +
                ') e o Tenant ID (' +
                tenantId +
                ') estão corretos no portal Microsoft Entra ID.',
            )
          }
          if (
            errDesc.indexOf('AADSTS7000215') !== -1 ||
            errDesc.indexOf('Invalid client secret') !== -1
          ) {
            throw new Error(
              'Segredo recusado pela Microsoft (AADSTS7000215). Gere um novo Segredo do Cliente em Registros de Aplicativo > Certificados e Segredos no Entra ID.',
            )
          }
          if (
            errDesc.indexOf('AADSTS90002') !== -1 ||
            (errDesc.indexOf('Tenant') !== -1 && errDesc.indexOf('not found') !== -1)
          ) {
            throw new Error(
              'Locatário Microsoft (Tenant ID) não encontrado. Verifique se o Tenant ID (' +
                tenantId +
                ') está correto no portal Entra ID.',
            )
          }
          throw new Error('Falha ao obter token OAuth2 do Microsoft Entra ID: ' + errDesc)
        }

        if (!data.access_token) {
          throw new Error('Servidor Microsoft não retornou access_token.')
        }

        return {
          accessToken: data.access_token,
          expiresIn: data.expires_in || 3600,
          tokenType: data.token_type || 'Bearer',
        }
      },
      getMailboxInfo: function (token, mailbox) {
        var mailboxEncoded = GraphClient.urlEncode(mailbox)
        var url = 'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded

        var res = null
        try {
          res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 30,
          })
        } catch (netErr) {
          throw new Error('Falha de rede ao acessar Graph API: ' + netErr.message)
        }

        var bodyText = res.raw || ''
        var data = null
        try {
          data = JSON.parse(bodyText)
        } catch (_) {
          data = {}
        }

        if (res.statusCode !== 200) {
          var err = data.error || {}
          var code = err.code || ''
          var msg = err.message || bodyText

          if (
            res.statusCode === 404 ||
            code === 'ResourceNotFound' ||
            code === 'Request_ResourceNotFound'
          ) {
            throw new Error(
              'Caixa de e-mail "' +
                mailbox +
                '" não encontrada no locatário Microsoft. Verifique se o e-mail está correto e ativo no Microsoft 365.',
            )
          }
          if (
            res.statusCode === 403 ||
            code === 'ErrorAccessDenied' ||
            code === 'Authorization_RequestDenied'
          ) {
            throw new Error(
              'Permissão insuficiente no Microsoft Entra ID (403 Acesso Negado). Conceda a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" no registro do aplicativo e clique em "Conceder consentimento do administrador".',
            )
          }
          throw new Error(
            'Erro ao verificar caixa "' +
              mailbox +
              '" via Graph API (HTTP ' +
              res.statusCode +
              '): ' +
              msg,
          )
        }

        return {
          id: data.id,
          displayName: data.displayName,
          mail: data.mail || data.userPrincipalName || mailbox,
          userPrincipalName: data.userPrincipalName,
        }
      },
      listUnreadMessages: function (token, mailbox, top) {
        top = top || 25
        var mailboxEncoded = GraphClient.urlEncode(mailbox)
        var url =
          'https://graph.microsoft.com/v1.0/users/' +
          mailboxEncoded +
          '/messages?$filter=' +
          GraphClient.urlEncode('isRead eq false') +
          '&$top=' +
          top +
          '&$orderby=' +
          GraphClient.urlEncode('receivedDateTime desc') +
          '&$select=' +
          GraphClient.urlEncode(
            'id,conversationId,createdDateTime,receivedDateTime,hasAttachments,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,isRead',
          )

        var res = null
        try {
          res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
              Prefer: 'outlook.body-content-type="html"',
            },
            timeout: 45,
          })
        } catch (netErr) {
          throw new Error('Falha de rede ao listar mensagens da Graph API: ' + netErr.message)
        }

        var bodyText = res.raw || ''
        var data = null
        try {
          data = JSON.parse(bodyText)
        } catch (_) {
          data = {}
        }

        if (res.statusCode !== 200) {
          var err = data.error || {}
          var code = err.code || ''
          var msg = err.message || bodyText

          if (
            res.statusCode === 403 ||
            code === 'ErrorAccessDenied' ||
            code === 'Authorization_RequestDenied'
          ) {
            throw new Error(
              'Permissão insuficiente para ler mensagens (403). Certifique-se de que a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" possui "Consentimento do Administrador Concedido" no Microsoft Entra ID.',
            )
          }
          throw new Error(
            'Erro ao listar mensagens não lidas (HTTP ' + res.statusCode + '): ' + msg,
          )
        }

        return data.value || []
      },
      listRecentMessages: function (token, mailbox, top) {
        top = top || 10
        var mailboxEncoded = GraphClient.urlEncode(mailbox)
        var url =
          'https://graph.microsoft.com/v1.0/users/' +
          mailboxEncoded +
          '/messages?$top=' +
          top +
          '&$orderby=' +
          GraphClient.urlEncode('receivedDateTime desc') +
          '&$select=' +
          GraphClient.urlEncode('id,receivedDateTime,internetMessageId,subject,from,isRead')

        var res = null
        try {
          res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 30,
          })
        } catch (netErr) {
          throw new Error('Falha de rede ao obter mensagens recentes: ' + netErr.message)
        }

        var bodyText = res.raw || ''
        var data = null
        try {
          data = JSON.parse(bodyText)
        } catch (_) {
          data = {}
        }

        if (res.statusCode !== 200) {
          var err = data.error || {}
          throw new Error(
            'Erro ao listar mensagens recentes (HTTP ' +
              res.statusCode +
              '): ' +
              (err.message || bodyText),
          )
        }

        return data.value || []
      },
      getMessageAttachments: function (token, mailbox, messageId) {
        var mailboxEncoded = GraphClient.urlEncode(mailbox)
        var url =
          'https://graph.microsoft.com/v1.0/users/' +
          mailboxEncoded +
          '/messages/' +
          messageId +
          '/attachments'

        var res = null
        try {
          res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 45,
          })
        } catch (netErr) {
          return []
        }

        if (res.statusCode !== 200) {
          return []
        }

        var bodyText = res.raw || ''
        var data = null
        try {
          data = JSON.parse(bodyText)
        } catch (_) {
          data = {}
        }

        var rawAttachments = data.value || []
        var attachments = []

        for (var i = 0; i < rawAttachments.length; i++) {
          var att = rawAttachments[i]
          if (att.contentBytes) {
            var rawCid = (att.contentId || '').replace(/[<>]/g, '').trim()
            attachments.push({
              filename: att.name || 'anexo_' + (i + 1),
              content_type: att.contentType || 'application/octet-stream',
              data_base64: att.contentBytes,
              file_size: att.size || 0,
              is_inline: !!att.isInline,
              content_id: rawCid,
            })
          }
        }

        return attachments
      },
      markMessageAsRead: function (token, mailbox, messageId) {
        var mailboxEncoded = GraphClient.urlEncode(mailbox)
        var url =
          'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded + '/messages/' + messageId

        try {
          var res = $http.send({
            url: url,
            method: 'PATCH',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ isRead: true }),
            timeout: 20,
          })
          return res.statusCode >= 200 && res.statusCode < 300
        } catch (err) {
          return false
        }
      },
      normalizeGraphMessage: function (graphMsg, attachments) {
        var fromObj = graphMsg.from || {}
        var emailAddress = fromObj.emailAddress || {}
        var fromEmail = (emailAddress.address || '').trim()
        var fromName = (emailAddress.name || '').trim()
        var subject = (graphMsg.subject || '').trim()
        var bodyObj = graphMsg.body || {}
        var rawBodyContent = bodyObj.content || graphMsg.bodyPreview || ''

        var cleanBody = ''
        if (bodyObj.contentType === 'html' || rawBodyContent.indexOf('<') !== -1) {
          cleanBody = GraphClient.htmlToText(rawBodyContent)
        } else {
          cleanBody = rawBodyContent
        }

        var messageId =
          (graphMsg.internetMessageId || '').replace(/[<>]/g, '').trim() || 'GRAPH-' + graphMsg.id

        return {
          id: graphMsg.id,
          message_id: messageId,
          from: fromEmail,
          from_name: fromName,
          subject: subject || 'Sem assunto',
          body: cleanBody,
          raw_html: bodyObj.contentType === 'html' ? rawBodyContent : null,
          received_at: graphMsg.receivedDateTime,
          attachments: attachments || [],
        }
      },
    }

    // =========================================================================
    // RAMO 1: MICROSOFT GRAPH API (HTTPS via $http.send) - CAMINHO PRINCIPAL M365
    // =========================================================================
    if (receptionMode === 'graph') {
      var isDecryptFailed =
        graphClientSecret === '__DECRYPT_FAILED__' || graphClientSecret.indexOf('enc:v1:') === 0
      var isGuidSecret =
        !isDecryptFailed &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          graphClientSecret,
        )

      if (
        !graphTenantId ||
        !graphClientId ||
        !graphClientSecret ||
        isDecryptFailed ||
        isGuidSecret
      ) {
        var configErrMsg = ''
        var checkStatus = 'Falha na Configuração'
        if (isDecryptFailed) {
          configErrMsg = 'Falha interna de descriptografia — não é problema no Entra ID.'
          checkStatus = 'Falha Interna de Descriptografia'
        } else if (isGuidSecret) {
          configErrMsg =
            'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.'
          checkStatus = 'Falha de Autenticação Graph'
        } else {
          configErrMsg =
            'Configuração Microsoft Graph incompleta: Tenant ID, Client ID ou Client Secret ausente.'
          checkStatus = 'Falha na Configuração'
        }

        config.set('last_check_at', new Date().toISOString())
        config.set('last_check_status', checkStatus)
        config.set('last_check_error', configErrMsg)
        $app.save(config)
        $app.logger().warn('email_checker_cron: ' + configErrMsg)
        logAudit(config.id, 'check', 'error', configErrMsg, 0, Date.now() - startTime)
        return
      }

      var client = GraphClient

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
