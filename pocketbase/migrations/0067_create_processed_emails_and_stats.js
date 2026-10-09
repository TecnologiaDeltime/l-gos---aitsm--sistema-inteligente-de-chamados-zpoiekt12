migrate(
  (app) => {
    // 1. Criar coleção processed_emails para garantir idempotência absoluta
    // Armazena message_id, hash de conteúdo, remetente, assunto, resultado (ticket / interaction / retained)
    try {
      app.findCollectionByNameOrId('processed_emails')
    } catch (_) {
      var processedEmails = new Collection({
        name: 'processed_emails',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          { name: 'message_id', type: 'text', required: true },
          { name: 'dedupe_hash', type: 'text', required: true },
          { name: 'from_email', type: 'text', required: true },
          { name: 'from_name', type: 'text' },
          { name: 'subject', type: 'text', required: true },
          {
            name: 'outcome',
            type: 'select',
            required: true,
            values: ['ticket_created', 'ticket_replied', 'ticket_retained', 'skipped'],
            maxSelect: 1,
          },
          { name: 'ticket_id', type: 'text' },
          { name: 'ticket_number', type: 'text' },
          { name: 'retained_id', type: 'text' },
          { name: 'interaction_id', type: 'text' },
          { name: 'details', type: 'text' },
          { name: 'processed_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_processed_emails_mid ON processed_emails (message_id)',
          'CREATE INDEX idx_processed_emails_hash ON processed_emails (dedupe_hash)',
          'CREATE INDEX idx_processed_emails_from ON processed_emails (from_email)',
          'CREATE INDEX idx_processed_emails_created ON processed_emails (created DESC)',
        ],
      })
      app.save(processedEmails)
    }

    // 2. Estender email_config com estatísticas operacionais de ingestão
    var emailConfig = app.findCollectionByNameOrId('email_config')
    if (!emailConfig.fields.getByName('last_processed_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'last_processed_count',
        }),
      )
    }
    if (!emailConfig.fields.getByName('total_ingested_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'total_ingested_count',
        }),
      )
    }
    if (!emailConfig.fields.getByName('total_retained_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'total_retained_count',
        }),
      )
    }
    app.save(emailConfig)
  },
  (app) => {
    try {
      var processedEmails = app.findCollectionByNameOrId('processed_emails')
      app.delete(processedEmails)
    } catch (_) {}

    try {
      var emailConfig = app.findCollectionByNameOrId('email_config')
      var f1 = emailConfig.fields.getByName('last_processed_count')
      if (f1) emailConfig.fields.remove(f1)
      var f2 = emailConfig.fields.getByName('total_ingested_count')
      if (f2) emailConfig.fields.remove(f2)
      var f3 = emailConfig.fields.getByName('total_retained_count')
      if (f3) emailConfig.fields.remove(f3)
      app.save(emailConfig)
    } catch (_) {}
  },
)
