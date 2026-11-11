// pocketbase/hooks/ticket_approval_check.js
// Lógos AITSM - Verificação e Criação Automática do Fluxo de Aprovação de Chamados
// Regra do Usuário (v0.0.418):
// 1. A regra de aprovação começa pela EMPRESA (selecionada no topo).
// 2. A unidade de aprovação passa a ser a ATIVIDADE do catálogo (tkt_categories).
// 3. Para cada atividade do catálogo da empresa, escolhe-se o APROVADOR:
//    - Ponto focal cadastrado naquele cliente (client_contacts is_focal_point=true);
//    - Ou aprovador interno (users do sistema).
// 4. Se houver regra ativa para empresa+atividade, o chamado:
//    - Recebe flag approval_hold = true (FICA TRAVADO para atuação da equipe);
//    - Entra em status "Aguardando Aprovação";
//    - Tem solicitação(ões) criadas na coleção 'approvals' para o aprovador.
// 5. Dúvidas não passam por aprovação (regra de usuário).
// 6. Notificações configuráveis (Central de Alertas / in-app):
//    - E-mail ao solicitante/contato (ticket_approval_hold);
//    - E-mail ao aprovador (ticket_approval_request_internal);
//    - Notificação in-app ao aprovador e gestores.
// Autocontido: helpers publicados em globalThis (_g) pelo A0_email_alert_helpers.js
// são re-publicados localmente caso não estejam visíveis neste callback (JSVM).

