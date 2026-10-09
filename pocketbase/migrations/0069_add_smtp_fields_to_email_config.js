migrate(
  (app) => {
    // 1. Estender email_config com os campos de envio SMTP da caixa
    var emailConfig = app.findCollectionByNameOrId('email_config')

    if (!emailConfig.fields.getByName('smtp_host')) {
      emailConfig.fields.add(
        new TextField({
          name: 'smtp_host',
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_port')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'smtp_port',
          onlyInt: true,
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_encryption')) {
      emailConfig.fields.add(
        new SelectField({
          name: 'smtp_encryption',
          values: ['STARTTLS', 'SSL/TLS', 'Nenhuma'],
          maxSelect: 1,
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_user')) {
      emailConfig.fields.add(
        new TextField({
          name: 'smtp_user',
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_password')) {
      emailConfig.fields.add(
        new TextField({
          name: 'smtp_password',
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_sender_name')) {
      emailConfig.fields.add(
        new TextField({
          name: 'smtp_sender_name',
        }),
      )
    }

    if (!emailConfig.fields.getByName('smtp_reply_to')) {
      emailConfig.fields.add(
        new TextField({
          name: 'smtp_reply_to',
        }),
      )
    }

    app.save(emailConfig)

    // 2. Preencher valores padrão na linha existente se houver
    try {
      var records = app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (records.length > 0) {
        var rec = records[0]
        var imapUser = rec.getString('imap_user') || ''
        var imapPass = rec.getString('imap_password') || ''
        var imapHost = (rec.getString('imap_host') || '').toLowerCase()

        if (!rec.getString('smtp_host')) {
          if (imapHost.indexOf('office365.com') !== -1 || imapHost.indexOf('outlook.com') !== -1) {
            rec.set('smtp_host', 'smtp.office365.com')
            rec.set('smtp_port', 587)
            rec.set('smtp_encryption', 'STARTTLS')
          } else if (imapHost.indexOf('gmail.com') !== -1) {
            rec.set('smtp_host', 'smtp.gmail.com')
            rec.set('smtp_port', 587)
            rec.set('smtp_encryption', 'STARTTLS')
          } else {
            rec.set('smtp_host', 'smtp.office365.com')
            rec.set('smtp_port', 587)
            rec.set('smtp_encryption', 'STARTTLS')
          }
        }

        if (!rec.getString('smtp_user') && imapUser) {
          rec.set('smtp_user', imapUser)
        }
        if (!rec.getString('smtp_password') && imapPass) {
          rec.set('smtp_password', imapPass)
        }
        if (!rec.getString('smtp_sender_name')) {
          rec.set('smtp_sender_name', 'Atendimento HelpDesk')
        }
        if (!rec.getString('smtp_reply_to') && imapUser) {
          rec.set('smtp_reply_to', imapUser)
        }

        app.save(rec)
      }
    } catch (_) {}

    // 3. Atualizar email_audit_logs para aceitar teste-smtp
    try {
      var auditCol = app.findCollectionByNameOrId('email_audit_logs')
      var testTypeField = auditCol.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = [
          'connection_test',
          'dry_run_simulation',
          'teste-envio',
          'teste-smtp',
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (auditErr) {
      console.log('Migration 0069: could not update email_audit_logs test_type', auditErr)
    }
  },
  (app) => {
    try {
      var emailConfig = app.findCollectionByNameOrId('email_config')
      var fieldsToRemove = [
        'smtp_host',
        'smtp_port',
        'smtp_encryption',
        'smtp_user',
        'smtp_password',
        'smtp_sender_name',
        'smtp_reply_to',
      ]
      for (var i = 0; i < fieldsToRemove.length; i++) {
        var f = emailConfig.fields.getByName(fieldsToRemove[i])
        if (f) emailConfig.fields.remove(f)
      }
      app.save(emailConfig)
    } catch (_) {}
  },
)
