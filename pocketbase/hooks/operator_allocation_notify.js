/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Notificação de Nova Alocação de Operador (Lógos AITSM / Skip Cloud)
// ----------------------------------------------------------------------------
// Quando um registro em operator_allocations é criado com active=true (ou um
// registro existente é reativado — active false→true), notifica o operador:
//   (a) notificação in-app (coleção notifications, type 'Atribuição');
//   (b) e-mail via Central de Alertas (alert_key = 'operator_allocation_notify',
//       criado DESLIGADO pela migração 0170 — o envio só ocorre com o alerta
//       ligado na Central).
// Anti-duplicidade: e-mails registrados em email_sent_logs (reference_id =
// allocation id + ':' + data do dia); notificação in-app verificada por
// usuário+title+data (uma por operador/dia/título).
// Módulo 100% autocontido (resiliente ao escopo isolado do Goja JSVM no PocketBase):
// TODA a lógica fica inline dentro de cada callback — nem funções top-level do
// arquivo, nem helpers publicados via globalThis (_g) são visíveis nos callbacks
// neste pool (padrão comprovado de ticket_created_client_email.js /
// ticket_approval_check.js).
// Sempre invoca e.next() para manter a cadeia de hooks.
// ============================================================================

// ---------------------------------------------------------------------------
// CALLBACK 1: criação de alocação
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess(function (e) {
  try {
    var allocation = e.record
    if (!allocation) return e.next()
    if (!allocation.getBool('active')) return e.next()

    console.log(
      '[ALOC_OPERATOR] criação ativa detectada (id=' + allocation.id + ') — notificando operador',
    )

    var operatorId = allocation.getString('operator')
    var companyId = allocation.getString('company')
    var unitId = allocation.getString('unit') || ''

    if (!operatorId || !companyId) {
      console.warn('[ALOC_OPERATOR] alocação sem operador ou cliente — nada a fazer')
      return e.next()
    }

    var operatorName = ''
    var operatorEmail = ''
    try {
      var op = $app.findRecordById('users', operatorId)
      operatorName = op.getString('name') || 'Operador'
      operatorEmail = (op.getString('email') || '').trim()
    } catch (errOp) {
      console.warn(
        '[ALOC_OPERATOR] operador não encontrado (' +
          (errOp && errOp.message ? errOp.message : String(errOp)) +
          ')',
      )
    }

    var companyName = ''
    try {
      var comp = $app.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var unitName = ''
    if (unitId) {
      try {
        var unitRec = $app.findRecordById('company_units', unitId)
        unitName = unitRec.getString('name') || ''
      } catch (_) {}
    }

    var allocationType = allocation.getString('allocation_type') || 'permanente'
    var typeLabel =
      allocationType === 'permanente' ? 'Exclusiva / Permanente' : 'Por Período (recorrência)'

    // Recorrência resumida (dias/semanas/meses), espelha formatRecurrence do frontend
    var recurrenceSummary = 'Exclusiva — sempre'
    if (allocationType === 'periodo') {
      recurrenceSummary = 'Todo o período da vigência'
      try {
        var recJson = allocation.getString('recurrence_json') || ''
        if (recJson) {
          var rec = JSON.parse(recJson)
          var parts = []
          var weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          var monthNames = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
          ]
          if (rec.days_of_week && rec.days_of_week.length > 0) {
            var sortedDays = rec.days_of_week.slice().sort(function (a, b) {
              return a - b
            })
            var dayLabels = []
            for (var dIdx = 0; dIdx < sortedDays.length; dIdx++) {
              dayLabels.push(weekdayLabels[sortedDays[dIdx]] || String(sortedDays[dIdx]))
            }
            parts.push('Dias: ' + dayLabels.join(', '))
          }
          if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
            var sortedWeeks = rec.weeks_of_month.slice().sort(function (a, b) {
              return a - b
            })
            parts.push('Semana(s): ' + sortedWeeks.join(', '))
          }
          if (rec.months && rec.months.length > 0) {
            var sortedMonths = rec.months.slice().sort(function (a, b) {
              return a - b
            })
            var monthLabels = []
            for (var mIdx = 0; mIdx < sortedMonths.length; mIdx++) {
              monthLabels.push(monthNames[sortedMonths[mIdx] - 1] || String(sortedMonths[mIdx]))
            }
            parts.push('Meses: ' + monthLabels.join(', '))
          }
          if (parts.length > 0) recurrenceSummary = parts.join(' · ')
        }
      } catch (_) {}
    }

    function localFormatDate(raw) {
      if (!raw) return ''
      var d = new Date(raw)
      if (isNaN(d.getTime())) return String(raw)
      return (
        ('0' + d.getDate()).slice(-2) +
        '/' +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        '/' +
        d.getFullYear()
      )
    }

    var vigenciaParts = []
    var startDate = allocation.getString('start_date') || ''
    var endDate = allocation.getString('end_date') || ''
    if (startDate) vigenciaParts.push('Início: ' + localFormatDate(startDate))
    if (endDate) vigenciaParts.push('Fim: ' + localFormatDate(endDate))
    var vigencia = vigenciaParts.length > 0 ? vigenciaParts.join(' | ') : 'Sem prazo definido'

    var notes = (allocation.getString('notes') || '').trim() || '—'
    var todayPrefix = new Date().toISOString().slice(0, 10)
    var notifTitle = 'Nova alocação: ' + (companyName || 'Cliente')

    // =======================================================================
    // (a) NOTIFICAÇÃO IN-APP (uma por operador/dia/título)
    // =======================================================================
    var alreadyNotified = false
    try {
      var cleanOpId = String(operatorId).replace(/"/g, '\\"')
      var cleanTitle = notifTitle.replace(/"/g, '\\"')
      var dupNotif = $app.findFirstRecordByFilter(
        'notifications',
        'user = "' +
          cleanOpId +
          '" && title = "' +
          cleanTitle +
          '" && created >= "' +
          todayPrefix +
          ' 00:00:00.000Z"',
      )
      alreadyNotified = !!dupNotif
    } catch (_) {}

    if (alreadyNotified) {
      console.log('[ALOC_OPERATOR] notificação in-app já existe hoje para este operador — pulada')
    } else {
      try {
        var notifsCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifsCol)
        notif.set('user', operatorId)
        notif.set('title', notifTitle)
        notif.set(
          'message',
          'Você foi alocado ao cliente ' +
            (companyName || 'Cliente') +
            (unitName ? ' (' + unitName + ')' : '') +
            '. Tipo: ' +
            typeLabel +
            '. Recorrência: ' +
            recurrenceSummary +
            '. Vigência: ' +
            vigencia +
            '.',
        )
        notif.set('type', 'Atribuição')
        notif.set('read', false)
        $app.save(notif)
        console.log('[ALOC_OPERATOR] notificação in-app criada para ' + operatorName)
      } catch (errN) {
        console.error(
          '[ALOC_OPERATOR] falha na notificação in-app: ' +
            (errN && errN.message ? errN.message : String(errN)),
        )
      }
    }

    // =======================================================================
    // (b) E-MAIL VIA CENTRAL DE ALERTAS (só com o alerta LIGADO)
    // =======================================================================
    if (!operatorEmail) {
      console.warn('[ALOC_OPERATOR] operador sem e-mail — envio pulado')
      return e.next()
    }

    var templateData = {
      operador: operatorName,
      cliente: companyName || 'Cliente',
      unidade: unitName || '— (sede)',
      tipo_alocacao: typeLabel,
      recorrencia: recurrenceSummary,
      vigencia: vigencia,
      observacoes: notes,
    }

    var cfg = null
    try {
      cfg = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "operator_allocation_notify"',
      )
    } catch (errCfg) {
      console.error(
        '[ALOC_OPERATOR] falha ao ler email_alert_settings: ' +
          (errCfg && errCfg.message ? errCfg.message : String(errCfg)),
      )
    }

    if (!cfg) {
      console.error(
        '[ALOC_OPERATOR] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify)',
      )
      return e.next()
    }
    if (!cfg.getBool('enabled')) {
      console.log(
        '[ALOC_OPERATOR] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify)',
      )
      return e.next()
    }

    function localInterpolateTemplate(template, data) {
      if (!template) return ''
      var result = template
      if (data && typeof data === 'object') {
        var keys = Object.keys(data)
        for (var i = 0; i < keys.length; i++) {
          var val = data[keys[i]] == null ? '' : String(data[keys[i]])
          result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
        }
      }
      return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
    }

    function localHasEmailAlreadyBeenSent(referenceId, recipient) {
      if (!referenceId || !recipient) return false
      try {
        var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
        var rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "operator_allocation_notify" && reference_id = "' +
            String(referenceId).trim().replace(/"/g, '\\"') +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
        return !!rec
      } catch (_) {
        return false
      }
    }

    function localRecordEmailSentLog(referenceId, recipient, subject) {
      if (!referenceId || !recipient) return
      try {
        var col = $app.findCollectionByNameOrId('email_sent_logs')
        var log = new Record(col)
        log.set('alert_key', 'operator_allocation_notify')
        log.set('reference_id', String(referenceId).trim())
        log.set('recipient', String(recipient).trim().toLowerCase())
        log.set('sent_at', new Date().toISOString().replace('T', ' '))
        log.set('subject', subject || '')
        log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
        $app.save(log)
      } catch (errL) {
        console.warn(
          '[ALOC_OPERATOR] falha ao salvar email_sent_logs: ' +
            (errL && errL.message ? errL.message : String(errL)),
        )
      }
    }

    function localBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
      var primaryColor = cfg.getString('primary_color') || '#D97706'
      var headerTitle = cfg.getString('header_title') || 'Lógos AITSM'
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
        '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
        primaryColor +
        '; text-align: left;">' +
        '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
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
        '</td></tr>' +
        '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    var bodyTemplate =
      cfg.getString('body_template') || cfg.getString('default_body_template') || ''
    var subjectTemplate =
      cfg.getString('subject_template') ||
      cfg.getString('default_subject_template') ||
      'Nova alocação: {{cliente}}'
    var headerSubtitle = cfg.getString('header_subtitle') || 'Central de Alocação de Operadores'
    var footerText = cfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente'

    var subject = localInterpolateTemplate(subjectTemplate, templateData)
    var bodyContent = localInterpolateTemplate(bodyTemplate, templateData)
    var htmlContent = localBuildEmailHtml(bodyContent, headerSubtitle, footerText)
    var textFallback = bodyContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    var referenceId = allocation.id + ':' + todayPrefix
    var recipient = operatorEmail.trim().toLowerCase()

    if (localHasEmailAlreadyBeenSent(referenceId, recipient)) {
      console.log(
        '[ALOC_OPERATOR] e-mail já enviado hoje para este operador — pulado (anti-duplicidade)',
      )
      return e.next()
    }

    try {
      var senderAddress = 'noreply@mail.goskip.dev'
      var senderName = 'Lógos AITSM'
      try {
        var s = $app.settings
        if (typeof s === 'function') s = s()
        if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
        if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
      } catch (_) {}

      var message = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: recipient }],
        subject: subject,
        html: htmlContent,
        text: textFallback,
      })
      $app.newMailClient().send(message)
      localRecordEmailSentLog(referenceId, recipient, subject)
      console.log(
        '[ALOC_OPERATOR] e-mail enviado via Skip Cloud | destinatário=' +
          recipient +
          ' | assunto=' +
          subject,
      )
    } catch (errSend) {
      console.error(
        '[ALOC_OPERATOR] FALHA no envio Skip Cloud | destinatário=' +
          recipient +
          ' | motivo: ' +
          (errSend && errSend.message ? errSend.message : String(errSend)),
      )
    }
  } catch (err) {
    console.error(
      '[ALOC_OPERATOR] FALHA inesperada (criação) | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'operator_allocations')

// ---------------------------------------------------------------------------
// CALLBACK 2: atualização — dispara SOMENTE na reativação (active false→true)
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess(function (e) {
  var record = e.record
  if (!record) return e.next()

  var original = null
  try {
    original = record.original()
  } catch (_) {}
  if (!original) return e.next()

  var wasActive = original.getBool('active')
  var isActive = record.getBool('active')

  // Salvo sem mudança de estado (ou desativação) → nada a fazer (sem duplicidade)
  if (!(isActive && !wasActive)) return e.next()

  console.log('[ALOC_OPERATOR] reativação detectada (id=' + record.id + ') — notificando operador')

  try {
    var allocation = record
    var operatorId = allocation.getString('operator')
    var companyId = allocation.getString('company')
    var unitId = allocation.getString('unit') || ''

    if (!operatorId || !companyId) {
      console.warn('[ALOC_OPERATOR] alocação sem operador ou cliente — nada a fazer')
      return e.next()
    }

    var operatorName = ''
    var operatorEmail = ''
    try {
      var op = $app.findRecordById('users', operatorId)
      operatorName = op.getString('name') || 'Operador'
      operatorEmail = (op.getString('email') || '').trim()
    } catch (_) {}

    var companyName = ''
    try {
      var comp = $app.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var unitName = ''
    if (unitId) {
      try {
        var unitRec = $app.findRecordById('company_units', unitId)
        unitName = unitRec.getString('name') || ''
      } catch (_) {}
    }

    var allocationType = allocation.getString('allocation_type') || 'permanente'
    var typeLabel =
      allocationType === 'permanente' ? 'Exclusiva / Permanente' : 'Por Período (recorrência)'

    var recurrenceSummary = 'Exclusiva — sempre'
    if (allocationType === 'periodo') {
      recurrenceSummary = 'Todo o período da vigência'
      try {
        var recJson = allocation.getString('recurrence_json') || ''
        if (recJson) {
          var rec = JSON.parse(recJson)
          var parts = []
          var weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          var monthNames = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
          ]
          if (rec.days_of_week && rec.days_of_week.length > 0) {
            var sortedDays = rec.days_of_week.slice().sort(function (a, b) {
              return a - b
            })
            var dayLabels = []
            for (var dIdx = 0; dIdx < sortedDays.length; dIdx++) {
              dayLabels.push(weekdayLabels[sortedDays[dIdx]] || String(sortedDays[dIdx]))
            }
            parts.push('Dias: ' + dayLabels.join(', '))
          }
          if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
            var sortedWeeks = rec.weeks_of_month.slice().sort(function (a, b) {
              return a - b
            })
            parts.push('Semana(s): ' + sortedWeeks.join(', '))
          }
          if (rec.months && rec.months.length > 0) {
            var sortedMonths = rec.months.slice().sort(function (a, b) {
              return a - b
            })
            var monthLabels = []
            for (var mIdx = 0; mIdx < sortedMonths.length; mIdx++) {
              monthLabels.push(monthNames[sortedMonths[mIdx] - 1] || String(sortedMonths[mIdx]))
            }
            parts.push('Meses: ' + monthLabels.join(', '))
          }
          if (parts.length > 0) recurrenceSummary = parts.join(' · ')
        }
      } catch (_) {}
    }

    function localFormatDate(raw) {
      if (!raw) return ''
      var d = new Date(raw)
      if (isNaN(d.getTime())) return String(raw)
      return (
        ('0' + d.getDate()).slice(-2) +
        '/' +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        '/' +
        d.getFullYear()
      )
    }

    var vigenciaParts = []
    var startDate = allocation.getString('start_date') || ''
    var endDate = allocation.getString('end_date') || ''
    if (startDate) vigenciaParts.push('Início: ' + localFormatDate(startDate))
    if (endDate) vigenciaParts.push('Fim: ' + localFormatDate(endDate))
    var vigencia = vigenciaParts.length > 0 ? vigenciaParts.join(' | ') : 'Sem prazo definido'

    var notes = (allocation.getString('notes') || '').trim() || '—'
    var todayPrefix = new Date().toISOString().slice(0, 10)
    var notifTitle = 'Nova alocação: ' + (companyName || 'Cliente')

    // ---- (a) notificação in-app (uma por operador/dia/título) ----
    var alreadyNotified = false
    try {
      var cleanOpId = String(operatorId).replace(/"/g, '\\"')
      var cleanTitle = notifTitle.replace(/"/g, '\\"')
      var dupNotif = $app.findFirstRecordByFilter(
        'notifications',
        'user = "' +
          cleanOpId +
          '" && title = "' +
          cleanTitle +
          '" && created >= "' +
          todayPrefix +
          ' 00:00:00.000Z"',
      )
      alreadyNotified = !!dupNotif
    } catch (_) {}

    if (alreadyNotified) {
      console.log('[ALOC_OPERATOR] notificação in-app já existe hoje para este operador — pulada')
    } else {
      try {
        var notifsCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifsCol)
        notif.set('user', operatorId)
        notif.set('title', notifTitle)
        notif.set(
          'message',
          'Você foi alocado ao cliente ' +
            (companyName || 'Cliente') +
            (unitName ? ' (' + unitName + ')' : '') +
            '. Tipo: ' +
            typeLabel +
            '. Recorrência: ' +
            recurrenceSummary +
            '. Vigência: ' +
            vigencia +
            '.',
        )
        notif.set('type', 'Atribuição')
        notif.set('read', false)
        $app.save(notif)
        console.log('[ALOC_OPERATOR] notificação in-app (reativação) criada para ' + operatorName)
      } catch (errN) {
        console.error(
          '[ALOC_OPERATOR] falha na notificação in-app (reativação): ' +
            (errN && errN.message ? errN.message : String(errN)),
        )
      }
    }

    // ---- (b) e-mail via Central de Alertas (só com o alerta LIGADO) ----
    if (!operatorEmail) {
      console.warn('[ALOC_OPERATOR] operador sem e-mail — envio pulado')
      return e.next()
    }

    var templateData = {
      operador: operatorName,
      cliente: companyName || 'Cliente',
      unidade: unitName || '— (sede)',
      tipo_alocacao: typeLabel,
      recorrencia: recurrenceSummary,
      vigencia: vigencia,
      observacoes: notes,
    }

    var cfg = null
    try {
      cfg = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "operator_allocation_notify"',
      )
    } catch (errCfg) {
      console.error(
        '[ALOC_OPERATOR] falha ao ler email_alert_settings: ' +
          (errCfg && errCfg.message ? errCfg.message : String(errCfg)),
      )
    }

    if (!cfg) {
      console.error(
        '[ALOC_OPERATOR] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify)',
      )
      return e.next()
    }
    if (!cfg.getBool('enabled')) {
      console.log(
        '[ALOC_OPERATOR] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify)',
      )
      return e.next()
    }

    function localInterpolateTemplate(template, data) {
      if (!template) return ''
      var result = template
      if (data && typeof data === 'object') {
        var keys = Object.keys(data)
        for (var i = 0; i < keys.length; i++) {
          var val = data[keys[i]] == null ? '' : String(data[keys[i]])
          result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
        }
      }
      return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
    }

    function localHasEmailAlreadyBeenSent(referenceId, recipient) {
      if (!referenceId || !recipient) return false
      try {
        var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
        var rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "operator_allocation_notify" && reference_id = "' +
            String(referenceId).trim().replace(/"/g, '\\"') +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
        return !!rec
      } catch (_) {
        return false
      }
    }

    function localRecordEmailSentLog(referenceId, recipient, subject) {
      if (!referenceId || !recipient) return
      try {
        var col = $app.findCollectionByNameOrId('email_sent_logs')
        var log = new Record(col)
        log.set('alert_key', 'operator_allocation_notify')
        log.set('reference_id', String(referenceId).trim())
        log.set('recipient', String(recipient).trim().toLowerCase())
        log.set('sent_at', new Date().toISOString().replace('T', ' '))
        log.set('subject', subject || '')
        log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
        $app.save(log)
      } catch (errL) {
        console.warn(
          '[ALOC_OPERATOR] falha ao salvar email_sent_logs: ' +
            (errL && errL.message ? errL.message : String(errL)),
        )
      }
    }

    function localBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
      var primaryColor = cfg.getString('primary_color') || '#D97706'
      var headerTitle = cfg.getString('header_title') || 'Lógos AITSM'
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
        '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
        primaryColor +
        '; text-align: left;">' +
        '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
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
        '</td></tr>' +
        '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
        footerText +
        '</td></tr></table></body></html>'
      )
    }

    var bodyTemplate =
      cfg.getString('body_template') || cfg.getString('default_body_template') || ''
    var subjectTemplate =
      cfg.getString('subject_template') ||
      cfg.getString('default_subject_template') ||
      'Nova alocação: {{cliente}}'
    var headerSubtitle = cfg.getString('header_subtitle') || 'Central de Alocação de Operadores'
    var footerText = cfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente'

    var subject = localInterpolateTemplate(subjectTemplate, templateData)
    var bodyContent = localInterpolateTemplate(bodyTemplate, templateData)
    var htmlContent = localBuildEmailHtml(bodyContent, headerSubtitle, footerText)
    var textFallback = bodyContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    var referenceId = allocation.id + ':' + todayPrefix
    var recipient = operatorEmail.trim().toLowerCase()

    if (localHasEmailAlreadyBeenSent(referenceId, recipient)) {
      console.log(
        '[ALOC_OPERATOR] e-mail já enviado hoje para este operador — pulado (anti-duplicidade)',
      )
      return e.next()
    }

    try {
      var senderAddress = 'noreply@mail.goskip.dev'
      var senderName = 'Lógos AITSM'
      try {
        var s = $app.settings
        if (typeof s === 'function') s = s()
        if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
        if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
      } catch (_) {}

      var message = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: recipient }],
        subject: subject,
        html: htmlContent,
        text: textFallback,
      })
      $app.newMailClient().send(message)
      localRecordEmailSentLog(referenceId, recipient, subject)
      console.log(
        '[ALOC_OPERATOR] e-mail enviado via Skip Cloud | destinatário=' +
          recipient +
          ' | assunto=' +
          subject,
      )
    } catch (errSend) {
      console.error(
        '[ALOC_OPERATOR] FALHA no envio Skip Cloud | destinatário=' +
          recipient +
          ' | motivo: ' +
          (errSend && errSend.message ? errSend.message : String(errSend)),
      )
    }
  } catch (err) {
    console.error(
      '[ALOC_OPERATOR] FALHA inesperada (reativação) | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'operator_allocations')
