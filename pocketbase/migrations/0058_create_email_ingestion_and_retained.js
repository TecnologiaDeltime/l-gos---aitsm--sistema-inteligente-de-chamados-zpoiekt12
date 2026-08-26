migrate(
  (app) => {
    // 1. Adicionar campo triage_suggestions (json) na coleção tickets
    var tickets = app.findCollectionByNameOrId('tickets')
    if (!tickets.fields.getByName('triage_suggestions')) {
      tickets.fields.add(
        new JSONField({
          name: 'triage_suggestions',
          maxSize: 2000000,
        }),
      )
      app.save(tickets)
    }

    // 2. Criar coleção email_config (base) para configurações da caixa de entrada
    try {
      app.findCollectionByNameOrId('email_config')
    } catch (_) {
      var emailConfig = new Collection({
        name: 'email_config',
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
          { name: 'imap_host', type: 'text' },
          { name: 'imap_port', type: 'number' },
          { name: 'imap_user', type: 'text' },
          { name: 'imap_ssl', type: 'bool' },
          { name: 'check_interval_minutes', type: 'number' },
          { name: 'enabled', type: 'bool' },
          { name: 'last_check_at', type: 'date' },
          { name: 'last_check_status', type: 'text' },
          { name: 'last_check_error', type: 'text' },
          { name: 'webhook_token', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(emailConfig)

      // Seed padrão para email_config se não existir
      var rec = new Record(emailConfig)
      rec.set('imap_host', 'imap.gmail.com')
      rec.set('imap_port', 993)
      rec.set('imap_user', 'suporte@empresa.com.br')
      rec.set('imap_ssl', true)
      rec.set('check_interval_minutes', 2)
      rec.set('enabled', false)
      rec.set('webhook_token', $security.randomString(32))
      app.save(rec)
    }

    // 3. Criar coleção retained_tickets (base)
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var ticketsCol = app.findCollectionByNameOrId('tickets')

    try {
      app.findCollectionByNameOrId('retained_tickets')
    } catch (_) {
      var retainedTickets = new Collection({
        name: 'retained_tickets',
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
          { name: 'from_email', type: 'text', required: true },
          { name: 'from_name', type: 'text' },
          { name: 'subject', type: 'text', required: true },
          { name: 'body', type: 'text' },
          { name: 'domain', type: 'text' },
          { name: 'reason', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente', 'Liberado', 'Excluído'],
            maxSelect: 1,
          },
          {
            name: 'ticket',
            type: 'relation',
            collectionId: ticketsCol.id,
            maxSelect: 1,
          },
          {
            name: 'reviewed_by',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'reviewed_at', type: 'date' },
          { name: 'review_notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_retained_status ON retained_tickets (status)',
          'CREATE INDEX idx_retained_domain ON retained_tickets (domain)',
          'CREATE INDEX idx_retained_from ON retained_tickets (from_email)',
        ],
      })
      app.save(retainedTickets)
    }
  },
  (app) => {
    try {
      var retainedTickets = app.findCollectionByNameOrId('retained_tickets')
      app.delete(retainedTickets)
    } catch (_) {}

    try {
      var emailConfig = app.findCollectionByNameOrId('email_config')
      app.delete(emailConfig)
    } catch (_) {}

    try {
      var tickets = app.findCollectionByNameOrId('tickets')
      var field = tickets.fields.getByName('triage_suggestions')
      if (field) {
        tickets.fields.remove(field)
        app.save(tickets)
      }
    } catch (_) {}
  },
)
