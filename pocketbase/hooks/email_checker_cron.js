// Cron para ingestão automática de e-mails via IMAP (Skip Cloud / PocketBase)
// Executa a cada 2 minutos (*/2 * * * *)
// Pipeline de Ingestão:
// 1. Lê a configuração salva em `email_config` (se inativo, pula).
// 2. Conecta ao servidor IMAP real (TLS/SSL direto ou STARTTLS via TCP socket).
// 3. Autentica e seleciona a pasta configurada (padrão INBOX).
// 4. Busca e-mails não lidos (SEARCH UNSEEN / SEARCH ALL).
// 5. Para cada e-mail:
//    - Deduplicação estrita via UID / Message-ID / Hash no processed_emails.
//    - Verifica se o domínio (@empresa.com) do remetente está cadastrado em `client_email_domains` com active=true.
//    - Se liberado:
//        * Se for resposta a chamado existente (#NNNN): insere interação pública e reabre se fechado.
//        * Se novo chamado: cria Ticket vinculado à empresa do domínio, solicitante, SLA, fila e salva anexos.
//    - Se NÃO liberado: envia para "Chamados Retidos" (retained_tickets com status Pendente e retention_notified=false).
//    - Marca o e-mail como lido / move para processed_folder se configurado.
// 6. Atualiza `email_config` com last_check_at, last_processed_count e histórico em `email_audit_logs`.

