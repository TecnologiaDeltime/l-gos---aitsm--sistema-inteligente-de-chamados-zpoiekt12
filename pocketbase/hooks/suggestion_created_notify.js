/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Notificação de NOVA SUGESTÃO à gestão (Central de Alertas)
// ----------------------------------------------------------------------------
// Gatilho: onRecordAfterCreateSuccess da coleção "suggestions" (v0.0.541).
//
// PÚBLICO (requisito): todos os usuários ATIVOS com poder de gerenciar
// sugestões, EXCETO o próprio autor:
//   - role "admin" ou "gestor" (poder inerente, mesmo sem perfil/permissões);
//   - usuários de QUALQUER papel com o item granular suggestions_gerenciar
//     concedido no perfil (coleção profile_permissions), nível view/edit/configure;
//   - autor (por id e por e-mail) sempre excluído.
//
// NOTIFICAÇÃO IN-APP (sino): registro em "notifications" (type "Sistema"),
// sem depender de toggle — o sino é para quem gerencia, nasce junto.
//
// E-MAIL TRANSACIONAL: via Central de Alertas — alert_key
// "suggestion_created_notify" (seed da migração 0556, nascendo DESLIGADO).
// LÊ a config direto de email_alert_settings por alert_key e só envia com o
// alerta LIGADO (toggle na Central de Alertas). Com o alerta desligado, apenas
// a notificação in-app dispara.
//
// LIÇÕES DO PROJETO APLICADAS (JSVM/Goja):
//   - Tudo que o callback usa é declarado DENTRO dele — funções/vars top-level
//     de outros arquivos NÃO são visíveis em callbacks (nada de globalThis/_g);
//   - Padrão do bloco (c.2) de pocketbase/hooks/operator_allocation_notify.js:
//     interpolador de template + MailerMessage + $app.newMailClient().send +
//     log em email_sent_logs com anti-duplicidade, tudo inline;
//   - Slugs de hook sem dígitos.
// ============================================================================

