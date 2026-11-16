/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Lógos AITSM — Fluxo de Aprovação Automática de Chamados (v0.0.436)
// ----------------------------------------------------------------------------
// PADRÃO OBRIGATÓRIO NESTE MOTOR (Goja JSVM / pool de VMs, padrão provado em
// produção em ticket_created_client_email.js): TODA a lógica e TODOS os
// helpers ficam INLINE dentro do corpo de cada callback. Não existe
// publicação global que funcione aqui — nem função top-level, nem
// globalThis/_g, nem IIFE: os ticks das rodadas anteriores (v0.0.432/433)
// provaram "Object has no member _ticketApprovalRunCheck" e
// "_g.runCheck=false (loaded=undefined)" em todos esses formatos.
//
// PORTANTO: a checagem de aprovação (runCheck) e o despacho de e-mail pela
// Central de Alertas (sendSystemAlertEmail) estão DUPLICADOS dentro de cada
// callback. Nada neste arquivo é referenciado entre callbacks.
//
// Regras de negócio (validadas):
// - Regra de aprovação casa por EMPRESA (approval_configs.company, legado
//   clients[], ou global) + ATIVIDADE (approval_configs.activity = subcategory
//   OU category do chamado; regras legadas sem atividade casam por
//   request_types/prioridade). request_types vazio vale para qualquer tipo.
// - Dúvidas não passam por aprovação; chamados encerrados não são tocados.
// - Para cada aprovador da regra (pontos focais client_contacts e/ou
//   aprovadores internos users) nasce UM registro em `approvals`
//   (status Pendente, token público, target_contact/target_email, approver).
//   Se já existe pendência "Pendente" para o chamado, nada é criado.
// - O chamado é travado: approval_hold=true e status "Aguardando Aprovação".
// - E-mails pela Central de Alertas (email_alert_settings, transporte Skip
//   Cloud $app.newMailClient), respeitando os interruptores:
//   ticket_approval_hold (solicitante) e ticket_approval_request_internal
//   (aprovador). Notificação in-app respeita ticket_approval_created_notify.
// - Envio manual do operador (rota send-approval) apenas força $app.save no
//   chamado — o callback after-update dispara a checagem. Nada é chamado por
//   referência.
// ============================================================================