;(function () {
  var _g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : this || {}

  // ===== Helpers locais (autocontidos, fallback se _g não tiver) =====

  function getConfig(key) {
    if (typeof _g.getEmailAlertConfig === 'function') {
      try {
        return _g.getEmailAlertConfig(key)
      } catch (_) {}
    }
    try {
      var rec = $app.findFirstRecordByFilter('email_alert_settings', 'alert_key = "' + key + '"')
      if (!rec) return null
      return {
        id: rec.id,
        alert_key: rec.getString('alert_key'),
        enabled: rec.getBool('enabled'),
        template_layout: rec.getString('template_layout') || 'modern',
        primary_color: rec.getString('primary_color') || '#D97706',
        subject_template: rec.getString('subject_template') || '',
        header_title: rec.getString('header_title') || '',
        header_subtitle: rec.getString('header_subtitle') || '',
        body_template: rec.getString('body_template') || '',
        footer_text: rec.getString('footer_text') || '',
        show_button: rec.getBool('show_button'),
        button_label: rec.getString('button_label') || 'Acessar',
        button_url_template: rec.getString('button_url_template') || '',
        default_subject_template: rec.getString('default_subject_template') || '',
        default_body_template: rec.getString('default_body_template') || '',
      }
    } catch (_) {
      return null
    }
  }

  function interpolate(tpl, data) {
    if (typeof _g.interpolateEmailTemplate === 'function') {
      try {
        return _g.interpolateEmailTemplate(tpl, data)
      } catch (_) {}
    }
    if (!tpl) return ''
    var result = tpl
    var keys = Object.keys(data || {})
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = data[k] == null ? '' : String(data[k])
      result = result.replace(new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi'), val)
    }
    return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
  }

  function buildHtml(cfg, data) {
    if (typeof _g.buildEmailHtmlFromConfig === 'function') {
      try {
        return _g.buildEmailHtmlFromConfig(cfg, data)
      } catch (_) {}
    }
    return '<div>' + interpolate((cfg && cfg.body_template) || '', data) + '</div>'
  }

  function sendMail(to, subject, html) {
    if (typeof _g.sendSkipCloudMail === 'function') {
      try {
        return _g.sendSkipCloudMail({ to: to, subject: subject, html: html })
      } catch (err) {
        console.error(
          '[ticket_approval_check] sendSkipCloudMail falhou (' +
            (err && err.message ? err.message : String(err)) +
            ')',
        )
        return { success: false }
      }
    }
    try {
      var message = new MailerMessage({
        from: { address: 'noreply@mail.goskip.dev', name: 'Lógos AITSM' },
        to: [{ address: to }],
        subject: subject,
        html: html,
      })
      $app.newMailClient().send(message)
      return { success: true }
    } catch (err2) {
      console.error(
        '[ticket_approval_check] MailClient falhou (' +
          (err2 && err2.message ? err2.message : String(err2)) +
          ')',
      )
      return { success: false }
    }
  }

  function alreadySent(alertKey, refId, recipient) {
    if (typeof _g.hasEmailAlreadyBeenSent === 'function') {
      try {
        return _g.hasEmailAlreadyBeenSent(alertKey, refId, recipient)
      } catch (_) {}
    }
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_sent_logs',
        'alert_key = "' +
          alertKey +
          '" && reference_id = "' +
          refId +
          '" && recipient = "' +
          recipient.toLowerCase() +
          '"',
      )
      return !!rec
    } catch (_) {
      return false
    }
  }

  function recordLog(alertKey, refId, recipient, subject) {
    if (typeof _g.recordEmailSentLog === 'function') {
      try {
        _g.recordEmailSentLog(alertKey, refId, recipient, subject, {
          transport: 'skip_cloud',
        })
        return
      } catch (_) {}
    }
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var log = new Record(col)
      log.set('alert_key', alertKey)
      log.set('reference_id', refId)
      log.set('recipient', String(recipient).trim().toLowerCase())
      log.set('sent_at', new Date().toISOString().replace('T', ' '))
      log.set('subject', subject || '')
      $app.save(log)
    } catch (_) {}
  }

  // Envio por alert_key (config da Central), com anti-duplicidade.
  function sendAlertEmail(alertKey, refId, recipients, subject, data, cfg) {
    if (!cfg || !cfg.enabled) {
      console.log(
        '[ticket_approval_check] e-mail suprimido (alerta desligado) | alert_key=' + alertKey,
      )
      return { sent: false, reason: 'disabled' }
    }
    var sentCount = 0
    var list = Array.isArray(recipients) ? recipients : [recipients]
    for (var i = 0; i < list.length; i++) {
      var to = String(list[i] || '')
        .trim()
        .toLowerCase()
      if (!to || to.indexOf('@') <= 0) continue
      if (refId && alreadySent(alertKey, refId, to)) continue
      var html = buildHtml(cfg, data)
      var res = sendMail(to, subject, html)
      if (res && res.success) {
        recordLog(alertKey, refId, to, subject)
        sentCount++
        console.log(
          '[ticket_approval_check] e-mail enviado | alert_key=' + alertKey + ' | to=' + to,
        )
      }
    }
    return { sent: sentCount > 0, sent_count: sentCount }
  }

  function baseUrl() {
    if (typeof _g.getTicketBaseUrl === 'function') {
      try {
        return _g.getTicketBaseUrl()
      } catch (_) {}
    }
    try {
      var host = $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || ''
      return String(host).replace(/\/+$/, '')
    } catch (_) {
      return ''
    }
  }

  function fmtDate(raw) {
    if (typeof _g.formatTicketDate === 'function') {
      try {
        return _g.formatTicketDate(raw)
      } catch (_) {}
    }
    var d = raw ? new Date(raw) : new Date()
    if (isNaN(d.getTime())) d = new Date()
    return (
      ('0' + d.getDate()).slice(-2) +
      '/' +
      ('0' + (d.getMonth() + 1)).slice(-2) +
      '/' +
      d.getFullYear() +
      ' às ' +
      ('0' + d.getHours()).slice(-2) +
      ':' +
      ('0' + d.getMinutes()).slice(-2)
    )
  }

  // ===== Registro do hook =====

  onRecordAfterCreateSuccess((e) => {
    var ticket = e.record
    var companyId = ticket.getString('company')
    if (!companyId) return e.next()

    var categoryId = ticket.getString('category')
    var subcategoryId = ticket.getString('subcategory')
    var ticketType = ticket.getString('type') || ''
    var ticketPriority = ticket.getString('priority') || ''

    // Regra de usuário: Dúvidas não passam por aprovação
    var typeLower = String(ticketType).toLowerCase()
    if (typeLower === 'duvida' || typeLower === 'dúvida' || typeLower === 'requisição de dúvida') {
      return e.next()
    }

    // Chamados já resolvidos/encerrados/cancelados não são tocados
    var currentStatus = ticket.getString('status') || ''
    var statusLower = String(currentStatus).toLowerCase()
    if (statusLower === 'resolvido' || statusLower === 'encerrado' || statusLower === 'cancelado') {
      return e.next()
    }

    var configs = []
    try {
      configs = $app.findRecordsByFilter('approval_configs', 'active = true', '-created', 200, 0)
    } catch (err) {
      return e.next()
    }
    if (!configs || configs.length === 0) return e.next()

    var matchingConfig = null

    for (var i = 0; i < configs.length; i++) {
      var cfg = configs[i]
      var cfgCompany = cfg.getString('company')
      var cfgClients = cfg.getStringSlice ? cfg.getStringSlice('clients') : []
      var isCompanyMatch = false

      if (cfgCompany) {
        if (cfgCompany === companyId) isCompanyMatch = true
      } else if (cfgClients && cfgClients.length > 0) {
        for (var c = 0; c < cfgClients.length; c++) {
          if (cfgClients[c] === companyId) {
            isCompanyMatch = true
            break
          }
        }
      } else {
        isCompanyMatch = true // regra global
      }

      if (!isCompanyMatch) continue

      var activityId = cfg.getString('activity')

      if (activityId) {
        if (subcategoryId && activityId === subcategoryId) {
          matchingConfig = cfg
          break
        }
        if (categoryId && activityId === categoryId) {
          matchingConfig = cfg
          break
        }
        continue
      }

      // Regras legadas sem atividade
      var reqTypes = []
      try {
        var rawTypes = cfg.get('request_types')
        if (Array.isArray(rawTypes)) {
          reqTypes = rawTypes
        } else if (typeof rawTypes === 'string' && rawTypes.trim()) {
          try {
            var parsed = JSON.parse(rawTypes)
            if (Array.isArray(parsed)) reqTypes = parsed
          } catch (_) {
            reqTypes = [rawTypes]
          }
        }
      } catch (_) {}

      if (reqTypes && reqTypes.length > 0) {
        var typeMatched = false
        for (var t = 0; t < reqTypes.length; t++) {
          if (reqTypes[t] === ticketType) {
            typeMatched = true
            break
          }
        }
        if (!typeMatched) continue
      }

      var requireHigh = cfg.getBool('require_high_priority')
      if (requireHigh) {
        var isHighPriority = ticketPriority === 'Alta' || ticketPriority === 'Crítica'
        if (!isHighPriority) continue
      }

      if (!matchingConfig) {
        matchingConfig = cfg
      }
    }

    if (!matchingConfig) return e.next()

    // Evita duplicar se já houver aprovação pendente para o chamado
    try {
      var existingApp = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + ticket.id + '" && status = "Pendente"',
      )
      if (existingApp) return e.next()
    } catch (_) {}

    var assignedTo = ticket.getString('assigned_to')
    var requesterId = assignedTo || ''
    if (!requesterId && e.auth) {
      requesterId = e.auth.id
    }
    if (!requesterId) {
      try {
        var firstAdmin = $app.findFirstRecordByFilter('users', 'role = "admin"')
        if (firstAdmin) requesterId = firstAdmin.id
      } catch (_) {}
    }
    if (!requesterId) return e.next()

    try {
      var mode = matchingConfig.getString('mode') || 'Individual'
      var timeoutMinutes = matchingConfig.getInt('escalation_timeout_minutes') || 60

      var approverType = matchingConfig.getString('approver_type') || ''
      var approverFocalPointId = matchingConfig.getString('approver_focal_point') || ''
      var approverUserId = matchingConfig.getString('approver_user') || ''

      var focalPointIds = matchingConfig.getStringSlice
        ? matchingConfig.getStringSlice('focal_points')
        : []
      var internalApproverIds = matchingConfig.getStringSlice
        ? matchingConfig.getStringSlice('internal_approvers')
        : []

      var targetList = []

      if (approverType === 'focal_point' && approverFocalPointId) {
        try {
          var fpRec = $app.findRecordById('client_contacts', approverFocalPointId)
          var fpEmail = fpRec.getString('email')
          if (fpEmail) {
            targetList.push({
              type: 'contact',
              id: fpRec.id,
              name: fpRec.getString('full_name') || 'Ponto Focal do Cliente',
              email: fpEmail,
              role: 'client',
            })
          }
        } catch (_) {}
      } else if (approverType === 'internal_user' && approverUserId) {
        try {
          var uRec = $app.findRecordById('users', approverUserId)
          var uEmail = uRec.getString('email')
          if (uEmail) {
            targetList.push({
              type: 'user',
              id: uRec.id,
              name: uRec.getString('name') || 'Aprovador Interno TI',
              email: uEmail,
              role: 'internal',
            })
          }
        } catch (_) {}
      }

      if (targetList.length === 0) {
        var requireClientApproval = matchingConfig.getBool('require_client_approval')
        var requireInternalApproval = matchingConfig.getBool('require_internal_approval')

        if (!requireClientApproval && !requireInternalApproval) {
          if (focalPointIds.length > 0) requireClientApproval = true
          if (internalApproverIds.length > 0) requireInternalApproval = true
        }

        var clientCandidates = []
        for (var fp = 0; fp < focalPointIds.length; fp++) {
          try {
            var contactRec = $app.findRecordById('client_contacts', focalPointIds[fp])
            var cEmail = contactRec.getString('email')
            if (cEmail) {
              clientCandidates.push({
                type: 'contact',
                id: contactRec.id,
                name: contactRec.getString('full_name') || 'Ponto Focal do Cliente',
                email: cEmail,
                role: 'client',
              })
            }
          } catch (_) {}
        }

        if (requireClientApproval && clientCandidates.length === 0) {
          try {
            var companyFps = $app.findRecordsByFilter(
              'client_contacts',
              'client = "' + companyId + '" && is_focal_point = true',
              '-created',
              5,
              0,
            )
            for (var cfp = 0; cfp < companyFps.length; cfp++) {
              var cEmail2 = companyFps[cfp].getString('email')
              if (cEmail2) {
                clientCandidates.push({
                  type: 'contact',
                  id: companyFps[cfp].id,
                  name: companyFps[cfp].getString('full_name') || 'Ponto Focal',
                  email: cEmail2,
                  role: 'client',
                })
              }
            }
          } catch (_) {}
        }

        var internalCandidates = []
        for (var ia = 0; ia < internalApproverIds.length; ia++) {
          try {
            var userRec = $app.findRecordById('users', internalApproverIds[ia])
            var uiEmail = userRec.getString('email')
            if (uiEmail) {
              internalCandidates.push({
                type: 'user',
                id: userRec.id,
                name: userRec.getString('name') || 'Aprovador Interno',
                email: uiEmail,
                role: 'internal',
              })
            }
          } catch (_) {}
        }

        if (requireInternalApproval && internalCandidates.length === 0) {
          try {
            var fallbackUsers = $app.findRecordsByFilter(
              'users',
              'role = "admin" || role = "gestor"',
              '',
              10,
              0,
            )
            for (var fu = 0; fu < fallbackUsers.length; fu++) {
              var fbEmail = fallbackUsers[fu].getString('email')
              if (fbEmail) {
                internalCandidates.push({
                  type: 'user',
                  id: fallbackUsers[fu].id,
                  name: fallbackUsers[fu].getString('name') || 'Gestor Responsável',
                  email: fbEmail,
                  role: 'internal',
                })
              }
            }
          } catch (_) {}
        }

        if (requireClientApproval && clientCandidates.length > 0) {
          if (mode === 'Paralela') {
            for (var cc = 0; cc < clientCandidates.length; cc++) {
              targetList.push(clientCandidates[cc])
            }
          } else {
            targetList.push(clientCandidates[0])
          }
        }

        if (requireInternalApproval && internalCandidates.length > 0) {
          if (mode === 'Paralela') {
            for (var ic = 0; ic < internalCandidates.length; ic++) {
              targetList.push(internalCandidates[ic])
            }
          } else {
            targetList.push(internalCandidates[0])
          }
        }
      }

      if (targetList.length === 0) {
        $app
          .logger()
          .warn(
            'ticket_approval_check: nenhum aprovador encontrado para a regra',
            'config',
            matchingConfig.id,
          )
        return e.next()
      }

      // ===== TRAVAMENTO: flag approval_hold + status Aguardando Aprovação =====
      var oldStatus = ticket.getString('status')
      ticket.set('approval_hold', true)
      ticket.set('status', 'Aguardando Aprovação')
      $app.save(ticket)

      var ticketNumber = ticket.getString('number') || ticket.id
      try {
        var histCol = $app.findCollectionByNameOrId('ticket_history')
        var hist = new Record(histCol)
        hist.set('ticket', ticket.id)
        hist.set('user', requesterId)
        hist.set(
          'action',
          'Chamado colocado em Aguardando Aprovação (travado para atuação — Regra: ' +
            (matchingConfig.getString('description') || 'Aprovação por Atividade') +
            ')',
        )
        hist.set('field', 'status')
        hist.set('old_value', oldStatus)
        hist.set('new_value', 'Aguardando Aprovação')
        $app.save(hist)
      } catch (_) {}

      // ===== Registros de aprovação =====
      var approvalsCol = $app.findCollectionByNameOrId('approvals')
      var now = new Date()

      for (var idx = 0; idx < targetList.length; idx++) {
        var candidate = targetList[idx]
        var appRec = new Record(approvalsCol)
        appRec.set('ticket', ticket.id)
        appRec.set('requester', requesterId)
        appRec.set('status', 'Pendente')
        appRec.set('approval_config', matchingConfig.id)
        appRec.set('approval_role', candidate.role || 'general')

        if (candidate.type === 'user') {
          appRec.set('approver', candidate.id)
        } else {
          appRec.set('contact', candidate.id)
        }

        if (timeoutMinutes > 0) {
          var escalationDeadline = new Date(
            now.getTime() + timeoutMinutes * 60000 * (idx + 1),
          ).toISOString()
          appRec.set('escalation_deadline', escalationDeadline)
        }
        var tokenVal = $security.randomString(32)
        appRec.set('token', tokenVal)
        $app.save(appRec)
      }

      // ===== Dados comuns para e-mails =====
      var ticketTitle = ticket.getString('title') || 'Chamado sem título'
      var requesterName = ticket.getString('requester_name') || 'Solicitante'
      var requesterEmail = (ticket.getString('requester_email') || '').trim()

      if (!requesterEmail && e.auth && e.auth.getString) {
        requesterEmail = (e.auth.getString('email') || '').trim()
      }
      if (!requesterName && e.auth && e.auth.getString) {
        requesterName = e.auth.getString('name') || 'Solicitante'
      }
      if (!requesterEmail) {
        // Fallback: ponto focal do cliente
        try {
          var focal = $app.findFirstRecordByFilter(
            'client_contacts',
            'client = "' + companyId + '" && is_focal_point = true && email != ""',
          )
          if (focal) requesterEmail = focal.getString('email').trim()
        } catch (_) {}
      }

      var companyName = ''
      try {
        var comp = $app.findRecordById('companies', companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      } catch (_) {}

      var activityLabel = matchingConfig.getString('description') || 'Aprovação por atividade'
      try {
        var actId = matchingConfig.getString('activity')
        if (actId) {
          var actRec = $app.findRecordById('tkt_categories', actId)
          if (actRec) {
            activityLabel = actRec.getString('name') || actRec.getString('title') || activityLabel
          }
        }
      } catch (_) {}

      var bUrl = baseUrl()

      // ===== E-mail ao solicitante/contato (configurável) =====
      if (requesterEmail) {
        var cfgHold = getConfig('ticket_approval_hold')
        sendAlertEmail(
          'ticket_approval_hold',
          ticket.id,
          [requesterEmail],
          'Chamado #' +
            ticketNumber +
            ' aguardando aprovação antes da análise e execução - ' +
            ticketTitle,
          {
            chamado_numero: ticketNumber,
            numero: ticketNumber,
            titulo: ticketTitle,
            solicitante: requesterName,
            cliente: requesterName,
            empresa: companyName,
            prioridade: ticketPriority || 'Média',
            data_abertura: fmtDate(ticket.getString('created')),
            justificativa: activityLabel,
            link: bUrl ? bUrl + '/portal/tickets/' + ticket.id : '',
          },
          cfgHold,
        )
      }

      // ===== E-mail ao aprovador + notificação in-app (configuráveis) =====
      var approverEmails = []
      var approverUserIds = []
      for (var aIdx = 0; aIdx < targetList.length; aIdx++) {
        if (targetList[aIdx].email) approverEmails.push(targetList[aIdx].email)
        if (targetList[aIdx].type === 'user' && targetList[aIdx].id)
          approverUserIds.push(targetList[aIdx].id)
      }

      if (approverEmails.length > 0) {
        var cfgReq = getConfig('ticket_approval_request_internal')
        sendAlertEmail(
          'ticket_approval_request_internal',
          ticket.id,
          approverEmails,
          'Aprovação pendente: Chamado #' + ticketNumber + ' - ' + ticketTitle,
          {
            chamado_numero: ticketNumber,
            numero: ticketNumber,
            titulo: ticketTitle,
            aprovador: targetList[0].name || 'Aprovador',
            solicitante: requesterName,
            empresa: companyName,
            prioridade: ticketPriority || 'Média',
            justificativa: activityLabel,
            link: bUrl ? bUrl + '/portal?tab=approvals' : '',
          },
          cfgReq,
        )
      }

      // Notificação in-app ao aprovador do portal (e gestores, para visibilidade)
      try {
        var notifCol = $app.findCollectionByNameOrId('notifications')
        var notifiedIds = {}
        function pushNotif(userId, title, message) {
          if (!userId || notifiedIds[userId]) return
          try {
            var n = new Record(notifCol)
            n.set('user', userId)
            n.set('ticket', ticket.id)
            n.set('title', title)
            n.set('message', message)
            n.set('type', 'Aprovação')
            n.set('read', false)
            $app.save(n)
            notifiedIds[userId] = true
          } catch (_) {}
        }

        for (var aN = 0; aN < targetList.length; aN++) {
          if (targetList[aN].type === 'user' && targetList[aN].id) {
            pushNotif(
              targetList[aN].id,
              'Nova aprovação pendente no portal',
              'Chamado #' + ticketNumber + ' aguarda sua aprovação para iniciar o atendimento',
            )
          }
        }

        var gestores = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          '',
          20,
          0,
        )
        for (var j = 0; j < gestores.length; j++) {
          pushNotif(
            gestores[j].id,
            'Nova aprovação pendente (' +
              (targetList.length > 1
                ? 'Múltipla'
                : targetList[0].role === 'client'
                  ? 'Ponto Focal'
                  : 'Interno') +
              ')',
            'Chamado #' + ticketNumber + ' aguarda aprovação para entrar na fila',
          )
        }
      } catch (_) {}
    } catch (err) {
      $app.logger().error('ticket_approval_check: failed to create approval', 'error', err.message)
    }

    return e.next()
  }, 'tickets')
})()