onRecordAfterCreateSuccess(function (e) {
  var record = null
  try {
    record = e.record
  } catch (_) {
    record = null
  }
  if (!record) return e.next()

  try {
    var collectionName = record.collection().name
    if (collectionName !== 'suggestions') return e.next()
  } catch (errCol) {
    console.error('[SUGGEST_NOTIFY] falha ao resolver coleção do registro: ' + String(errCol))
    return e.next()
  }

  try {
    var suggestionId = record.id

    // ---- Dados da sugestão -------------------------------------------------
    var title = (record.getString('title') || 'Sem título').trim()
    var category = (record.getString('category') || 'Sem categoria').trim()
    var rawDescription = (record.getString('description') || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    var shortDescription =
      rawDescription.length > 300 ? rawDescription.slice(0, 297) + '...' : rawDescription
    var authorId = record.getString('author') || ''

    var authorName = 'Operador'
    var authorEmail = ''
    try {
      if (authorId) {
        var authorRec = $app.findRecordById('users', authorId)
        authorName = authorRec.getString('name') || 'Operador'
        authorEmail = (authorRec.getString('email') || '').trim().toLowerCase()
      }
    } catch (_) {
      // autor pode não existir mais — segue sem bloquear a notificação
    }

    // ---- Helpers inline (escopo do callback — nada de globais) -------------

    function suggestFormatDate(raw) {
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

    function suggestGetBaseUrl() {
      try {
        var host = $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || ''
        if (host) return host.replace(/\/+$/, '')
      } catch (_) {}
      return ''
    }

    function suggestInterpolate(template, data) {
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

    function suggestHasEmailAlreadyBeenSent(referenceId, recipient) {
      if (!referenceId || !recipient) return false
      try {
        var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
        var cleanRefId = String(referenceId).trim().replace(/"/g, '\\"')
        var rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "suggestion_created_notify" && reference_id = "' +
            cleanRefId +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
        return !!rec
      } catch (_) {
        return false
      }
    }

    function suggestRecordEmailSentLog(referenceId, recipient, subject) {
      if (!referenceId || !recipient) return
      try {
        var col = $app.findCollectionByNameOrId('email_sent_logs')
        var log = new Record(col)
        log.set('alert_key', 'suggestion_created_notify')
        log.set('reference_id', String(referenceId).trim())
        log.set('recipient', String(recipient).trim().toLowerCase())
        log.set('sent_at', new Date().toISOString().replace('T', ' '))
        log.set('subject', subject || '')
        log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
        $app.save(log)
      } catch (errL) {
        console.warn(
          '[SUGGEST_NOTIFY] falha ao salvar email_sent_logs: ' +
            (errL && errL.message ? errL.message : String(errL)),
        )
      }
    }

    // ---- Resolvedor: quem gerencia sugestões -------------------------------
    function suggestResolveManagers() {
      var managers = []
      var seen = {}
      var add = function (rec) {
        if (!rec || seen[rec.id]) return
        if (!rec.getBool('active')) return
        if (rec.id === authorId) return // o autor nunca se notifica
        var email = (rec.getString('email') || '').trim().toLowerCase()
        if (rec.id === authorId || (authorEmail && email === authorEmail)) return
        seen[rec.id] = true
        managers.push(rec)
      }

      // (1) admin e gestor: poder inerente de gerenciar sugestões.
      try {
        var core = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', '', 0, 0)
        for (var i = 0; i < core.length; i++) add(core[i])
      } catch (errCore) {
        console.error(
          '[SUGGEST_NOTIFY] falha ao resolver admin/gestor: ' +
            (errCore && errCore.message ? errCore.message : String(errCore)),
        )
      }

      // (2) qualquer papel com o item granular concedido no perfil — cobre o
      //     perfil "qualidade" citado no requisito, sem hardcode.
      try {
        var grants = $app.findRecordsByFilter(
          'profile_permissions',
          'item_key = "suggestions_gerenciar" && granted = true',
          '',
          0,
          0,
        )
        var grantedProfileIds = {}
        for (var g = 0; g < grants.length; g++) {
          var pid = grants[g].getString('profile') || ''
          if (pid) grantedProfileIds[pid] = true
        }
        var profileIds = Object.keys(grantedProfileIds)
        if (profileIds.length > 0) {
          var filter = ''
          for (var p = 0; p < profileIds.length; p++) {
            var clean = profileIds[p].replace(/"/g, '\\"')
            filter = filter + (filter ? ' || ' : '') + 'profile_id = "' + clean + '"'
          }
          var withProfile = $app.findRecordsByFilter('users', filter, '', 0, 0)
          for (var w = 0; w < withProfile.length; w++) add(withProfile[w])
        }
      } catch (errGranular) {
        console.error(
          '[SUGGEST_NOTIFY] falha ao resolver suggestions_gerenciar: ' +
            (errGranular && errGranular.message ? errGranular.message : String(errGranular)),
        )
      }

      return managers
    }

    var managers = suggestResolveManagers()
    console.log('[SUGGEST_NOTIFY] nova sugestão id=' + suggestionId + ' | autor=' + authorName)
    console.log('[SUGGEST_NOTIFY] gestores elegíveis para notificação: ' + managers.length)

    if (managers.length === 0) {
      console.log('[SUGGEST_NOTIFY] nenhum destinatário elegível — notificação pulada')
      return e.next()
    }

    // ---- Título/mensagem da notificação in-app (sino) ----------------------
    var bellTitle = 'Nova sugestão: ' + title
    var bellMessage =
      'O operador ' + authorName + ' registrou a sugestão "' + title + '" (' + category + ').'

    // ---- (1) notificação in-app (sino) para cada gestor -------------------
    for (var ni = 0; ni < managers.length; ni++) {
      try {
        var notifCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifCol)
        notif.set('user', managers[ni].id)
        notif.set('title', bellTitle)
        notif.set('message', bellMessage)
        notif.set('type', 'Sistema')
        notif.set('read', false)
        $app.save(notif)
      } catch (errNotif) {
        console.error(
          '[SUGGEST_NOTIFY] falha na notificação in-app para ' +
            (managers[ni].getString('name') || managers[ni].id) +
            ': ' +
            (errNotif && errNotif.message ? errNotif.message : String(errNotif)),
        )
      }
    }
    console.log('[SUGGEST_NOTIFY] notificações in-app criadas: ' + managers.length)

    // ---- (2) e-mail transacional via Central de Alertas (só com alerta LIGADO) ----
    var cfg = null
    try {
      cfg = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "suggestion_created_notify"',
      )
    } catch (errCfg) {
      console.error(
        '[SUGGEST_NOTIFY] falha ao ler email_alert_settings: ' +
          (errCfg && errCfg.message ? errCfg.message : String(errCfg)),
      )
    }

    if (!cfg) {
      console.error(
        '[SUGGEST_NOTIFY] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=suggestion_created_notify)',
      )
    } else if (!cfg.getBool('enabled')) {
      console.log(
        '[SUGGEST_NOTIFY] e-mail PULADO — alerta DESLIGADO na Central de Alertas (suggestion_created_notify)',
      )
    } else {
      var baseUrl = suggestGetBaseUrl()
      var templateData = {
        titulo: title,
        categoria: category,
        autor: authorName,
        descricao: shortDescription,
        data: suggestFormatDate(new Date()),
        link: baseUrl ? baseUrl + '/suggestions' : '',
      }

      var primaryColor = cfg.getString('primary_color') || '#D97706'
      var headerTitle = cfg.getString('header_title') || 'Lógos AITSM'
      var headerSubtitle = cfg.getString('header_subtitle') || 'Central de Alertas'
      var footerText =
        cfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente'

      var bodyTemplate =
        cfg.getString('body_template') || cfg.getString('default_body_template') || ''
      var bodyContent = suggestInterpolate(bodyTemplate, templateData)
      var buttonLabel = suggestInterpolate(cfg.getString('button_label') || 'Acessar', templateData)
      var buttonUrl = suggestInterpolate(cfg.getString('button_url_template') || '', templateData)
      var showButton = Boolean(cfg.getBool('show_button') && buttonUrl)

      var buttonHtml = ''
      if (showButton) {
        buttonHtml =
          '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
          '<tr><td align="center" style="border-radius: 6px; background-color: ' +
          primaryColor +
          ';">' +
          '<a href="' +
          buttonUrl +
          '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; border: 1px solid ' +
          primaryColor +
          '; display: inline-block; font-weight: 600;">' +
          buttonLabel +
          '</a></td></tr></table>'
      }

      var htmlContent =
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
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
        footerText +
        '</td></tr></table></body></html>'

      var textFallback = bodyContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      var subjectTemplate =
        cfg.getString('subject_template') ||
        cfg.getString('default_subject_template') ||
        'Nova sugestão: {{titulo}}'
      var subject = suggestInterpolate(subjectTemplate, templateData)

      for (var ei = 0; ei < managers.length; ei++) {
        var mailManager = managers[ei]
        var mailDisplayName = mailManager.getString('name') || 'Gestor'
        var mailEmail = (mailManager.getString('email') || '').trim().toLowerCase()
        if (!mailEmail) {
          console.warn('[SUGGEST_NOTIFY] gestor sem e-mail — pulado: ' + mailDisplayName)
          continue
        }

        if (suggestHasEmailAlreadyBeenSent(suggestionId, mailEmail)) {
          console.log(
            '[SUGGEST_NOTIFY] e-mail já enviado para ' +
              mailDisplayName +
              ' — pulado (anti-duplicidade)',
          )
          continue
        }

        try {
          var senderAddress = 'noreply@mail.goskip.dev'
          var senderName = 'Lógos AITSM'
          try {
            var settings = $app.settings
            if (typeof settings === 'function') settings = settings()
            if (settings && settings.meta && settings.meta.senderAddress)
              senderAddress = settings.meta.senderAddress
            if (settings && settings.meta && settings.meta.senderName)
              senderName = settings.meta.senderName
          } catch (_) {}

          var message = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: mailEmail }],
            subject: subject,
            html: htmlContent,
            text: textFallback,
          })
          $app.newMailClient().send(message)
          suggestRecordEmailSentLog(suggestionId, mailEmail, subject)
          console.log(
            '[SUGGEST_NOTIFY] e-mail enviado via Skip Cloud | destinatário=' +
              mailEmail +
              ' | assunto=' +
              subject,
          )
        } catch (errSend) {
          console.error(
            '[SUGGEST_NOTIFY] FALHA no envio Skip Cloud | destinatário=' +
              mailEmail +
              ' | motivo: ' +
              (errSend && errSend.message ? errSend.message : String(errSend)),
          )
        }
      }
    }
  } catch (err) {
    console.error(
      '[SUGGEST_NOTIFY] FALHA inesperada | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'suggestions')