// ============================================================================
// GATILHO 1/2 — after-create de tickets
// ============================================================================
onRecordAfterCreateSuccess(function (e) {
  var ticket = e.record
  var app = e.app || $app
  var ticketNumber = ''
  try {
    ticketNumber = (ticket && (ticket.getString('number') || ticket.id)) || 'desconhecido'
  } catch (_) {
    ticketNumber = 'desconhecido'
  }
  console.log('[APPROVAL_CHECK] after-create: processando chamado #' + ticketNumber)

  // ==========================================================================
  // HELPERS AUTOCONTIDOS (locais deste callback — sem referências externas)
  // ==========================================================================

  function localParseJsonList(rec, field) {
    var out = []
    try {
      var raw = rec.get(field)
      if (Array.isArray(raw)) out = raw
      else if (typeof raw === 'string' && raw.trim()) {
        try {
          var parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) out = parsed
          else out = [raw]
        } catch (_) {
          out = [raw]
        }
      }
    } catch (_) {}
    var clean = []
    for (var k = 0; k < out.length; k++) {
      if (out[k]) clean.push(String(out[k]))
    }
    return clean
  }

  function localIdList(rec, keyAll, keyLegacy, keySingle) {
    var list = localParseJsonList(rec, keyAll)
    if (list.length === 0) list = localParseJsonList(rec, keyLegacy)
    if (list.length === 0) {
      try {
        var single = rec.getString(keySingle)
        if (single) list = [single]
      } catch (_) {}
    }
    return list
  }

  function localGenToken() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    var tok = ''
    for (var s = 0; s < 24; s++) {
      tok += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return tok
  }

  function localStatusIsClosed(st) {
    var sLower = String(st || '').toLowerCase()
    return (
      sLower === 'resolvido' ||
      sLower === 'encerrado' ||
      sLower === 'cancelado' ||
      sLower === 'fechado'
    )
  }

  function localTypeIsDuvida(t) {
    var typeLower = String(t || '').toLowerCase()
    return typeLower === 'duvida' || typeLower === 'dúvida' || typeLower === 'requisição de dúvida'
  }

  function localNowIso() {
    return new Date().toISOString()
  }

  function localEscDeadline(minutes) {
    var m = minutes > 0 ? minutes : 60
    return new Date(Date.now() + m * 60000).toISOString()
  }

  function localBaseUrl() {
    try {
      var host =
        $os.getenv('PUBLIC_URL') ||
        $os.getenv('APP_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        $os.getenv('SITE_URL') ||
        ''
      if (host) return host.replace(/\/+$/, '')
    } catch (_) {}
    return ''
  }

  // ---- Despacho de e-mail pela Central de Alertas (autocontido) -----------
  var SKIP_CLOUD_SENDER_EMAIL = 'noreply@mail.goskip.dev'
  var SKIP_CLOUD_SENDER_NAME = 'Lógos AITSM'

  function localGetEmailAlertConfig(alertKey) {
    if (!alertKey) return null
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + alertKey + '"',
      )
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
        is_customized: rec.getBool('is_customized'),
        default_subject_template: rec.getString('default_subject_template') || '',
        default_body_template: rec.getString('default_body_template') || '',
      }
    } catch (err) {
      console.error(
        '[APPROVAL_CHECK] localGetEmailAlertConfig: falha ao ler email_alert_settings | ' +
          (err && err.message ? err.message : String(err)),
      )
      return null
    }
  }

  function localIsAlertEnabled(alertKey) {
    var cfg = localGetEmailAlertConfig(alertKey)
    return Boolean(cfg && cfg.enabled)
  }

  function localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient) {
    if (!alertKey || !referenceId || !recipient) return false
    try {
      var cleanAlertKey = String(alertKey).trim().replace(/"/g, '\\"')
      var cleanRefId = String(referenceId).trim().replace(/"/g, '\\"')
      var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
      var rec = null
      try {
        rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "' +
            cleanAlertKey +
            '" && reference_id = "' +
            cleanRefId +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
      } catch (_) {
        return false
      }
      return Boolean(rec)
    } catch (err) {
      console.warn(
        '[APPROVAL_CHECK] falha na verificação de duplicidade (' +
          (err && err.message ? err.message : String(err)) +
          ') — prosseguindo com envio',
      )
      return false
    }
  }

  function localRecordEmailSentLog(alertKey, referenceId, recipient, subject, meta) {
    if (!alertKey || !referenceId || !recipient) return
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var log = new Record(col)
      log.set('alert_key', String(alertKey).trim())
      log.set('reference_id', String(referenceId).trim())
      log.set('recipient', String(recipient).trim().toLowerCase())
      log.set('sent_at', new Date().toISOString().replace('T', ' '))
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      console.warn(
        '[APPROVAL_CHECK] falha ao salvar log em email_sent_logs | ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }

  function localInterpolateTemplate(template, data) {
    if (!template) return ''
    var normalizedData = {}
    if (data && typeof data === 'object') {
      var inKeys = Object.keys(data)
      for (var j = 0; j < inKeys.length; j++) {
        normalizedData[inKeys[j]] = data[inKeys[j]]
      }
    }
    if (normalizedData.chamado_numero && !normalizedData.numero) {
      normalizedData.numero = normalizedData.chamado_numero
    }
    if (normalizedData.numero && !normalizedData.chamado_numero) {
      normalizedData.chamado_numero = normalizedData.numero
    }
    if (normalizedData.cliente && !normalizedData.solicitante) {
      normalizedData.solicitante = normalizedData.cliente
    }
    if (normalizedData.solicitante && !normalizedData.cliente) {
      normalizedData.cliente = normalizedData.solicitante
    }
    if (normalizedData.responsavel && !normalizedData.operador) {
      normalizedData.operador = normalizedData.responsavel
    }
    if (normalizedData.operador && !normalizedData.responsavel) {
      normalizedData.responsavel = normalizedData.operador
    }
    var result = template
    var keys = Object.keys(normalizedData)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = normalizedData[k] == null ? '' : String(normalizedData[k])
      var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
      result = result.replace(regex, val)
    }
    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
    return result
  }

  function localBuildEmailHtmlFromConfig(cfg, data) {
    var primaryColor = (cfg && cfg.primary_color) || '#D97706'
    var layout = (cfg && cfg.template_layout) || 'modern'
    var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
    var headerSubtitle =
      (cfg && cfg.header_subtitle) || 'Sistema Inteligente de Gestão de Serviços de TI'
    var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Central de Serviços Inteligente'

    var bodyContent = localInterpolateTemplate((cfg && cfg.body_template) || '', data)
    var buttonLabel = localInterpolateTemplate((cfg && cfg.button_label) || 'Acessar', data)
    var buttonUrl = localInterpolateTemplate((cfg && cfg.button_url_template) || '', data)
    var showButton = Boolean(cfg && cfg.show_button && buttonUrl)

    var buttonHtml = ''
    if (showButton) {
      buttonHtml =
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
        '<tr><td align="center" style="border-radius: 6px; background-color: ' +
        primaryColor +
        ';">' +
        '<a href="' +
        buttonUrl +
        '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; display: inline-block; font-weight: 600;">' +
        buttonLabel +
        '</a></td></tr></table>'
    }

    if (layout === 'minimal') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f9fafb;color:#111827;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">' +
        '<tr><td style="padding:24px 32px;border-bottom:2px solid ' +
        primaryColor +
        ';"><span style="font-size:20px;font-weight:800;color:#111827;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">' + headerSubtitle + '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:32px;line-height:1.6;font-size:15px;color:#374151;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:20px 32px;background-color:#f9fafb;font-size:12px;color:#9ca3af;text-align:center;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    if (layout === 'corporate') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#0f172a;color:#0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.15);">' +
        '<tr><td style="padding:28px 36px;background-color:#17181C;border-bottom:4px solid ' +
        primaryColor +
        ';text-align:left;"><span style="font-size:22px;font-weight:900;color:#FCD34D;letter-spacing:0.5px;text-transform:uppercase;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:6px 0 0 0;font-size:13px;color:#e2e8f0;font-weight:400;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:36px;line-height:1.7;font-size:15px;color:#1e293b;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:22px 36px;background-color:#f1f5f9;font-size:12px;color:#64748b;text-align:center;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    // layout 'modern' (padrão)
    return (
      '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;">' +
      '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">' +
      '<tr><td style="padding:28px 32px;background:linear-gradient(135deg,#17181C 0%,#262930 100%);border-bottom:3px solid ' +
      primaryColor +
      ';text-align:left;"><span style="font-size:20px;font-weight:800;color:#FCD34D;letter-spacing:-0.5px;">' +
      headerTitle +
      '</span>' +
      (headerSubtitle
        ? '<p style="margin:4px 0 0 0;font-size:13px;color:#cbd5e1;">' + headerSubtitle + '</p>'
        : '') +
      '</td></tr>' +
      '<tr><td style="padding:32px;line-height:1.65;font-size:15px;color:#334155;">' +
      bodyContent +
      buttonHtml +
      '</td></tr>' +
      '<tr><td style="padding:22px 32px;background-color:#f8fafc;font-size:12px;color:#64748b;text-align:center;">' +
      footerText +
      '</td></tr></table></body></html>'
    )
  }

  function localSendSystemAlertEmail(opts) {
    if (!opts) return { sent: false, reason: 'opts_missing' }
    var alertKey = opts.alert_key
    var referenceId = opts.reference_id || ''

    var rawRecipients = []
    if (Array.isArray(opts.recipients)) rawRecipients = opts.recipients
    else if (Array.isArray(opts.recipient)) rawRecipients = opts.recipient
    else if (opts.recipient) rawRecipients = [opts.recipient]

    var recipients = []
    var seenRecipients = {}
    for (var rIdx = 0; rIdx < rawRecipients.length; rIdx++) {
      var rClean = String(rawRecipients[rIdx] || '')
        .trim()
        .toLowerCase()
      if (rClean && rClean.indexOf('@') > 0 && !seenRecipients[rClean]) {
        seenRecipients[rClean] = true
        recipients.push(rClean)
      }
    }

    if (recipients.length === 0) {
      console.error(
        '[APPROVAL_CHECK] localSendSystemAlertEmail: envio ABORTADO — nenhum destinatário válido | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'recipient_missing' }
    }

    var cfg = localGetEmailAlertConfig(alertKey)
    if (!cfg) {
      console.error(
        '[APPROVAL_CHECK] localSendSystemAlertEmail: envio ABORTADO — configuração não encontrada | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'alert_config_missing', alert_key: alertKey }
    }

    if (!cfg.enabled) {
      console.log(
        '[APPROVAL_CHECK] e-mail SUPRIMIDO — alerta DESLIGADO na Central | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
    }

    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      opts.subject ||
      'Notificação Lógos AITSM'
    var subject = localInterpolateTemplate(rawSubject, data)

    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var htmlContent = localBuildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || localInterpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    var senderAddress = SKIP_CLOUD_SENDER_EMAIL
    var senderName = SKIP_CLOUD_SENDER_NAME
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
    } catch (_) {}

    var sentCount = 0
    var skippedDuplicates = 0
    var errors = []

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i]

      if (referenceId && localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
        skippedDuplicates++
        continue
      }

      try {
        var message = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: recipient }],
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })
        var client = $app.newMailClient()
        client.send(message)

        if (referenceId) {
          localRecordEmailSentLog(alertKey, referenceId, recipient, subject, {
            template_layout: cfg.template_layout,
            primary_color: cfg.primary_color,
            transport: 'skip_cloud',
          })
        }

        sentCount++
        console.log(
          '[APPROVAL_CHECK] e-mail enviado via Skip Cloud | alert_key=' +
            alertKey +
            ' | destinatário=' +
            recipient,
        )
      } catch (err) {
        var errDesc = err && err.message ? err.message : String(err)
        errors.push({ recipient: recipient, error: errDesc })
        console.error(
          '[APPROVAL_CHECK] FALHA no envio Skip Cloud | alert_key=' +
            String(alertKey || '') +
            ' | destinatário=' +
            recipient +
            ' | motivo: ' +
            errDesc,
        )
      }
    }

    if (sentCount > 0) {
      return {
        sent: true,
        sent_count: sentCount,
        skipped_duplicates: skippedDuplicates,
        errors: errors,
      }
    }
    if (skippedDuplicates > 0 && errors.length === 0) {
      return { sent: false, reason: 'already_sent', skipped_duplicates: skippedDuplicates }
    }
    return {
      sent: false,
      reason: errors.length > 0 ? 'send_failed' : 'no_recipients_processed',
      errors: errors,
    }
  }

  // ==========================================================================
  // CHECAGEM DE APROVAÇÃO — lógica completa, inline (aplicável a create/update)
  // ==========================================================================
  function localRunApprovalCheck(curApp, curTicket, auth) {
    if (!curTicket) return null
    if (!curApp) curApp = $app

    var companyId = curTicket.getString('company')
    if (!companyId) return null

    var categoryId = curTicket.getString('category') || ''
    var subcategoryId = curTicket.getString('subcategory') || ''
    var ticketType = curTicket.getString('type') || ''
    var ticketPriority = curTicket.getString('priority') || ''

    // Chamados encerrados não são tocados
    if (localStatusIsClosed(curTicket.getString('status'))) return null

    // Dúvidas não passam por aprovação
    if (localTypeIsDuvida(ticketType)) return null

    // Já existe pendência Pendente para o chamado? Não duplica.
    var existingApp = null
    try {
      existingApp = curApp.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + curTicket.id + '" && status = "Pendente"',
      )
    } catch (_) {}
    if (existingApp) return null

    // Casamento da regra empresa + atividade
    var configs = []
    try {
      configs = curApp.findRecordsByFilter('approval_configs', 'active = true', '-created', 200, 0)
    } catch (err) {
      console.error('[APPROVAL_CHECK] falha ao listar approval_configs: ' + err.message)
      return null
    }
    if (!configs || configs.length === 0) return null

    var matchingConfig = null
    for (var i = 0; i < configs.length; i++) {
      var cfg = configs[i]
      var cfgCompany = cfg.getString('company')
      var cfgClients = localParseJsonList(cfg, 'clients')
      var isCompanyMatch = false
      if (cfgCompany) {
        if (cfgCompany === companyId) isCompanyMatch = true
      } else if (cfgClients.length > 0) {
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
        var activityMatched =
          (subcategoryId && activityId === subcategoryId) ||
          (categoryId && activityId === categoryId)
        if (!activityMatched) continue

        var reqTypesAct = localParseJsonList(cfg, 'request_types')
        if (reqTypesAct.length > 0 && reqTypesAct.indexOf(ticketType) < 0) continue

        matchingConfig = cfg
        break
      }

      // Regras legadas sem atividade
      var reqTypes = localParseJsonList(cfg, 'request_types')
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

      if (!matchingConfig) matchingConfig = cfg
    }

    if (!matchingConfig) return null

    // =======================================================================
    // CRIAÇÃO DA PENDÊNCIA
    // =======================================================================
    var ticketNumber = curTicket.getString('number') || curTicket.id
    var ticketTitle = curTicket.getString('title') || 'Chamado sem título'
    console.log(
      '[APPROVAL_CHECK] regra casa para #' +
        ticketNumber +
        ' (config=' +
        matchingConfig.id +
        ') — criando pendência de aprovação',
    )

    // ---- approvals.requester (relation REQUIRED → users) ----
    var requesterId = ''
    var requesterEmail = (curTicket.getString('requester_email') || '').trim()
    var requesterName = (curTicket.getString('requester_name') || '').trim() || 'Solicitante'
    if (requesterEmail) {
      try {
        var uByEmail = curApp.findFirstRecordByFilter(
          'users',
          'email = "' + requesterEmail.toLowerCase().replace(/"/g, '\\"') + '"',
        )
        if (uByEmail) requesterId = uByEmail.id
      } catch (_) {}
    }
    if (!requesterId && auth && auth.id) requesterId = auth.id
    if (!requesterId) {
      try {
        var uCompany = curApp.findFirstRecordByFilter('users', 'company = "' + companyId + '"')
        if (uCompany) requesterId = uCompany.id
      } catch (_) {}
    }
    if (!requesterId) {
      var assignedId = curTicket.getString('assigned_to')
      if (assignedId) requesterId = assignedId
    }
    if (!requesterId) {
      try {
        var uAdmin = curApp.findFirstRecordByFilter('users', 'role = "admin"')
        if (uAdmin) requesterId = uAdmin.id
      } catch (_) {}
    }
    if (!requesterId) {
      console.error(
        '[APPROVAL_CHECK] ABORTADO para #' +
          ticketNumber +
          ' — nenhum usuário disponível para approvals.requester (relation obrigatória)',
      )
      return null
    }

    // ---- aprovadores da regra (múltiplos, mig 0163; fallback aos legados) ----
    var focalIds = localIdList(
      matchingConfig,
      'focal_points_all',
      'focal_points',
      'approver_focal_point',
    )
    var internalIds = localIdList(
      matchingConfig,
      'internal_approvers_all',
      'internal_approvers',
      'approver_user',
    )
    if (focalIds.length === 0 && internalIds.length === 0) {
      console.warn(
        '[APPROVAL_CHECK] regra ' +
          matchingConfig.id +
          ' sem aprovador configurado — nada a criar para #' +
          ticketNumber,
      )
      return null
    }

    var mode = matchingConfig.getString('mode') || 'Individual'
    var escDeadline = localEscDeadline(matchingConfig.getInt('escalation_timeout_minutes'))

    var approvalsCol
    try {
      approvalsCol = curApp.findCollectionByNameOrId('approvals')
    } catch (colErr) {
      console.error('[APPROVAL_CHECK] collection approvals não encontrada: ' + colErr.message)
      return null
    }

    var createdApprovals = []
    var approverEmails = []
    var notifyUserIds = []

    // ---- cria uma pendência por aprovador (regra "basta um" decide na 1ª decisão) ----
    function createOneApproval(role, contactRec, userRec) {
      var rec = new Record(approvalsCol)
      rec.set('ticket', curTicket.id)
      rec.set('requester', requesterId)
      rec.set('type', 'Outros')
      rec.set(
        'justification',
        'Atividade "' +
          (curTicket.getString('service') || ticketTitle) +
          '" requer aprovação conforme regra cadastrada (empresa + atividade).',
      )
      rec.set('status', 'Pendente')
      rec.set('token', localGenToken())
      rec.set('approval_config', matchingConfig.id)
      rec.set('stage', 1)
      rec.set('mode', mode)
      rec.set('escalation_deadline', escDeadline)
      rec.set('approval_role', role)
      if (contactRec) {
        rec.set('target_contact', contactRec.id)
        var cEmail = (contactRec.getString('email') || '').trim()
        if (cEmail) rec.set('target_email', cEmail)
      }
      if (userRec) rec.set('approver', userRec.id)
      curApp.save(rec)
      return rec
    }

    for (var f = 0; f < focalIds.length; f++) {
      try {
        var contact = curApp.findRecordById('client_contacts', focalIds[f])
        var contactUser = null
        try {
          var cuId = contact.getString('user')
          if (cuId) contactUser = curApp.findRecordById('users', cuId)
        } catch (_) {}
        var created = createOneApproval('client', contact, contactUser)
        createdApprovals.push(created)
        var cMail = (contact.getString('email') || '').trim().toLowerCase()
        if (cMail) approverEmails.push(cMail)
        if (contactUser && contactUser.id) notifyUserIds.push(contactUser.id)
      } catch (errF) {
        console.error(
          '[APPROVAL_CHECK] falha ao criar aprovação do ponto focal ' +
            focalIds[f] +
            ' | ' +
            (errF && errF.message ? errF.message : String(errF)),
        )
      }
    }

    for (var n = 0; n < internalIds.length; n++) {
      try {
        var iUser = curApp.findRecordById('users', internalIds[n])
        var createdInt = createOneApproval('internal', null, iUser)
        createdApprovals.push(createdInt)
        var iMail = (iUser.getString('email') || '').trim().toLowerCase()
        if (iMail) approverEmails.push(iMail)
        notifyUserIds.push(iUser.id)
      } catch (errI) {
        console.error(
          '[APPROVAL_CHECK] falha ao criar aprovação interna ' +
            internalIds[n] +
            ' | ' +
            (errI && errI.message ? errI.message : String(errI)),
        )
      }
    }

    if (createdApprovals.length === 0) {
      console.error('[APPROVAL_CHECK] nenhuma pendência criada para #' + ticketNumber)
      return null
    }

    var statusBefore = String(curTicket.getString('status') || '')

    // ---- nomes dos aprovadores (rastreabilidade no histórico) ----
    var approverNames = []
    for (var an = 0; an < createdApprovals.length; an++) {
      var aName = ''
      try {
        var apId = createdApprovals[an].getString('approver')
        if (apId) aName = (curApp.findRecordById('users', apId).getString('name') || '').trim()
      } catch (_) {}
      if (!aName) {
        try {
          var tcId = createdApprovals[an].getString('target_contact')
          if (tcId)
            aName = (curApp.findRecordById('client_contacts', tcId).getString('name') || '').trim()
        } catch (_) {}
      }
      if (!aName) {
        try {
          aName = (createdApprovals[an].getString('target_email') || '').trim()
        } catch (_) {}
      }
      if (aName && approverNames.indexOf(aName) < 0) approverNames.push(aName)
    }
    var approverLabel = approverNames.length > 0 ? approverNames.join(', ') : 'aprovador da regra'

    // ---- trava o chamado: approval_hold + status Aguardando Aprovação + PAUSA DE SLA ----
    var nowIsoHold = new Date().toISOString()
    try {
      // SLA Resposta e SLA Solução param de contar: grava a pausa em sla_pauses
      if (!curTicket.getBool('sla_paused')) {
        try {
          var pauseColHold = curApp.findCollectionByNameOrId('sla_pauses')
          var pauseRecHold = new Record(pauseColHold)
          pauseRecHold.set('ticket', curTicket.id)
          pauseRecHold.set('reason', 'Aguardando Aprovação')
          pauseRecHold.set(
            'justification',
            'Chamado aguardando aprovação (regra empresa + atividade).',
          )
          pauseRecHold.set('paused_by', requesterId)
          pauseRecHold.set('paused_at', nowIsoHold)
          curApp.save(pauseRecHold)
        } catch (errPause) {
          console.error(
            '[APPROVAL_CHECK] falha ao gravar pausa de SLA: ' +
              (errPause && errPause.message ? errPause.message : String(errPause)),
          )
        }
      }
      curTicket.set('approval_hold', true)
      curTicket.set('status', 'Aguardando Aprovação')
      curTicket.set('sla_paused', true)
      curTicket.set('sla_status', 'Pausado')
      curApp.save(curTicket)
      console.log(
        '[APPROVAL_CHECK] chamado #' +
          ticketNumber +
          ' travado: approval_hold=true, status=Aguardando Aprovação',
      )
    } catch (errHold) {
      console.error(
        '[APPROVAL_CHECK] FALHA ao travar chamado #' +
          ticketNumber +
          ' | ' +
          (errHold && errHold.message ? errHold.message : String(errHold)),
      )
    }

    // ---- histórico do chamado (cita os aprovadores — rastreabilidade) ----
    try {
      var historyCol = curApp.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', curTicket.id)
      hist.set('user', requesterId)
      hist.set(
        'action',
        'Chamado enviado para aprovação do aprovador ' +
          approverLabel +
          ' (regra empresa + atividade). ' +
          createdApprovals.length +
          ' pendência(s) criada(s) — status "Aguardando Aprovação". SLA (resposta e solução) pausado durante a espera.',
      )
      hist.set('field', 'status')
      hist.set('old_value', statusBefore || 'Atribuído')
      hist.set('new_value', 'Aguardando Aprovação')
      curApp.save(hist)
    } catch (errHist) {
      console.warn('[APPROVAL_CHECK] falha ao gravar histórico: ' + errHist.message)
    }

    // ---- e-mails via Central de Alertas (interruptores controlam envio) ----
    var portalLink = localBaseUrl() + '/portal'
    var companyName = ''
    try {
      var comp = curApp.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var baseData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      solicitante: requesterName,
      cliente: requesterName,
      empresa: companyName,
      aprovador: requesterName,
      responsavel: requesterName,
      atividade: curTicket.getString('service') || ticketTitle,
      link: portalLink,
    }

    // (a) solicitante: chamado aguardando aprovação (ticket_approval_hold)
    if (requesterEmail) {
      try {
        var r1 = localSendSystemAlertEmail({
          alert_key: 'ticket_approval_hold',
          reference_id: curTicket.id + ':hold',
          recipients: [requesterEmail],
          subject: 'Chamado #' + ticketNumber + ' aguardando aprovação - ' + ticketTitle,
          data: baseData,
        })
        console.log(
          '[APPROVAL_CHECK] e-mail solicitante (ticket_approval_hold): ' + JSON.stringify(r1),
        )
      } catch (errE1) {
        console.error(
          '[APPROVAL_CHECK] erro e-mail solicitante: ' +
            (errE1 && errE1.message ? errE1.message : String(errE1)),
        )
      }
    }

    // (b) aprovador(es): solicitação de aprovação (ticket_approval_request_internal)
    if (approverEmails.length > 0) {
      try {
        var r2 = localSendSystemAlertEmail({
          alert_key: 'ticket_approval_request_internal',
          reference_id: curTicket.id + ':request',
          recipients: approverEmails,
          subject: 'Aprovação pendente: Chamado #' + ticketNumber + ' - ' + ticketTitle,
          data: baseData,
        })
        console.log(
          '[APPROVAL_CHECK] e-mail aprovador (ticket_approval_request_internal): ' +
            JSON.stringify(r2),
        )
      } catch (errE2) {
        console.error(
          '[APPROVAL_CHECK] erro e-mail aprovador: ' +
            (errE2 && errE2.message ? errE2.message : String(errE2)),
        )
      }
    }

    // (c) notificação in-app (type Aprovação), condicionada a ticket_approval_created_notify
    if (notifyUserIds.length > 0 && localIsAlertEnabled('ticket_approval_created_notify')) {
      var notifsCol = null
      try {
        notifsCol = curApp.findCollectionByNameOrId('notifications')
      } catch (_) {}
      if (notifsCol) {
        var seenUsers = {}
        for (var uIdx = 0; uIdx < notifyUserIds.length; uIdx++) {
          var uid = notifyUserIds[uIdx]
          if (!uid || seenUsers[uid]) continue
          seenUsers[uid] = true
          try {
            var notif = new Record(notifsCol)
            notif.set('user', uid)
            notif.set('ticket', curTicket.id)
            notif.set('title', 'Aprovação pendente — #' + ticketNumber)
            notif.set(
              'message',
              'O chamado #' +
                ticketNumber +
                ' (' +
                ticketTitle +
                ') aguarda sua aprovação para liberar o atendimento.',
            )
            notif.set('type', 'Aprovação')
            notif.set('read', false)
            curApp.save(notif)
          } catch (errN) {
            console.warn(
              '[APPROVAL_CHECK] falha na notificação in-app: ' +
                (errN && errN.message ? errN.message : String(errN)),
            )
          }
        }
      }
    } else if (notifyUserIds.length > 0) {
      console.log(
        '[APPROVAL_CHECK] notificação in-app suprimida (ticket_approval_created_notify desligado)',
      )
    }

    console.log(
      '[APPROVAL_CHECK] fluxo concluído para #' +
        ticketNumber +
        ' — ' +
        createdApprovals.length +
        ' pendência(s), ' +
        approverEmails.length +
        ' aprovador(es) por e-mail',
    )

    return createdApprovals[0]
  }

  // ==========================================================================
  // EXECUÇÃO
  // ==========================================================================
  try {
    if (!ticket) return e.next()
    var rec = ticket
    if (rec.getBool('approval_hold')) return e.next()
    if (localStatusIsClosed(rec.getString('status'))) return e.next()
    var found = localRunApprovalCheck(app, rec, e.auth)
    if (found) {
      console.log('[APPROVAL_CHECK] after-create: pendência criada (' + found.id + ')')
    } else {
      console.log('[APPROVAL_CHECK] after-create: nenhuma regra casou — nada criado')
    }
  } catch (errHook) {
    console.error(
      '[APPROVAL_CHECK] after-create: erro no chamado #' +
        ticketNumber +
        ' | ' +
        (errHook && errHook.message ? errHook.message : String(errHook)),
    )
  }
  return e.next()
}, 'tickets')

