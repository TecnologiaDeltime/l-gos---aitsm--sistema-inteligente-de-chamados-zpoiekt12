/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Helpers da Central de Alertas por E-mail (Skip Cloud / PocketBase JSVM)
// ----------------------------------------------------------------------------
// IMPORTANTE: este arquivo carrega PRIMEIRO entre os hooks (prefixo "A0_" é
// o menor slug alfabético permitido pela plataforma, que exige slug iniciado
// por letra). Assim, getEmailAlertConfig / buildEmailHtmlFromConfig /
// sendSystemAlertEmail já estão definidos ANTES de qualquer hook de disparo
// (ticket_created, ticket_resolved, auto-reply etc.) executar.
//
// Robustez de carregamento (v0.0.401):
// - Todo o código é isolado em IIFE para evitar "Hook scoping error"
// - Funções declaradas no escopo interno (hoisting) e publicadas em globalThis
// - NENHUMA chamada de IO / banco / parse de settings executada no nível de topo
// - Resolução defensiva de globalThis para compatibilidade com o pool Goja
// - Log explícito ao final do carregamento comprovando disponibilidade
// ============================================================================

;(function () {
  var _g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
          ? window
          : this || {}

  if (typeof globalThis === 'undefined') {
    try {
      _g.globalThis = _g
    } catch (_) {}
  }

  /**
   * Verifica se o alerta está ligado na Central (email_alert_settings.enabled).
   */
  function isEmailAlertEnabled(alertKey) {
    if (!alertKey) return false
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + alertKey + '"',
      )
      return rec ? Boolean(rec.getBool('enabled')) : false
    } catch (_) {
      return false
    }
  }

  /**
   * Obtém as configurações e template de um alerta específico (email_alert_settings).
   */
  function getEmailAlertConfig(alertKey) {
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
        name: rec.getString('name'),
        description: rec.getString('description'),
        category: rec.getString('category'),
        enabled: rec.getBool('enabled'),
        recipient_types: rec.getString('recipient_types'),
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
      try {
        $app
          .logger()
          .error(
            'email_alert_helpers: falha ao carregar configuração do alerta',
            'alert_key',
            alertKey,
            'error',
            err.message,
          )
      } catch (_) {}
      console.error(
        '[Central de Alertas] getEmailAlertConfig: falha ao carregar configuração do alerta | alert_key=' +
          alertKey +
          ' | motivo: ' +
          (err && err.message ? err.message : String(err)),
      )
      return null
    }
  }

  /**
   * Anti-duplicidade estrita por (alert_key, reference_id, recipient).
   * Retorna true se já houve envio registrado para a combinação.
   */
  function hasEmailAlreadyBeenSent(alertKey, referenceId, recipient) {
    if (!alertKey || !referenceId || !recipient) return false
    try {
      var cleanRecipient = String(recipient).trim().toLowerCase()
      var rec = $app.findFirstRecordByFilter(
        'email_sent_logs',
        'alert_key = "' +
          alertKey +
          '" && reference_id = "' +
          referenceId +
          '" && recipient = "' +
          cleanRecipient +
          '"',
      )
      return Boolean(rec)
    } catch (_) {
      return false
    }
  }

  /**
   * Registra no log de anti-duplicidade (email_sent_logs) que o e-mail foi disparado.
   */
  function recordEmailSentLog(alertKey, referenceId, recipient, subject, meta) {
    if (!alertKey || !referenceId || !recipient) return
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var cleanRecipient = String(recipient).trim().toLowerCase()
      var log = new Record(col)
      log.set('alert_key', alertKey)
      log.set('reference_id', referenceId)
      log.set('recipient', cleanRecipient)
      log.set('sent_at', new DateTime())
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      try {
        $app
          .logger()
          .warn(
            'email_alert_helpers: falha ao registrar email_sent_logs',
            'alert_key',
            alertKey,
            'error',
            err.message,
          )
      } catch (_) {}
      console.error(
        '[Central de Alertas] recordEmailSentLog: falha ao registrar email_sent_logs | alert_key=' +
          alertKey +
          ' | destinatário=' +
          String(recipient || '') +
          ' | motivo: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }

  /**
   * Substitui placeholders {{chave}} pelos valores fornecidos.
   * Variáveis ausentes são removidas com segurança para nunca quebrar o envio.
   * Suporta aliases padronizados comuns do Lógos AITSM (numero/chamado_numero,
   * cliente/solicitante, operador/responsavel, prazo/prazo_sla, etc).
   */
  function interpolateTemplate(template, data) {
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
    if (normalizedData.mudanca_numero && !normalizedData.numero) {
      normalizedData.numero = normalizedData.mudanca_numero
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
    if (normalizedData.prazo_sla && !normalizedData.prazo) {
      normalizedData.prazo = normalizedData.prazo_sla
    }
    if (normalizedData.prazo && !normalizedData.prazo_sla) {
      normalizedData.prazo_sla = normalizedData.prazo
    }
    if (normalizedData.data_abertura && !normalizedData.data_hora) {
      normalizedData.data_hora = normalizedData.data_abertura
    }
    if (normalizedData.data_hora && !normalizedData.data_abertura) {
      normalizedData.data_abertura = normalizedData.data_hora
    }
    if (normalizedData.projeto_nome && !normalizedData.titulo) {
      normalizedData.titulo = normalizedData.projeto_nome
    }

    var result = template
    var keys = Object.keys(normalizedData)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = normalizedData[k] == null ? '' : String(normalizedData[k])
      var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
      result = result.replace(regex, val)
    }

    // Placeholders restantes são removidos para não degradar a legibilidade
    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')

    return result
  }

  /**
   * Constrói o HTML completo do e-mail de acordo com o layout configurado na Central.
   * Layouts: 'modern' | 'corporate' | 'minimal'
   */
  function buildEmailHtmlFromConfig(cfg, data) {
    var primaryColor = (cfg && cfg.primary_color) || '#D97706'
    var layout = (cfg && cfg.template_layout) || 'modern'
    var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
    var headerSubtitle =
      (cfg && cfg.header_subtitle) || 'Sistema Inteligente de Gestão de Serviços de TI'
    var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Central de Serviços Inteligente'

    var bodyContent = interpolateTemplate((cfg && cfg.body_template) || '', data)
    var buttonLabel = interpolateTemplate((cfg && cfg.button_label) || 'Acessar', data)
    var buttonUrl = interpolateTemplate((cfg && cfg.button_url_template) || '', data)
    var showButton = Boolean(cfg && cfg.show_button && buttonUrl)

    var buttonHtml = ''
    if (showButton) {
      buttonHtml =
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
        '<tr>' +
        '<td align="center" style="border-radius: 6px; background-color: ' +
        primaryColor +
        ';">' +
        '<a href="' +
        buttonUrl +
        '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; border: 1px solid ' +
        primaryColor +
        '; display: inline-block; font-weight: 600;">' +
        buttonLabel +
        '</a>' +
        '</td>' +
        '</tr>' +
        '</table>'
    }

    if (layout === 'minimal') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f9fafb; color: #111827;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">' +
        '<tr><td style="padding: 24px 32px; border-bottom: 2px solid ' +
        primaryColor +
        ';">' +
        '<span style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 32px; line-height: 1.6; font-size: 15px; color: #374151;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">' +
        footerText +
        '</td></tr>' +
        '</table></body></html>'
      )
    }

    if (layout === 'corporate') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #0f172a; color: #0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">' +
        '<tr><td style="padding: 28px 36px; background-color: #17181C; border-bottom: 4px solid ' +
        primaryColor +
        '; text-align: left;">' +
        '<span style="font-size: 22px; font-weight: 900; color: #FCD34D; letter-spacing: 0.5px; text-transform: uppercase;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 400;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 36px; line-height: 1.65; font-size: 15px; color: #1e293b;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding: 24px 36px; background-color: #0f172a; color: #94a3b8; font-size: 12px; text-align: center; border-top: 1px solid #1e293b;">' +
        '<strong style="color: #cbd5e1;">' +
        headerTitle +
        '</strong> — Sistema de Gestão de Serviços de TI<br>' +
        '<span style="color: #64748b;">' +
        footerText +
        '</span>' +
        '</td></tr>' +
        '</table></body></html>'
      )
    }

    // Padrão 'modern' (identidade Amber Alert / Grafite do Lógos AITSM)
    return (
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
      '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">' +
      '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #22252a 100%); border-bottom: 3px solid ' +
      primaryColor +
      '; text-align: left;">' +
      '<span style="font-size: 22px; font-weight: 800; color: #FCD34D; letter-spacing: -0.3px;">' +
      headerTitle +
      '</span>' +
      (headerSubtitle
        ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
          headerSubtitle +
          '</p>'
        : '') +
      '</td></tr>' +
      '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
      bodyContent +
      buttonHtml +
      '</td></tr>' +
      '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
      footerText +
      '</td></tr>' +
      '</table></body></html>'
    )
  }

  /**
   * Dispara um e-mail respeitando o switch da Central de Alertas por E-mail,
   * gerando o layout configurado no editor (marca Lógos AITSM) e gravando
   * anti-duplicidade por (alert_key, reference_id, recipient).
   * Suporta recipient único (string) ou múltiplos destinatários (recipients: [...]).
   *
   * Retorno: { sent, reason?, sent_count?, skipped_duplicates?, errors? }
   */
  function sendSystemAlertEmail(opts) {
    if (!opts) return { sent: false, reason: 'opts_missing' }
    var alertKey = opts.alert_key
    var referenceId = opts.reference_id || ''

    var rawRecipients = []
    if (Array.isArray(opts.recipients)) {
      rawRecipients = opts.recipients
    } else if (Array.isArray(opts.recipient)) {
      rawRecipients = opts.recipient
    } else if (opts.recipient) {
      rawRecipients = [opts.recipient]
    }

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
        '[Central de Alertas] sendSystemAlertEmail: envio ABORTADO — nenhum destinatário válido | alert_key=' +
          String(alertKey || ''),
      )
      return { sent: false, reason: 'recipient_missing' }
    }

    // 1. Switch da Central de Alertas: alerta desligado = não envia
    var cfg = getEmailAlertConfig(alertKey)
    if (!cfg) {
      console.error(
        '[Central de Alertas] sendSystemAlertEmail: envio ABORTADO — configuração do alerta não encontrada (getEmailAlertConfig retornou nulo) | alert_key=' +
          String(alertKey || '') +
          ' | destinatários=' +
          recipients.join(', '),
      )
      return { sent: false, reason: 'alert_config_missing', alert_key: alertKey }
    }
    if (!cfg.enabled) {
      try {
        $app
          .logger()
          .info(
            'sendSystemAlertEmail: alerta desligado nas configurações',
            'alert_key',
            alertKey,
            'recipients_count',
            recipients.length,
          )
      } catch (_) {}
      console.error(
        '[Central de Alertas] sendSystemAlertEmail: envio ABORTADO — alerta DESLIGADO nas configurações | alert_key=' +
          String(alertKey || '') +
          ' | destinatários=' +
          recipients.join(', '),
      )
      return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
    }

    // 2. Assunto e corpo vindos EXCLUSIVAMENTE do template da Central (editor).
    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      opts.subject ||
      'Notificação Lógos AITSM'
    var subject = interpolateTemplate(rawSubject, data)

    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var sendEmailFn =
      typeof globalThis !== 'undefined' && typeof globalThis.sendSystemEmail === 'function'
        ? globalThis.sendSystemEmail
        : _g.sendSystemEmail

    if (typeof sendEmailFn !== 'function') {
      console.error(
        '[Central de Alertas] sendSystemAlertEmail: envio ABORTADO — sendSystemEmail indisponível (mailer_service.js não carregado?) | alert_key=' +
          String(alertKey || '') +
          ' | destinatários=' +
          recipients.join(', '),
      )
      try {
        $app
          .logger()
          .error(
            'sendSystemAlertEmail: sendSystemEmail indisponível — envio abortado',
            'alert_key',
            alertKey,
          )
      } catch (_) {}
      return { sent: false, reason: 'sendSystemEmail_unavailable', alert_key: alertKey }
    }

    var htmlContent = buildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || interpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    var sentCount = 0
    var skippedDuplicates = 0
    var errors = []

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i]

      // 3. Anti-duplicidade estrita por (alertKey, referenceId, recipient)
      if (referenceId && hasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
        try {
          $app
            .logger()
            .info(
              'sendSystemAlertEmail: e-mail já enviado anteriormente (anti-duplicidade)',
              'alert_key',
              alertKey,
              'ref',
              referenceId,
              'to',
              recipient,
            )
        } catch (_) {}
        skippedDuplicates++
        continue
      }

      // 4. Envio via mailer do sistema (Skip Mailer / caixa dedicada / fallback SMTP)
      try {
        sendEmailFn({
          to: recipient,
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })

        if (referenceId) {
          recordEmailSentLog(alertKey, referenceId, recipient, subject, {
            template_layout: cfg.template_layout,
            primary_color: cfg.primary_color,
          })
        }

        try {
          $app
            .logger()
            .info(
              'sendSystemAlertEmail: enviado com sucesso',
              'alert_key',
              alertKey,
              'recipient',
              recipient,
            )
        } catch (_) {}
        sentCount++
        console.log(
          '[Central de Alertas] sendSystemAlertEmail: enviado com sucesso | alert_key=' +
            alertKey +
            ' | destinatário=' +
            recipient +
            ' | assunto=' +
            subject,
        )
      } catch (err) {
        try {
          $app
            .logger()
            .error(
              'sendSystemAlertEmail: falha no envio para ' + recipient,
              'alert_key',
              alertKey,
              'error',
              err.message,
            )
        } catch (_) {}
        console.error(
          '[Central de Alertas] sendSystemAlertEmail: FALHA no envio | alert_key=' +
            String(alertKey || '') +
            ' | destinatário=' +
            recipient +
            ' | motivo: ' +
            (err && err.message ? err.message : String(err)),
        )
        errors.push({ recipient: recipient, error: err.message })
      }
    }

    if (sentCount > 0) {
      return {
        sent: true,
        alert_key: alertKey,
        sent_count: sentCount,
        skipped_duplicates: skippedDuplicates,
        errors: errors.length > 0 ? errors : undefined,
      }
    } else if (skippedDuplicates > 0) {
      return {
        sent: false,
        reason: 'already_sent',
        alert_key: alertKey,
        reference_id: referenceId,
        skipped_duplicates: skippedDuplicates,
      }
    } else {
      return {
        sent: false,
        reason: 'send_failed',
        alert_key: alertKey,
        errors: errors,
      }
    }
  }

  // ==========================================================================
  // Funções REUTILIZÁVEIS de disparo (chamadas pelo hook de evento E por
  // caminhos explícitos que podem não emitir onRecordAfterCreate/UpdateSuccess,
  // ex.: rotas customizadas do portal e resolução em massa).
  // Anti-duplicidade garantida por (alert_key, reference_id, recipient).
  // ==========================================================================

  function resolveTicketClientRecipients(ticket, auth) {
    var companyId = ticket.getString('company')
    var primaryEmail = (ticket.getString('requester_email') || '').trim()
    var primaryName = (ticket.getString('requester_name') || '').trim()

    if (!primaryEmail && auth && typeof auth.getString === 'function') {
      primaryEmail = (auth.getString('email') || '').trim()
      if (!primaryName) primaryName = (auth.getString('name') || '').trim()
    }

    if (!primaryEmail && primaryName && companyId) {
      try {
        var safeName = primaryName.replace(/"/g, '\\"')
        var contactByName = $app.findFirstRecordByFilter(
          'client_contacts',
          'client = "' + companyId + '" && full_name ~ "' + safeName + '"',
        )
        if (contactByName && contactByName.getString('email')) {
          primaryEmail = contactByName.getString('email').trim()
        }
      } catch (_) {}
    }

    if (!primaryEmail && companyId) {
      try {
        var focal = $app.findFirstRecordByFilter(
          'client_contacts',
          'client = "' + companyId + '" && is_focal_point = true && email != ""',
        )
        if (focal && focal.getString('email')) {
          primaryEmail = focal.getString('email').trim()
          if (!primaryName) primaryName = focal.getString('full_name').trim()
        }
      } catch (_) {}
    }

    if (!primaryName) primaryName = 'Solicitante'

    var list = []
    var seen = {}
    function add(emailStr) {
      var clean = String(emailStr || '')
        .trim()
        .toLowerCase()
      if (clean && clean.indexOf('@') > 0 && !seen[clean]) {
        seen[clean] = true
        list.push(clean)
      }
    }
    if (primaryEmail) add(primaryEmail)

    try {
      var parts = ticket.get('participants')
      if (Array.isArray(parts)) {
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i]
          if (typeof p === 'string') {
            if (p.indexOf('@') > 0) {
              add(p)
            } else {
              try {
                var u = $app.findRecordById('users', p)
                if (u && u.getString('email')) add(u.getString('email'))
              } catch (_) {}
            }
          } else if (p && typeof p === 'object') {
            add(p.email || p.userEmail || p.address)
          }
        }
      }
    } catch (_) {}

    return { recipients: list, requesterName: primaryName, companyId: companyId }
  }

  function getTicketBaseUrl() {
    try {
      var host = $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || ''
      if (host) return host.replace(/\/+$/, '')
    } catch (_) {}
    return ''
  }

  function formatTicketDate(raw) {
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

  /**
   * Envia o e-mail de ABERTURA do chamado (alert_key 'ticket_created') pela
   * Central de Alertas. Pode ser chamado pelo hook de criação OU por rotas
   * customizadas — dedup evita envio duplo.
   */
  function notifyTicketCreatedEmails(ticket, auth) {
    if (!ticket) return { sent: false, reason: 'no_ticket' }
    var ticketNumber = ticket.getString('number') || ticket.id
    console.log('[Central de Alertas] notifyTicketCreatedEmails | chamado #' + ticketNumber)

    try {
      // Supressão herdada de client_notification_settings (comportamento preservado)
      var companyId = ticket.getString('company')
      try {
        var clientSettingsRec = null
        if (companyId) {
          try {
            clientSettingsRec = $app.findFirstRecordByFilter(
              'client_notification_settings',
              'company = "' + companyId + '"',
            )
          } catch (_) {}
        }
        if (!clientSettingsRec) {
          try {
            clientSettingsRec = $app.findFirstRecordByFilter(
              'client_notification_settings',
              'scope = "global"',
            )
          } catch (_) {}
        }
        if (clientSettingsRec && clientSettingsRec.getBool('notify_ticket_created') === false) {
          console.warn(
            '[Central de Alertas] ticket_created: envio SUPRIMIDO por client_notification_settings | chamado #' +
              ticketNumber,
          )
          return { sent: false, reason: 'suppressed_by_client_settings' }
        }
      } catch (_) {}

      var resolved = resolveTicketClientRecipients(ticket, auth)
      var recipientsList = resolved.recipients

      if (recipientsList.length === 0) {
        console.warn(
          '[Central de Alertas] ticket_created: envio SUPRIMIDO — nenhum destinatário encontrado | chamado #' +
            ticketNumber,
        )
        return { sent: false, reason: 'no_recipients' }
      }

      var ticketTitle = ticket.getString('title') || 'Chamado sem título'
      var cleanDescription = (ticket.getString('description') || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleanDescription.length > 500)
        cleanDescription = cleanDescription.substring(0, 497) + '...'
      if (!cleanDescription) cleanDescription = ticketTitle

      var companyName = ''
      if (resolved.companyId) {
        try {
          var comp = $app.findRecordById('companies', resolved.companyId)
          companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
        } catch (_) {}
      }

      var baseUrl = getTicketBaseUrl()
      var templateData = {
        chamado_numero: ticketNumber,
        numero: ticketNumber,
        titulo: ticketTitle,
        descricao: cleanDescription,
        cliente: resolved.requesterName,
        solicitante: resolved.requesterName,
        prioridade: ticket.getString('priority') || 'Média',
        tipo: ticket.getString('type') || 'Incidente',
        data_abertura: formatTicketDate(ticket.getString('created')),
        empresa: companyName,
        link: baseUrl ? baseUrl + '/portal/tickets/' + ticket.id : '',
      }

      var result = sendSystemAlertEmail({
        alert_key: 'ticket_created',
        reference_id: ticket.id,
        recipients: recipientsList,
        subject: 'Chamado #' + ticketNumber + ' registrado com sucesso - ' + ticketTitle,
        data: templateData,
      })

      if (result && result.sent) {
        console.log(
          '[Central de Alertas] ticket_created: enviado com sucesso | chamado #' +
            ticketNumber +
            ' | destinatários=' +
            recipientsList.join(', '),
        )
      } else if (result && result.reason && result.reason !== 'already_sent') {
        console.error(
          '[Central de Alertas] ticket_created: envio não realizado | motivo=' +
            result.reason +
            ' | chamado #' +
            ticketNumber,
        )
      }
      return result
    } catch (err) {
      console.error(
        '[Central de Alertas] ticket_created: FALHA inesperada | chamado #' +
          ticketNumber +
          ' | motivo: ' +
          (err && err.message ? err.message : String(err)),
      )
      return { sent: false, reason: 'unexpected_error' }
    }
  }

  /**
   * Envia o e-mail de RESOLUÇÃO do chamado (alert_key 'ticket_resolved') pela
   * Central de Alertas. Pode ser chamado pelo hook de update OU por rotas
   * customizadas (resolução em massa etc.) — dedup evita envio duplo.
   * opts.oldStatus: status anterior (para não duplicar Resolvido→Encerrado).
   */
  function notifyTicketResolvedEmails(record, auth, opts) {
    if (!record) return { sent: false, reason: 'no_ticket' }
    var resolvedOpts = opts || {}
    var ticketNumber = record.getString('number') || record.id
    console.log('[Central de Alertas] notifyTicketResolvedEmails | chamado #' + ticketNumber)

    try {
      // Mesma regra do hook: Resolvido→Encerrado não duplica notificação ao cliente
      if (
        resolvedOpts.oldStatus === 'Resolvido' &&
        (resolvedOpts.newStatus || '') === 'Encerrado'
      ) {
        return { sent: false, reason: 'resolvido_to_encerrado_skipped' }
      }

      var resolved = resolveTicketClientRecipients(record, auth)
      var recipientsList = resolved.recipients
      if (recipientsList.length === 0) {
        console.warn(
          '[Central de Alertas] ticket_resolved: envio SUPRIMIDO — nenhum destinatário encontrado | chamado #' +
            ticketNumber,
        )
        return { sent: false, reason: 'no_recipients' }
      }

      var ticketTitle = record.getString('title') || 'Chamado sem título'
      var solution = (record.getString('solution') || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (solution.length > 500) solution = solution.substring(0, 497) + '...'

      var companyName = ''
      if (resolved.companyId) {
        try {
          var comp = $app.findRecordById('companies', resolved.companyId)
          companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
        } catch (_) {}
      }

      var baseUrl = getTicketBaseUrl()
      var templateData = {
        chamado_numero: ticketNumber,
        numero: ticketNumber,
        titulo: ticketTitle,
        cliente: resolved.requesterName,
        solicitante: resolved.requesterName,
        empresa: companyName,
        solucao: solution || '(sem descrição de solução)',
        data_resolucao: formatTicketDate(
          record.getString('resolution_date') || record.getString('updated'),
        ),
        link: baseUrl ? baseUrl + '/portal/tickets/' + record.id : '',
      }

      var result = sendSystemAlertEmail({
        alert_key: 'ticket_resolved',
        reference_id: record.id,
        recipients: recipientsList,
        subject: 'Chamado #' + ticketNumber + ' resolvido - ' + ticketTitle,
        data: templateData,
      })

      if (result && result.sent) {
        console.log(
          '[Central de Alertas] ticket_resolved: enviado com sucesso | chamado #' +
            ticketNumber +
            ' | destinatários=' +
            recipientsList.join(', '),
        )
      } else if (result && result.reason && result.reason !== 'already_sent') {
        console.error(
          '[Central de Alertas] ticket_resolved: envio não realizado | motivo=' +
            result.reason +
            ' | chamado #' +
            ticketNumber,
        )
      }
      return result
    } catch (err) {
      console.error(
        '[Central de Alertas] ticket_resolved: FALHA inesperada | chamado #' +
          ticketNumber +
          ' | motivo: ' +
          (err && err.message ? err.message : String(err)),
      )
      return { sent: false, reason: 'unexpected_error' }
    }
  }

  // ==========================================================================
  // Publicação segura no escopo global (Goja / PocketBase JSVM)
  // Publica em _g e, se diferente, também em globalThis
  // ==========================================================================
  try {
    _g.isEmailAlertEnabled = isEmailAlertEnabled
    _g.getEmailAlertConfig = getEmailAlertConfig
    _g.hasEmailAlreadyBeenSent = hasEmailAlreadyBeenSent
    _g.recordEmailSentLog = recordEmailSentLog
    _g.interpolateEmailTemplate = interpolateTemplate
    _g.buildEmailHtmlFromConfig = buildEmailHtmlFromConfig
    _g.sendSystemAlertEmail = sendSystemAlertEmail
    _g.resolveTicketClientRecipients = resolveTicketClientRecipients
    _g.getTicketBaseUrl = getTicketBaseUrl
    _g.formatTicketDate = formatTicketDate
    _g.notifyTicketCreatedEmails = notifyTicketCreatedEmails
    _g.notifyTicketResolvedEmails = notifyTicketResolvedEmails
    _g.emailAlertCentralLoaded = true

    if (typeof globalThis !== 'undefined' && globalThis !== _g) {
      globalThis.isEmailAlertEnabled = isEmailAlertEnabled
      globalThis.getEmailAlertConfig = getEmailAlertConfig
      globalThis.hasEmailAlreadyBeenSent = hasEmailAlreadyBeenSent
      globalThis.recordEmailSentLog = recordEmailSentLog
      globalThis.interpolateEmailTemplate = interpolateTemplate
      globalThis.buildEmailHtmlFromConfig = buildEmailHtmlFromConfig
      globalThis.sendSystemAlertEmail = sendSystemAlertEmail
      globalThis.resolveTicketClientRecipients = resolveTicketClientRecipients
      globalThis.getTicketBaseUrl = getTicketBaseUrl
      globalThis.formatTicketDate = formatTicketDate
      globalThis.notifyTicketCreatedEmails = notifyTicketCreatedEmails
      globalThis.notifyTicketResolvedEmails = notifyTicketResolvedEmails
      globalThis.emailAlertCentralLoaded = true
    }
  } catch (pubErr) {
    console.error(
      '[A0 helpers] ERRO ao publicar helpers no escopo global: ' +
        (pubErr && pubErr.message ? pubErr.message : String(pubErr)),
    )
  }

  // Log de confirmação de carregamento concluído
  try {
    var checkType = typeof _g.sendSystemAlertEmail
    console.log('[A0 helpers] carregado — sendSystemAlertEmail: ' + checkType)
  } catch (_) {}
})()