cronAdd('email_checker_cron', '*/2 * * * *', () => {
  try {
    var configs = $app.findRecordsByFilter('email_config', 'enabled = true', '-created', 1, 0)
    if (!configs || configs.length === 0) {
      return
    }

    var config = configs[0]
    var host = config.getString('imap_host')
    var port = config.getInt('imap_port') || 993
    var user = config.getString('imap_user')
    var pass = config.getString('imap_password')
    var encryption = config.getString('imap_encryption') || 'SSL/TLS'
    var inboxFolder = config.getString('inbox_folder') || 'INBOX'
    var processedFolder = config.getString('processed_folder') || ''

    if (!host || !user || !pass) {
      $app
        .logger()
        .warn('email_checker_cron: Configuração IMAP incompleta (host, user ou senha ausente).')
      return
    }

    var startTime = Date.now()
    var processedCount = 0
    var createdCount = 0
    var repliedCount = 0
    var retainedCount = 0
    var skippedCount = 0
    var errors = []

    // -------------------------------------------------------------
    // Helpers locais (dentro do callback por exigência da JSVM)
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
        rec.set('config', configId)
        rec.set('action', action)
        rec.set('status', status)
        rec.set('message', message)
        rec.set('processed_count', count || 0)
        rec.set('duration_ms', durationMs || 0)
        $app.save(rec)
      } catch (err) {
        $app.logger().error('logAudit error', 'err', err.message)
      }
    }

    // -------------------------------------------------------------
    // Parser RFC 822 / MIME básico e robusto para JSVM
    // -------------------------------------------------------------
    var parseRawRfc822 = function (raw, uid) {
      var splitIdx = raw.indexOf('\r\n\r\n')
      var headerSepLen = 4
      if (splitIdx === -1) {
        splitIdx = raw.indexOf('\n\n')
        headerSepLen = 2
      }

      var headersText = splitIdx !== -1 ? raw.substring(0, splitIdx) : raw
      var bodyText = splitIdx !== -1 ? raw.substring(splitIdx + headerSepLen) : ''

      var unfoldedHeaders = headersText.replace(/\r?\n[ \t]+/g, ' ')
      var hLines = unfoldedHeaders.split(/\r?\n/)

      var headers = {}
      for (var i = 0; i < hLines.length; i++) {
        var hl = hLines[i]
        var colon = hl.indexOf(':')
        if (colon > 0) {
          var key = hl.substring(0, colon).trim().toLowerCase()
          var val = hl.substring(colon + 1).trim()
          headers[key] = val
        }
      }

      var decodeMimeHeader = function (val) {
        if (!val) return ''
        return val.replace(
          /=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g,
          function (_, charset, enc, content) {
            try {
              var encUpper = enc.toUpperCase()
              if (encUpper === 'B') {
                var bytes = base64ToUint8(content)
                if (bytes) {
                  return bytesToUtf8(bytes)
                }
              } else if (encUpper === 'Q') {
                var qp = content.replace(/_/g, ' ')
                qp = qp.replace(/=([A-Fa-f0-9]{2})/g, function (__, hex) {
                  return String.fromCharCode(parseInt(hex, 16))
                })
                try {
                  return decodeURIComponent(escape(qp))
                } catch (_) {
                  return qp
                }
              }
            } catch (_) {}
            return content
          },
        )
      }

      var rawSubject = headers['subject'] || ''
      var subject = decodeMimeHeader(rawSubject) || 'Sem assunto'

      var rawFrom = headers['from'] || ''
      var fromDecoded = decodeMimeHeader(rawFrom)
      var fromEmail = ''
      var fromName = ''

      var fromMatch = fromDecoded.match(/<([^>]+)>/)
      if (fromMatch) {
        fromEmail = fromMatch[1].trim()
        fromName = fromDecoded
          .replace(/<[^>]+>/, '')
          .replace(/["']/g, '')
          .trim()
      } else {
        var emailOnlyMatch = fromDecoded.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)
        if (emailOnlyMatch) {
          fromEmail = emailOnlyMatch[0]
          fromName = fromDecoded.replace(fromEmail, '').replace(/["']/g, '').trim()
        } else {
          fromEmail = fromDecoded
        }
      }

      var messageId = headers['message-id'] || ''
      messageId = messageId.replace(/[<>]/g, '').trim()
      var finalMessageId = messageId || 'IMAP-' + uid + '-' + Date.now()

      var contentType = headers['content-type'] || 'text/plain'
      var contentTransferEncoding = (headers['content-transfer-encoding'] || '').toLowerCase()

      var cleanBody = ''
      var attachments = []

      var boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i)
      if (boundaryMatch) {
        var boundary = boundaryMatch[1]
        var parts = bodyText.split('--' + boundary)
        for (var p = 0; p < parts.length; p++) {
          var part = parts[p]
          if (!part || part.trim() === '--') continue

          var pSep = part.indexOf('\r\n\r\n')
          var pSepLen = 4
          if (pSep === -1) {
            pSep = part.indexOf('\n\n')
            pSepLen = 2
          }
          if (pSep === -1) continue

          var pHead = part.substring(0, pSep).toLowerCase()
          var pBody = part.substring(pSep + pSepLen)

          var isAttachment =
            pHead.indexOf('content-disposition: attachment') !== -1 ||
            pHead.indexOf('filename=') !== -1

          if (isAttachment) {
            var fnMatch = pHead.match(/filename="?([^";\r\n]+)"?/i)
            var fn = fnMatch ? fnMatch[1].trim() : 'anexo_' + (p + 1)
            var pEnc = pHead.indexOf('base64') !== -1 ? 'base64' : 'text'
            attachments.push({
              filename: fn,
              data_base64: pEnc === 'base64' ? pBody.trim() : null,
              content_type: 'application/octet-stream',
            })
          } else if (
            !cleanBody &&
            (pHead.indexOf('text/plain') !== -1 || pHead.indexOf('text/html') !== -1)
          ) {
            var isB64 = pHead.indexOf('content-transfer-encoding: base64') !== -1
            var isQP = pHead.indexOf('content-transfer-encoding: quoted-printable') !== -1
            if (isB64) {
              try {
                var b64Bytes = base64ToUint8(pBody)
                cleanBody = bytesToUtf8(b64Bytes)
              } catch (_) {}
            } else if (isQP) {
              cleanBody = pBody
                .replace(/=\r?\n/g, '')
                .replace(/=([A-Fa-f0-9]{2})/g, function (_, hex) {
                  return String.fromCharCode(parseInt(hex, 16))
                })
            } else {
              cleanBody = pBody
            }
          }
        }
      } else {
        if (contentTransferEncoding.indexOf('base64') !== -1) {
          try {
            var sb64Bytes = base64ToUint8(bodyText)
            cleanBody = bytesToUtf8(sb64Bytes)
          } catch (_) {
            cleanBody = bodyText
          }
        } else if (contentTransferEncoding.indexOf('quoted-printable') !== -1) {
          cleanBody = bodyText
            .replace(/=\r?\n/g, '')
            .replace(/=([A-Fa-f0-9]{2})/g, function (_, hex) {
              return String.fromCharCode(parseInt(hex, 16))
            })
        } else {
          cleanBody = bodyText
        }
      }

      cleanBody = cleanBody.replace(/\)\r?\n?$/, '')

      return {
        uid: uid,
        message_id: finalMessageId,
        from: fromEmail,
        from_name: fromName,
        subject: subject,
        body: cleanBody,
        attachments: attachments,
      }
    }

    // -------------------------------------------------------------
    // Pipeline de processamento de mensagem individual
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

    // -------------------------------------------------------------
    // Conexão TCP / TLS com o servidor IMAP
    // -------------------------------------------------------------
    var conn = null
    try {
      var addr = host + ':' + port
      if (
        encryption.toLowerCase().indexOf('ssl') !== -1 ||
        encryption.toLowerCase().indexOf('tls') !== -1 ||
        port === 993
      ) {
        conn = $tls.dial('tcp', addr, {
          insecureSkipVerify: true,
          serverName: host,
        })
      } else {
        conn = $net.dial('tcp', addr)
      }
    } catch (dialErr) {
      var errMsg =
        'Falha ao conectar via TCP/TLS no host ' + host + ':' + port + ' - ' + dialErr.message
      $app.logger().error('email_checker_cron connect error', 'error', errMsg)
      logAudit(config.id, 'check', 'error', errMsg, 0, Date.now() - startTime)
      return
    }

    var reader = $bufio.newReader(conn)
    var tagCounter = 1

    var sendCmd = function (cmd) {
      var tag = 'A' + String(tagCounter++)
      var fullCmd = tag + ' ' + cmd + '\r\n'
      conn.write(fullCmd)

      var lines = []
      var status = ''
      while (true) {
        var line = reader.readString('\n')
        if (!line) break
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

    var fetchEmailByUid = function (uid, seq) {
      var tag = 'B' + seq
      conn.write(tag + ' UID FETCH ' + uid + ' (BODY.PEEK[])\r\n')

      var rawLines = []
      var inLiteral = false
      var literalBytesRemaining = 0

      while (true) {
        var line = reader.readString('\n')
        if (!line) break

        if (!inLiteral) {
          if (line.indexOf(tag + ' OK') === 0) break
          if (line.indexOf(tag + ' NO') === 0) break
          if (line.indexOf(tag + ' BAD') === 0) break

          var litMatch = line.match(/\{(\d+)\}\s*$/)
          if (litMatch) {
            literalBytesRemaining = parseInt(litMatch[1], 10)
            inLiteral = true
            rawLines.push(line.replace(/\{\d+\}\s*$/, ''))
            continue
          }
          rawLines.push(line)
        } else {
          rawLines.push(line)
          literalBytesRemaining -= line.length
          if (literalBytesRemaining <= 0) {
            inLiteral = false
          }
        }
      }

      var rawEmail = rawLines.join('')
      return parseRawRfc822(rawEmail, uid)
    }

    try {
      // 1. Ler banner de boas-vindas
      var banner = reader.readString('\n')
      if (!banner || banner.indexOf('* OK') === -1) {
        throw new Error('Servidor IMAP não enviou saudação válida: ' + banner)
      }

      // 2. STARTTLS se configurado
      if (encryption.toLowerCase().indexOf('starttls') !== -1) {
        var starttlsRes = sendCmd('STARTTLS')
        if (starttlsRes.status !== 'OK') {
          throw new Error('Falha na negociação STARTTLS: ' + starttlsRes.lines.join(' '))
        }
        conn = $tls.client(conn, {
          insecureSkipVerify: true,
          serverName: host,
        })
        reader = $bufio.newReader(conn)
      }

      // 3. LOGIN
      var safePass = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      var safeUser = user.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      var loginRes = sendCmd('LOGIN "' + safeUser + '" "' + safePass + '"')
      if (loginRes.status !== 'OK') {
        throw new Error('Falha na autenticação IMAP: ' + loginRes.lines.join(' '))
      }

      // 4. SELECT pasta
      var selectRes = sendCmd('SELECT "' + inboxFolder + '"')
      if (selectRes.status !== 'OK') {
        throw new Error(
          'Falha ao selecionar pasta "' + inboxFolder + '": ' + selectRes.lines.join(' '),
        )
      }

      // 5. UID SEARCH UNSEEN
      var uids = []
      var searchRes = sendCmd('UID SEARCH UNSEEN')
      if (searchRes.status === 'OK') {
        for (var i = 0; i < searchRes.lines.length; i++) {
          var sLine = searchRes.lines[i]
          if (sLine.indexOf('* SEARCH') === 0) {
            var parts = sLine.replace('* SEARCH', '').trim().split(/\s+/)
            for (var p = 0; p < parts.length; p++) {
              if (parts[p]) uids.push(parts[p])
            }
          }
        }
      }

      // Fallback: se nada UNSEEN, checar últimos 5 e-mails (idempotência cobre duplicidade)
      if (uids.length === 0) {
        var recentSearch = sendCmd('UID SEARCH ALL')
        if (recentSearch.status === 'OK') {
          var allUids = []
          for (var j = 0; j < recentSearch.lines.length; j++) {
            var aLine = recentSearch.lines[j]
            if (aLine.indexOf('* SEARCH') === 0) {
              var allParts = aLine.replace('* SEARCH', '').trim().split(/\s+/)
              for (var ap = 0; ap < allParts.length; ap++) {
                if (allParts[ap]) allUids.push(allParts[ap])
              }
            }
          }
          if (allUids.length > 0) {
            uids = allUids.slice(Math.max(0, allUids.length - 5))
          }
        }
      }

      // 6. Processar cada e-mail
      for (var u = 0; u < uids.length; u++) {
        var uid = uids[u]
        try {
          var emailData = fetchEmailByUid(uid, u + 1)
          if (!emailData || (!emailData.subject && !emailData.from)) {
            continue
          }

          var result = processEmailMessage(emailData)
          processedCount++

          if (result.status === 'created') {
            createdCount++
            $app
              .logger()
              .info(
                'email_checker_cron: Chamado criado',
                'ticket',
                result.ticket_number,
                'from',
                emailData.from,
              )
          } else if (result.status === 'replied') {
            repliedCount++
            $app
              .logger()
              .info(
                'email_checker_cron: Resposta adicionada',
                'ticket',
                result.ticket_number,
                'from',
                emailData.from,
              )
          } else if (result.status === 'retained') {
            retainedCount++
            $app
              .logger()
              .warn(
                'email_checker_cron: E-mail retido para moderação',
                'retained_id',
                result.retained_id,
                'from',
                emailData.from,
                'domain',
                result.domain,
              )
          } else if (result.status === 'skipped') {
            skippedCount++
          }

          sendCmd('UID STORE ' + uid + ' +FLAGS (\\Seen)')

          if (processedFolder && processedFolder !== inboxFolder) {
            try {
              var copyRes = sendCmd('UID COPY ' + uid + ' "' + processedFolder + '"')
              if (copyRes.status === 'OK') {
                sendCmd('UID STORE ' + uid + ' +FLAGS (\\Deleted)')
              }
            } catch (_) {}
          }
        } catch (itemErr) {
          errors.push('UID ' + uid + ': ' + itemErr.message)
          $app
            .logger()
            .error('email_checker_cron process item error', 'uid', uid, 'err', itemErr.message)
        }
      }

      if (processedFolder && processedFolder !== inboxFolder) {
        try {
          sendCmd('EXPUNGE')
        } catch (_) {}
      }

      try {
        sendCmd('LOGOUT')
      } catch (_) {}
    } finally {
      if (conn) {
        try {
          conn.close()
        } catch (_) {}
      }
    }

    var duration = Date.now() - startTime

    try {
      config.set('last_check_at', new Date().toISOString())
      config.set('last_check_status', 'success')
      config.set('last_check_error', '')
      config.set('last_processed_count', processedCount)
      var prevIngested = config.getInt('total_ingested_count') || 0
      var prevRetained = config.getInt('total_retained_count') || 0
      config.set('total_ingested_count', prevIngested + createdCount + repliedCount)
      config.set('total_retained_count', prevRetained + retainedCount)
      $app.save(config)
    } catch (saveErr) {
      $app.logger().error('email_checker_cron update config error', 'err', saveErr.message)
    }

    var auditStatus = errors.length > 0 && processedCount === 0 ? 'error' : 'success'
    var auditMsg =
      'Varredura automática concluída: ' +
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
  }
})