// ============================================================================
// GATILHO 2/2 — after-update de tickets (recheck pós-triagem / atividade alterada)
// ============================================================================
onRecordAfterUpdateSuccess(function (e) {
  var rec = e.record
  var app = e.app || $app
  var ticketNumber = ''
  try {
    ticketNumber = (rec && (rec.getString('number') || rec.id)) || 'desconhecido'
  } catch (_) {
    ticketNumber = 'desconhecido'
  }

  // ==========================================================================
  // HELPERS AUTOCONTIDOS (locais deste callback — cópia exata dos do create)
  // ==========================================================================

  function localParseJsonList(recL, field) {
    var out = []
    try {
      var raw = recL.get(field)
      if (Array.isArray(raw)) out = raw
      else if (typeof raw === 'string' && raw.trim()) {
        try {
          var parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) out = parsed
          else out = [raw]
        } catch (_) {
          out = [raw]
        }
      }
    } catch (_) {}
    var clean = []
    for (var k = 0; k < out.length; k++) {
      if (out[k]) clean.push(String(out[k]))
    }
    return clean
  }

  function localIdList(recL, keyAll, keyLegacy, keySingle) {
    var list = localParseJsonList(recL, keyAll)
    if (list.length === 0) list = localParseJsonList(recL, keyLegacy)
    if (list.length === 0) {
      try {
        var single = recL.getString(keySingle)
        if (single) list = [single]
      } catch (_) {}
    }
    return list
  }

  function localGenToken() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    var tok = ''
    for (var s = 0; s < 24; s++) {
      tok += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return tok
  }

  function localStatusIsClosed(st) {
    var sLower = String(st || '').toLowerCase()
    return (
      sLower === 'resolvido' ||
      sLower === 'encerrado' ||
      sLower === 'cancelado' ||
      sLower === 'fechado'
    )
  }

  function localTypeIsDuvida(t) {
    var typeLower = String(t || '').toLowerCase()
    return typeLower === 'duvida' || typeLower === 'dúvida' || typeLower === 'requisição de dúvida'
  }

  function localEscDeadline(minutes) {
    var m = minutes > 0 ? minutes : 60
    return new Date(Date.now() + m * 60000).toISOString()
  }

  function localBaseUrl() {
    try {
      var host =
        $os.getenv('PUBLIC_URL') ||
        $os.getenv('APP_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        $os.getenv('SITE_URL') ||
        ''
      if (host) return host.replace(/\/+$/, '')
    } catch (_) {}
    return ''
  }

  // ---- Despacho de e-mail pela Central de Alertas (autocontido) -----------
  var SKIP_CLOUD_SENDER_EMAIL = 'noreply@mail.goskip.dev'
  var SKIP_CLOUD_SENDER_NAME = 'Lógos AITSM'

  function localGetEmailAlertConfig(alertKey) {
    if (!alertKey) return null
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + alertKey + '"',
      )
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
        is_customized: rec.getBool('is_customized'),
        default_subject_template: rec.getString('default_subject_template') || '',
        default_body_template: rec.getString('default_body_template') || '',
      }
    } catch (err) {
      console.error(
        '[APPROVAL_CHECK] localGetEmailAlertConfig: falha ao ler email_alert_settings | ' +
          (err && err.message ? err.message : String(err)),
      )
      return null
    }
  }

  function localIsAlertEnabled(alertKey) {
    var cfg = localGetEmailAlertConfig(alertKey)
    return Boolean(cfg && cfg.enabled)
  }

  function localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient) {
    if (!alertKey || !referenceId || !recipient) return false
    try {
      var cleanAlertKey = String(alertKey).trim().replace(/"/g, '\\"')
      var cleanRefId = String(referenceId).trim().replace(/"/g, '\\"')
      var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
      var rec = null
      try {
        rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "' +
            cleanAlertKey +
            '" && reference_id = "' +
            cleanRefId +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
      } catch (_) {
        return false
      }
      return Boolean(rec)
    } catch (err) {
      console.warn(
        '[APPROVAL_CHECK] falha na verificação de duplicidade (' +
          (err && err.message ? err.message : String(err)) +
          ') — prosseguindo com envio',
      )
      return false
    }
  }

  function localRecordEmailSentLog(alertKey, referenceId, recipient, subject, meta) {
    if (!alertKey || !referenceId || !recipient) return
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var log = new Record(col)
      log.set('alert_key', String(alertKey).trim())
      log.set('reference_id', String(referenceId).trim())
      log.set('recipient', String(recipient).trim().toLowerCase())
      log.set('sent_at', new Date().toISOString().replace('T', ' '))
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      console.warn(
        '[APPROVAL_CHECK] falha ao salvar log em email_sent_logs | ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }

  function localInterpolateTemplate(template, data) {
    if (!template) return ''
    var normalizedData = {}
    if (data && typeof data === 'object') {
      var inKeys = Object.keys(data)
      for (var j = 0; j < inKeys.length; j++) {
        normalizedData[inKeys[j]] = data[inKeys[j]]
      }
    }
    if (normalizedData.chamado_numero && !normalizedData.numero) {
      normalizedData.numero = normalizedData.chamado_numero
    }
    if (normalizedData.numero && !normalizedData.chamado_numero) {
      normalizedData.chamado_numero = normalizedData.numero
    }
    if (normalizedData.cliente && !normalizedData.solicitante) {
      normalizedData.solicitante = normalizedData.cliente
    }
    if (normalizedData.solicitante && !normalizedData.cliente) {
      normalizedData.cliente = normalizedData.solicitante
    }
    if (normalizedData.responsavel && !normalizedData.operador) {
      normalizedData.operador = normalizedData.responsavel
    }
    if (normalizedData.operador && !normalizedData.responsavel) {
      normalizedData.responsavel = normalizedData.operador
    }
    var result = template
    var keys = Object.keys(normalizedData)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = normalizedData[k] == null ? '' : String(normalizedData[k])
      var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
      result = result.replace(regex, val)
    }
    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
    return result
  }

  function localBuildEmailHtmlFromConfig(cfg, data) {
    var primaryColor = (cfg && cfg.primary_color) || '#D97706'
    var layout = (cfg && cfg.template_layout) || 'modern'
    var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
    var headerSubtitle =
      (cfg && cfg.header_subtitle) || 'Sistema Inteligente de Gestão de Serviços de TI'
    var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Central de Serviços Inteligente'

    var bodyContent = localInterpolateTemplate((cfg && cfg.body_template) || '', data)
    var buttonLabel = localInterpolateTemplate((cfg && cfg.button_label) || 'Acessar', data)
    var buttonUrl = localInterpolateTemplate((cfg && cfg.button_url_template) || '', data)
    var showButton = Boolean(cfg && cfg.show_button && buttonUrl)

    var buttonHtml = ''
    if (showButton) {
      buttonHtml =
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
        '<tr><td align="center" style="border-radius: 6px; background-color: ' +
        primaryColor +
        ';">' +
        '<a href="' +
        buttonUrl +
        '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; display: inline-block; font-weight: 600;">' +
        buttonLabel +
        '</a></td></tr></table>'
    }

    if (layout === 'minimal') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f9fafb;color:#111827;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">' +
        '<tr><td style="padding:24px 32px;border-bottom:2px solid ' +
        primaryColor +
        ';"><span style="font-size:20px;font-weight:800;color:#111827;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">' + headerSubtitle + '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:32px;line-height:1.6;font-size:15px;color:#374151;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:20px 32px;background-color:#f9fafb;font-size:12px;color:#9ca3af;text-align:center;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    if (layout === 'corporate') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#0f172a;color:#0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.15);">' +
        '<tr><td style="padding:28px 36px;background-color:#17181C;border-bottom:4px solid ' +
        primaryColor +
        ';text-align:left;"><span style="font-size:22px;font-weight:900;color:#FCD34D;letter-spacing:0.5px;text-transform:uppercase;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:6px 0 0 0;font-size:13px;color:#e2e8f0;font-weight:400;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:36px;line-height:1.7;font-size:15px;color:#1e293b;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:22px 36px;background-color:#f1f5f9;font-size:12px;color:#64748b;text-align:center;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    // layout 'modern' (padrão)
    return (
      '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;">' +
      '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">' +
      '<tr><td style="padding:28px 32px;background:linear-gradient(135deg,#17181C 0%,#262930 100%);border-bottom:3px solid ' +
      primaryColor +
      ';text-align:left;"><span style="font-size:20px;font-weight:800;color:#FCD34D;letter-spacing:-0.5px;">' +
      headerTitle +
      '</span>' +
      (headerSubtitle
        ? '<p style="margin:4px 0 0 0;font-size:13px;color:#cbd5e1;">' + headerSubtitle + '</p>'
        : '') +
      '</td></tr>' +
      '<tr><td style="padding:32px;line-height:1.65;font-size:15px;color:#334155;">' +
      bodyContent +
      buttonHtml +
      '</td></tr>' +
      '<tr><td style="padding:22px 32px;background-color:#f8fafc;font-size:12px;color:#64748b;text-align:center;">' +
      footerText +
      '</td></tr></table></body></html>'
    )
  }

  function localSendSystemAlertEmail(opts) {
    if (!opts) return { sent: false, reason: 'opts_missing' }
    var alertKey = opts.alert_key
    var referenceId = opts.reference_id || ''

    var rawRecipients = []
    if (Array.isArray(opts.recipients)) rawRecipients = opts.recipients
    else if (Array.isArray(opts.recipient)) rawRecipients = opts.recipient
    else if (opts.recipient) rawRecipients = [opts.recipient]

    var recipients = []
    var seenRecipients = {}
    for (var rIdx = 0; rIdx < rawRecipients.length; rIdx++) {
      var rClean = String(rawRecipients[rIdx] || '')
        .trim()
        .toLowerCase()
      if (rClean && rClean.indexOf('@') > 0 && !seenRecipients[rClean]) {
        seenRecipients[rClean] = true
        recipients.push(rClean)
      }
    }

    if (recipients.length === 0) {
      console.error(
        '[APPROVAL_CHECK] localSendSystemAlertEmail: envio ABORTADO — nenhum destinatário válido | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'recipient_missing' }
    }

    var cfg = localGetEmailAlertConfig(alertKey)
    if (!cfg) {
      console.error(
        '[APPROVAL_CHECK] localSendSystemAlertEmail: envio ABORTADO — configuração não encontrada | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'alert_config_missing', alert_key: alertKey }
    }

    if (!cfg.enabled) {
      console.log(
        '[APPROVAL_CHECK] e-mail SUPRIMIDO — alerta DESLIGADO na Central | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
    }

    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      opts.subject ||
      'Notificação Lógos AITSM'
    var subject = localInterpolateTemplate(rawSubject, data)

    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var htmlContent = localBuildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || localInterpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    var senderAddress = SKIP_CLOUD_SENDER_EMAIL
    var senderName = SKIP_CLOUD_SENDER_NAME
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
    } catch (_) {}

    var sentCount = 0
    var skippedDuplicates = 0
    var errors = []

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i]

      if (referenceId && localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
        skippedDuplicates++
        continue
      }

      try {
        var message = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: recipient }],
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })
        var client = $app.newMailClient()
        client.send(message)

        if (referenceId) {
          localRecordEmailSentLog(alertKey, referenceId, recipient, subject, {
            template_layout: cfg.template_layout,
            primary_color: cfg.primary_color,
            transport: 'skip_cloud',
          })
        }

        sentCount++
        console.log(
          '[APPROVAL_CHECK] e-mail enviado via Skip Cloud | alert_key=' +
            alertKey +
            ' | destinatário=' +
            recipient,
        )
      } catch (err) {
        var errDesc = err && err.message ? err.message : String(err)
        errors.push({ recipient: recipient, error: errDesc })
        console.error(
          '[APPROVAL_CHECK] FALHA no envio Skip Cloud | alert_key=' +
            String(alertKey || '') +
            ' | destinatário=' +
            recipient +
            ' | motivo: ' +
            errDesc,
        )
      }
    }

    if (sentCount > 0) {
      return {
        sent: true,
        sent_count: sentCount,
        skipped_duplicates: skippedDuplicates,
        errors: errors,
      }
    }
    if (skippedDuplicates > 0 && errors.length === 0) {
      return { sent: false, reason: 'already_sent', skipped_duplicates: skippedDuplicates }
    }
    return {
      sent: false,
      reason: errors.length > 0 ? 'send_failed' : 'no_recipients_processed',
      errors: errors,
    }
  }

  // ==========================================================================
  // CHECAGEM DE APROVAÇÃO — lógica completa, inline (aplicável a create/update)
  // ==========================================================================
  function localRunApprovalCheck(curApp, curTicket, auth) {
    if (!curTicket) return null
    if (!curApp) curApp = $app

    var companyId = curTicket.getString('company')
    if (!companyId) return null

    var categoryId = curTicket.getString('category') || ''
    var subcategoryId = curTicket.getString('subcategory') || ''
    var ticketType = curTicket.getString('type') || ''
    var ticketPriority = curTicket.getString('priority') || ''

    if (localStatusIsClosed(curTicket.getString('status'))) return null
    if (localTypeIsDuvida(ticketType)) return null

    var existingApp = null
    try {
      existingApp = curApp.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + curTicket.id + '" && status = "Pendente"',
      )
    } catch (_) {}
    if (existingApp) return null

    var configs = []
    try {
      configs = curApp.findRecordsByFilter('approval_configs', 'active = true', '-created', 200, 0)
    } catch (err) {
      console.error('[APPROVAL_CHECK] falha ao listar approval_configs: ' + err.message)
      return null
    }
    if (!configs || configs.length === 0) return null

    var matchingConfig = null
    for (var i = 0; i < configs.length; i++) {
      var cfg = configs[i]
      var cfgCompany = cfg.getString('company')
      var cfgClients = localParseJsonList(cfg, 'clients')
      var isCompanyMatch = false
      if (cfgCompany) {
        if (cfgCompany === companyId) isCompanyMatch = true
      } else if (cfgClients.length > 0) {
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
        var activityMatched =
          (subcategoryId && activityId === subcategoryId) ||
          (categoryId && activityId === categoryId)
        if (!activityMatched) continue

        var reqTypesAct = localParseJsonList(cfg, 'request_types')
        if (reqTypesAct.length > 0 && reqTypesAct.indexOf(ticketType) < 0) continue

        matchingConfig = cfg
        break
      }

      var reqTypes = localParseJsonList(cfg, 'request_types')
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

      if (!matchingConfig) matchingConfig = cfg
    }

    if (!matchingConfig) return null

    // =======================================================================
    // CRIAÇÃO DA PENDÊNCIA
    // =======================================================================
    var ticketNumber = curTicket.getString('number') || curTicket.id
    var ticketTitle = curTicket.getString('title') || 'Chamado sem título'
    console.log(
      '[APPROVAL_CHECK] regra casa para #' +
        ticketNumber +
        ' (config=' +
        matchingConfig.id +
        ') — criando pendência de aprovação',
    )

    var requesterId = ''
    var requesterEmail = (curTicket.getString('requester_email') || '').trim()
    var requesterName = (curTicket.getString('requester_name') || '').trim() || 'Solicitante'
    if (requesterEmail) {
      try {
        var uByEmail = curApp.findFirstRecordByFilter(
          'users',
          'email = "' + requesterEmail.toLowerCase().replace(/"/g, '\\"') + '"',
        )
        if (uByEmail) requesterId = uByEmail.id
      } catch (_) {}
    }
    if (!requesterId && auth && auth.id) requesterId = auth.id
    if (!requesterId) {
      try {
        var uCompany = curApp.findFirstRecordByFilter('users', 'company = "' + companyId + '"')
        if (uCompany) requesterId = uCompany.id
      } catch (_) {}
    }
    if (!requesterId) {
      var assignedId = curTicket.getString('assigned_to')
      if (assignedId) requesterId = assignedId
    }
    if (!requesterId) {
      try {
        var uAdmin = curApp.findFirstRecordByFilter('users', 'role = "admin"')
        if (uAdmin) requesterId = uAdmin.id
      } catch (_) {}
    }
    if (!requesterId) {
      console.error(
        '[APPROVAL_CHECK] ABORTADO para #' +
          ticketNumber +
          ' — nenhum usuário disponível para approvals.requester (relation obrigatória)',
      )
      return null
    }

    var focalIds = localIdList(
      matchingConfig,
      'focal_points_all',
      'focal_points',
      'approver_focal_point',
    )
    var internalIds = localIdList(
      matchingConfig,
      'internal_approvers_all',
      'internal_approvers',
      'approver_user',
    )
    if (focalIds.length === 0 && internalIds.length === 0) {
      console.warn(
        '[APPROVAL_CHECK] regra ' +
          matchingConfig.id +
          ' sem aprovador configurado — nada a criar para #' +
          ticketNumber,
      )
      return null
    }

    var mode = matchingConfig.getString('mode') || 'Individual'
    var escDeadline = localEscDeadline(matchingConfig.getInt('escalation_timeout_minutes'))

    var approvalsCol
    try {
      approvalsCol = curApp.findCollectionByNameOrId('approvals')
    } catch (colErr) {
      console.error('[APPROVAL_CHECK] collection approvals não encontrada: ' + colErr.message)
      return null
    }

    var createdApprovals = []
    var approverEmails = []
    var notifyUserIds = []

    function createOneApproval(role, contactRec, userRec) {
      var recA = new Record(approvalsCol)
      recA.set('ticket', curTicket.id)
      recA.set('requester', requesterId)
      recA.set('type', 'Outros')
      recA.set(
        'justification',
        'Atividade "' +
          (curTicket.getString('service') || ticketTitle) +
          '" requer aprovação conforme regra cadastrada (empresa + atividade).',
      )
      recA.set('status', 'Pendente')
      recA.set('token', localGenToken())
      recA.set('approval_config', matchingConfig.id)
      recA.set('stage', 1)
      recA.set('mode', mode)
      recA.set('escalation_deadline', escDeadline)
      recA.set('approval_role', role)
      if (contactRec) {
        recA.set('target_contact', contactRec.id)
        var cEmail = (contactRec.getString('email') || '').trim()
        if (cEmail) recA.set('target_email', cEmail)
      }
      if (userRec) recA.set('approver', userRec.id)
      curApp.save(recA)
      return recA
    }

    for (var f = 0; f < focalIds.length; f++) {
      try {
        var contact = curApp.findRecordById('client_contacts', focalIds[f])
        var contactUser = null
        try {
          var cuId = contact.getString('user')
          if (cuId) contactUser = curApp.findRecordById('users', cuId)
        } catch (_) {}
        var created = createOneApproval('client', contact, contactUser)
        createdApprovals.push(created)
        var cMail = (contact.getString('email') || '').trim().toLowerCase()
        if (cMail) approverEmails.push(cMail)
        if (contactUser && contactUser.id) notifyUserIds.push(contactUser.id)
      } catch (errF) {
        console.error(
          '[APPROVAL_CHECK] falha ao criar aprovação do ponto focal ' +
            focalIds[f] +
            ' | ' +
            (errF && errF.message ? errF.message : String(errF)),
        )
      }
    }

    for (var n = 0; n < internalIds.length; n++) {
      try {
        var iUser = curApp.findRecordById('users', internalIds[n])
        var createdInt = createOneApproval('internal', null, iUser)
        createdApprovals.push(createdInt)
        var iMail = (iUser.getString('email') || '').trim().toLowerCase()
        if (iMail) approverEmails.push(iMail)
        notifyUserIds.push(iUser.id)
      } catch (errI) {
        console.error(
          '[APPROVAL_CHECK] falha ao criar aprovação interna ' +
            internalIds[n] +
            ' | ' +
            (errI && errI.message ? errI.message : String(errI)),
        )
      }
    }

    if (createdApprovals.length === 0) {
      console.error('[APPROVAL_CHECK] nenhuma pendência criada para #' + ticketNumber)
      return null
    }

    var statusBefore = String(curTicket.getString('status') || '')

    // ---- nomes dos aprovadores (rastreabilidade no histórico) ----
    var approverNames = []
    for (var an2 = 0; an2 < createdApprovals.length; an2++) {
      var aName2 = ''
      try {
        var apId2 = createdApprovals[an2].getString('approver')
        if (apId2) aName2 = (curApp.findRecordById('users', apId2).getString('name') || '').trim()
      } catch (_) {}
      if (!aName2) {
        try {
          var tcId2 = createdApprovals[an2].getString('target_contact')
          if (tcId2)
            aName2 = (
              curApp.findRecordById('client_contacts', tcId2).getString('name') || ''
            ).trim()
        } catch (_) {}
      }
      if (!aName2) {
        try {
          aName2 = (createdApprovals[an2].getString('target_email') || '').trim()
        } catch (_) {}
      }
      if (aName2 && approverNames.indexOf(aName2) < 0) approverNames.push(aName2)
    }
    var approverLabel = approverNames.length > 0 ? approverNames.join(', ') : 'aprovador da regra'

    // ---- trava o chamado: approval_hold + status Aguardando Aprovação + PAUSA DE SLA ----
    var nowIsoHold = new Date().toISOString()
    try {
      // SLA Resposta e SLA Solução param de contar: grava a pausa em sla_pauses
      if (!curTicket.getBool('sla_paused')) {
        try {
          var pauseColHold = curApp.findCollectionByNameOrId('sla_pauses')
          var pauseRecHold = new Record(pauseColHold)
          pauseRecHold.set('ticket', curTicket.id)
          pauseRecHold.set('reason', 'Aguardando Aprovação')
          pauseRecHold.set(
            'justification',
            'Chamado aguardando aprovação (regra empresa + atividade).',
          )
          pauseRecHold.set('paused_by', requesterId)
          pauseRecHold.set('paused_at', nowIsoHold)
          curApp.save(pauseRecHold)
        } catch (errPause) {
          console.error(
            '[APPROVAL_CHECK] falha ao gravar pausa de SLA: ' +
              (errPause && errPause.message ? errPause.message : String(errPause)),
          )
        }
      }
      curTicket.set('approval_hold', true)
      curTicket.set('status', 'Aguardando Aprovação')
      curTicket.set('sla_paused', true)
      curTicket.set('sla_status', 'Pausado')
      curApp.save(curTicket)
      console.log(
        '[APPROVAL_CHECK] chamado #' +
          ticketNumber +
          ' travado: approval_hold=true, status=Aguardando Aprovação, SLA pausado',
      )
    } catch (errHold) {
      console.error(
        '[APPROVAL_CHECK] FALHA ao travar chamado #' +
          ticketNumber +
          ' | ' +
          (errHold && errHold.message ? errHold.message : String(errHold)),
      )
    }

    // ---- histórico do chamado (cita os aprovadores — rastreabilidade) ----
    try {
      var historyCol = curApp.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', curTicket.id)
      hist.set('user', requesterId)
      hist.set(
        'action',
        'Chamado enviado para aprovação do aprovador ' +
          approverLabel +
          ' (regra empresa + atividade). ' +
          createdApprovals.length +
          ' pendência(s) criada(s) — status "Aguardando Aprovação". SLA (resposta e solução) pausado durante a espera.',
      )
      hist.set('field', 'status')
      hist.set('old_value', statusBefore || 'Atribuído')
      hist.set('new_value', 'Aguardando Aprovação')
      curApp.save(hist)
    } catch (errHist) {
      console.warn('[APPROVAL_CHECK] falha ao gravar histórico: ' + errHist.message)
    }

    var portalLink = localBaseUrl() + '/portal'
    var companyName = ''
    try {
      var comp = curApp.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var baseData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      solicitante: requesterName,
      cliente: requesterName,
      empresa: companyName,
      aprovador: requesterName,
      responsavel: requesterName,
      atividade: curTicket.getString('service') || ticketTitle,
      link: portalLink,
    }

    if (requesterEmail) {
      try {
        var r1 = localSendSystemAlertEmail({
          alert_key: 'ticket_approval_hold',
          reference_id: curTicket.id + ':hold',
          recipients: [requesterEmail],
          subject: 'Chamado #' + ticketNumber + ' aguardando aprovação - ' + ticketTitle,
          data: baseData,
        })
        console.log(
          '[APPROVAL_CHECK] e-mail solicitante (ticket_approval_hold): ' + JSON.stringify(r1),
        )
      } catch (errE1) {
        console.error(
          '[APPROVAL_CHECK] erro e-mail solicitante: ' +
            (errE1 && errE1.message ? errE1.message : String(errE1)),
        )
      }
    }

    if (approverEmails.length > 0) {
      try {
        var r2 = localSendSystemAlertEmail({
          alert_key: 'ticket_approval_request_internal',
          reference_id: curTicket.id + ':request',
          recipients: approverEmails,
          subject: 'Aprovação pendente: Chamado #' + ticketNumber + ' - ' + ticketTitle,
          data: baseData,
        })
        console.log(
          '[APPROVAL_CHECK] e-mail aprovador (ticket_approval_request_internal): ' +
            JSON.stringify(r2),
        )
      } catch (errE2) {
        console.error(
          '[APPROVAL_CHECK] erro e-mail aprovador: ' +
            (errE2 && errE2.message ? errE2.message : String(errE2)),
        )
      }
    }

    if (notifyUserIds.length > 0 && localIsAlertEnabled('ticket_approval_created_notify')) {
      var notifsCol = null
      try {
        notifsCol = curApp.findCollectionByNameOrId('notifications')
      } catch (_) {}
      if (notifsCol) {
        var seenUsers = {}
        for (var uIdx = 0; uIdx < notifyUserIds.length; uIdx++) {
          var uid = notifyUserIds[uIdx]
          if (!uid || seenUsers[uid]) continue
          seenUsers[uid] = true
          try {
            var notif = new Record(notifsCol)
            notif.set('user', uid)
            notif.set('ticket', curTicket.id)
            notif.set('title', 'Aprovação pendente — #' + ticketNumber)
            notif.set(
              'message',
              'O chamado #' +
                ticketNumber +
                ' (' +
                ticketTitle +
                ') aguarda sua aprovação para liberar o atendimento.',
            )
            notif.set('type', 'Aprovação')
            notif.set('read', false)
            curApp.save(notif)
          } catch (errN) {
            console.warn(
              '[APPROVAL_CHECK] falha na notificação in-app: ' +
                (errN && errN.message ? errN.message : String(errN)),
            )
          }
        }
      }
    } else if (notifyUserIds.length > 0) {
      console.log(
        '[APPROVAL_CHECK] notificação in-app suprimida (ticket_approval_created_notify desligado)',
      )
    }

    console.log(
      '[APPROVAL_CHECK] fluxo concluído para #' +
        ticketNumber +
        ' — ' +
        createdApprovals.length +
        ' pendência(s), ' +
        approverEmails.length +
        ' aprovador(es) por e-mail',
    )

    return createdApprovals[0]
  }

  // ==========================================================================
  // EXECUÇÃO — só reexecuta quando a ATIVIDADE (categoria/subatividade) mudou
  // ==========================================================================
  try {
    if (!rec) return e.next()
    if (rec.getBool('approval_hold')) return e.next()
    if (localStatusIsClosed(rec.getString('status'))) return e.next()

    var newCat = rec.getString('category') || ''
    var newSub = rec.getString('subcategory') || ''
    if (!newCat && !newSub) return e.next()

    var oldCat = ''
    var oldSub = ''
    try {
      var orig = typeof rec.original === 'function' ? rec.original() : null
      if (orig) {
        oldCat = orig.getString('category') || ''
        oldSub = orig.getString('subcategory') || ''
      }
    } catch (_) {}
    if (newCat === oldCat && newSub === oldSub) return e.next()

    console.log(
      '[APPROVAL_CHECK] after-update: atividade alterada no chamado #' +
        ticketNumber +
        ' — reexecutando checagem de aprovação',
    )
    var foundUpd = localRunApprovalCheck(app, rec, e.auth)
    if (foundUpd) {
      console.log('[APPROVAL_CHECK] after-update: pendência criada (' + foundUpd.id + ')')
    } else {
      console.log('[APPROVAL_CHECK] after-update: nenhuma regra casou — nada criado')
    }
  } catch (errUpd) {
    console.error(
      '[APPROVAL_CHECK] after-update: erro no chamado #' +
        ticketNumber +
        ' | ' +
        (errUpd && errUpd.message ? errUpd.message : String(errUpd)),
    )
  }
  return e.next()
}, 'tickets')

