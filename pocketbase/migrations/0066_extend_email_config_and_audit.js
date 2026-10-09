migrate(
  (app) => {
    // 1. Estender email_config com novos campos IMAP
    var emailConfig = app.findCollectionByNameOrId('email_config')

    if (!emailConfig.fields.getByName('imap_password')) {
      emailConfig.fields.add(
        new TextField({
          name: 'imap_password',
        }),
      )
    }

    if (!emailConfig.fields.getByName('imap_encryption')) {
      emailConfig.fields.add(
        new SelectField({
          name: 'imap_encryption',
          values: ['SSL/TLS', 'STARTTLS', 'Nenhuma'],
          maxSelect: 1,
        }),
      )
    }

    if (!emailConfig.fields.getByName('inbox_folder')) {
      emailConfig.fields.add(
        new TextField({
          name: 'inbox_folder',
        }),
      )
    }

    if (!emailConfig.fields.getByName('processed_folder')) {
      emailConfig.fields.add(
        new TextField({
          name: 'processed_folder',
        }),
      )
    }

    app.save(emailConfig)

    // Atualizar defaults no registro existente se houver
    try {
      var records = app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (records.length > 0) {
        var rec = records[0]
        if (!rec.getString('imap_encryption')) {
          rec.set('imap_encryption', rec.getBool('imap_ssl') ? 'SSL/TLS' : 'STARTTLS')
        }
        if (!rec.getString('inbox_folder')) {
          rec.set('inbox_folder', 'INBOX')
        }
        if (!rec.getString('processed_folder')) {
          rec.set('processed_folder', 'Processados')
        }
        app.save(rec)
      }
    } catch (_) {}

    // 2. Criar coleção email_audit_logs para histórico de diagnósticos e testes
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findCollectionByNameOrId('email_audit_logs')
    } catch (_) {
      var emailAuditLogs = new Collection({
        name: 'email_audit_logs',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          {
            name: 'test_type',
            type: 'select',
            required: true,
            values: ['connection_test', 'dry_run_simulation'],
            maxSelect: 1,
          },
          {
            name: 'executed_by',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'executed_by_name', type: 'text' },
          { name: 'executed_by_email', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['success', 'warning', 'failed'],
            maxSelect: 1,
          },
          { name: 'host', type: 'text' },
          { name: 'port', type: 'number' },
          { name: 'user_account', type: 'text' },
          { name: 'inbox_folder', type: 'text' },
          { name: 'encryption', type: 'text' },
          { name: 'steps_result', type: 'json' },
          { name: 'summary_message', type: 'text' },
          { name: 'latest_messages_count', type: 'number' },
          { name: 'latest_messages', type: 'json' },
          { name: 'dry_run_result', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_email_audit_type ON email_audit_logs (test_type)',
          'CREATE INDEX idx_email_audit_status ON email_audit_logs (status)',
          'CREATE INDEX idx_email_audit_created ON email_audit_logs (created DESC)',
        ],
      })
      app.save(emailAuditLogs)
    }
  },
  (app) => {
    try {
      var emailAuditLogs = app.findCollectionByNameOrId('email_audit_logs')
      app.delete(emailAuditLogs)
    } catch (_) {}

    try {
      var emailConfig = app.findCollectionByNameOrId('email_config')
      var f1 = emailConfig.fields.getByName('imap_password')
      if (f1) emailConfig.fields.remove(f1)
      var f2 = emailConfig.fields.getByName('imap_encryption')
      if (f2) emailConfig.fields.remove(f2)
      var f3 = emailConfig.fields.getByName('inbox_folder')
      if (f3) emailConfig.fields.remove(f3)
      var f4 = emailConfig.fields.getByName('processed_folder')
      if (f4) emailConfig.fields.remove(f4)
      app.save(emailConfig)
    } catch (_) {}
  },
)
