// pocketbase/migrations/0133_fix_system_brand_notification_templates.js
// Migração idempotente para garantir a marca oficial "Lógos AITSM"
// em todas as configurações do PocketBase (meta.appName, meta.senderName),
// templates de e-mail do sistema e registros de tabelas que possam conter "AITILSM".

migrate(
  (app) => {
    var BRAND_NAME = 'Lógos AITSM'
    var SENDER_EMAIL = 'noreply@logositsm.com.br'

    function sanitizeString(str) {
      if (!str || typeof str !== 'string') return str
      return str.replace(/L[oó]gos\s+AITILSM/gi, BRAND_NAME).replace(/AITILSM/gi, 'AITSM')
    }

    // 1. Atualizar meta e SMTP padrão do PocketBase (settings do sistema)
    try {
      var settings = app.settings()
      var settingsChanged = false

      if (settings.meta) {
        if (
          !settings.meta.appName ||
          settings.meta.appName.indexOf('AITILSM') !== -1 ||
          settings.meta.appName !== BRAND_NAME
        ) {
          settings.meta.appName = BRAND_NAME
          settingsChanged = true
        }
        if (
          !settings.meta.senderName ||
          settings.meta.senderName.indexOf('AITILSM') !== -1 ||
          settings.meta.senderName !== BRAND_NAME
        ) {
          settings.meta.senderName = BRAND_NAME
          settingsChanged = true
        }
        if (!settings.meta.senderAddress) {
          settings.meta.senderAddress = SENDER_EMAIL
          settingsChanged = true
        }
      }

      if (settings.verificationTemplate) {
        if (
          settings.verificationTemplate.subject &&
          settings.verificationTemplate.subject.indexOf('AITILSM') !== -1
        ) {
          settings.verificationTemplate.subject = sanitizeString(
            settings.verificationTemplate.subject,
          )
          settingsChanged = true
        }
        if (
          settings.verificationTemplate.body &&
          settings.verificationTemplate.body.indexOf('AITILSM') !== -1
        ) {
          settings.verificationTemplate.body = sanitizeString(settings.verificationTemplate.body)
          settingsChanged = true
        }
      }

      if (settings.resetPasswordTemplate) {
        if (
          settings.resetPasswordTemplate.subject &&
          settings.resetPasswordTemplate.subject.indexOf('AITILSM') !== -1
        ) {
          settings.resetPasswordTemplate.subject = sanitizeString(
            settings.resetPasswordTemplate.subject,
          )
          settingsChanged = true
        }
        if (
          settings.resetPasswordTemplate.body &&
          settings.resetPasswordTemplate.body.indexOf('AITILSM') !== -1
        ) {
          settings.resetPasswordTemplate.body = sanitizeString(settings.resetPasswordTemplate.body)
          settingsChanged = true
        }
      }

      if (settings.confirmEmailChangeTemplate) {
        if (
          settings.confirmEmailChangeTemplate.subject &&
          settings.confirmEmailChangeTemplate.subject.indexOf('AITILSM') !== -1
        ) {
          settings.confirmEmailChangeTemplate.subject = sanitizeString(
            settings.confirmEmailChangeTemplate.subject,
          )
          settingsChanged = true
        }
        if (
          settings.confirmEmailChangeTemplate.body &&
          settings.confirmEmailChangeTemplate.body.indexOf('AITILSM') !== -1
        ) {
          settings.confirmEmailChangeTemplate.body = sanitizeString(
            settings.confirmEmailChangeTemplate.body,
          )
          settingsChanged = true
        }
      }

      if (settingsChanged) {
        app.save(settings)
        console.log('0133: PocketBase app.settings() atualizado para Lógos AITSM.')
      }
    } catch (err) {
      console.log('0133: Erro ao checar/salvar app.settings():', err)
    }

    // 2. Coleção email_config (sender_name)
    try {
      var emailConfigs = app.findRecordsByFilter('email_config', '', '-created', 10, 0)
      for (var ec = 0; ec < emailConfigs.length; ec++) {
        var rec = emailConfigs[ec]
        var sName = rec.getString('sender_name')
        if (sName && sName.indexOf('AITILSM') !== -1) {
          rec.set('sender_name', sanitizeString(sName))
          app.save(rec)
          console.log('0133: email_config corrigido:', rec.id)
        }
      }
    } catch (_) {}

    // 3. Coleção notifications (se houver histórico legado com AITILSM)
    try {
      var notifs = app.findRecordsByFilter(
        'notifications',
        "title ~ 'AITILSM' || message ~ 'AITILSM'",
        '-created',
        200,
        0,
      )
      for (var n = 0; n < notifs.length; n++) {
        var nRec = notifs[n]
        var changed = false
        var title = nRec.getString('title')
        var msg = nRec.getString('message')
        if (title && title.indexOf('AITILSM') !== -1) {
          nRec.set('title', sanitizeString(title))
          changed = true
        }
        if (msg && msg.indexOf('AITILSM') !== -1) {
          nRec.set('message', sanitizeString(msg))
          changed = true
        }
        if (changed) {
          app.save(nRec)
        }
      }
      if (notifs.length > 0) {
        console.log('0133: Notificações legadas corrigidas:', notifs.length)
      }
    } catch (_) {}

    // 4. Coleção email_auto_replies (textos de autoresposta)
    try {
      var autoReplies = app.findRecordsByFilter('email_auto_replies', '', '-created', 50, 0)
      for (var ar = 0; ar < autoReplies.length; ar++) {
        var arRec = autoReplies[ar]
        var arChanged = false
        var fields = [
          'receipt_subject',
          'receipt_body',
          'out_of_office_subject',
          'out_of_office_body',
        ]
        for (var f = 0; f < fields.length; f++) {
          var val = arRec.getString(fields[f])
          if (val && val.indexOf('AITILSM') !== -1) {
            arRec.set(fields[f], sanitizeString(val))
            arChanged = true
          }
        }
        if (arChanged) {
          app.save(arRec)
          console.log('0133: email_auto_replies corrigido:', arRec.id)
        }
      }
    } catch (_) {}

    // 5. Coleção design_settings (brand_name, etc.)
    try {
      var designSettings = app.findRecordsByFilter('design_settings', '', '-created', 10, 0)
      for (var ds = 0; ds < designSettings.length; ds++) {
        var dsRec = designSettings[ds]
        var dsChanged = false
        var bName = dsRec.getString('brand_name')
        if (
          bName &&
          (bName.indexOf('AITILSM') !== -1 || bName.toLowerCase().indexOf('aitilsm') !== -1)
        ) {
          dsRec.set('brand_name', sanitizeString(bName))
          dsChanged = true
        }
        if (dsChanged) {
          app.save(dsRec)
          console.log('0133: design_settings corrigido:', dsRec.id)
        }
      }
    } catch (_) {}
  },
  (app) => {},
)