// ============================================================================
// ENVIO MANUAL — apenas força o salvamento do chamado. O callback after-update
// acima dispara a checagem (rota usada pelo botão "Enviar para aprovação").
// ============================================================================
routerAdd('POST', '/backend/v1/tickets/{id}/send-approval', (e) => {
  if (!e.auth) return e.unauthorizedError('Autenticação necessária')
  try {
    var ticket = $app.findRecordById('tickets', e.request.pathValue('id'))
    if (!ticket) return e.notFoundError('Chamado não encontrado')

    var stNow = ticket.getString('status') || ''
    var sLowerNow = String(stNow).toLowerCase()
    var closedNow =
      sLowerNow === 'resolvido' ||
      sLowerNow === 'encerrado' ||
      sLowerNow === 'cancelado' ||
      sLowerNow === 'fechado'
    if (closedNow || ticket.getBool('approval_hold')) {
      return e.badRequestError(
        'Este chamado já possui aprovação pendente ou está encerrado/resolvido.',
      )
    }
    var dup = null
    try {
      dup = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + ticket.id + '" && status = "Pendente"',
      )
    } catch (_) {}
    if (dup) {
      return e.badRequestError('Já existe uma aprovação pendente para este chamado.')
    }
    var catM = ticket.getString('category') || ''
    var subM = ticket.getString('subcategory') || ''
    if (!catM && !subM) {
      return e.badRequestError(
        'Classifique a atividade/subatividade do chamado antes de enviar para aprovação.',
      )
    }

    // Força o salvamento com ALTERAÇÃO real (o after-update compara com
    // rec.original()): alterna a subatividade para "" e volta — cada save
    // dispara o callback after-update, que roda a checagem inline.
    var fieldToToggle = subM ? 'subcategory' : 'category'
    var originalVal = subM ? subM : catM
    var tmp = $app.findRecordById('tickets', ticket.id)
    tmp.set(fieldToToggle, '')
    $app.save(tmp)
    var upd = $app.findRecordById('tickets', ticket.id)
    upd.set(fieldToToggle, originalVal)
    $app.save(upd)

    var after = null
    try {
      after = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + ticket.id + '" && status = "Pendente"',
      )
    } catch (_) {}
    if (!after) {
      return e.badRequestError(
        'Nenhuma regra de aprovação ativa encontrada para este chamado (empresa + atividade).',
      )
    }
    return e.json(200, { success: true, approval: after.id })
  } catch (errMan) {
    return e.badRequestError('Falha ao enviar para aprovação: ' + errMan.message)
  }
})
