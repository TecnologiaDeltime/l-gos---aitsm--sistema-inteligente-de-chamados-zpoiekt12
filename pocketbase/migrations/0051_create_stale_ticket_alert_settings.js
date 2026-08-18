migrate(
  (app) => {
    // ============================================================
    // 1) Collection: stale_ticket_alert_settings
    //    Configuração global (registro único) dos alertas de
    //    chamados abertos sem atualização (interação) há mais de
    //    X horas. Padrão: 8 horas.
    // ============================================================
    var companiesCol = app.findCollectionByNameOrId('companies')

    var collection = new Collection({
      name: 'stale_ticket_alert_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: [
        // Empresa (vazio = configuração global). maxSelect 1.
        {
          name: 'company',
          type: 'relation',
          required: false,
          collectionId: companiesCol.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
        { name: 'enabled', type: 'bool', required: false },
        { name: 'popup_enabled', type: 'bool', required: false },
        { name: 'voice_enabled', type: 'bool', required: false },
        // Horas sem atualização para considerar o chamado "sem movimento".
        { name: 'hours_without_update', type: 'number', required: false, onlyInt: true, min: 1 },
        // Escopo (global / company) — segue o padrão do sla_alert_settings.
        { name: 'scope', type: 'select', required: false, values: ['global', 'company'] },
        // Observabilidade: último disparo do cron.
        { name: 'last_alert_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_stale_ticket_alert_settings_company ON stale_ticket_alert_settings (company)',
      ],
    })
    app.save(collection)

    // Seed: registro global padrão (company vazio, scope=global).
    try {
      app.findFirstRecordByFilter('stale_ticket_alert_settings', 'scope = "global"', '', 0, 0)
    } catch (_) {
      var rec = new Record(collection)
      rec.set('company', '')
      rec.set('enabled', true)
      rec.set('popup_enabled', true)
      rec.set('voice_enabled', true)
      rec.set('hours_without_update', 8)
      rec.set('scope', 'global')
      app.save(rec)
    }

    // ============================================================
    // 2) Campo last_stale_alert_at em tickets (throttle por ticket)
    // ============================================================
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    if (!ticketsCol.fields.getByName('last_stale_alert_at')) {
      ticketsCol.fields.add(new DateField({ name: 'last_stale_alert_at' }))
      ticketsCol.addIndex('idx_tickets_last_stale_alert', false, 'last_stale_alert_at', '')
      app.save(ticketsCol)
    }

    // ============================================================
    // 3) Adiciona valor "StaleTicket" ao select `type` da coleção
    //    `notifications` (mantém os valores existentes).
    // ============================================================
    var notifCol = app.findCollectionByNameOrId('notifications')
    var notifTypeField = notifCol.fields.getByName('type')
    if (notifTypeField) {
      notifCol.fields.removeByName('type')
    }
    notifCol.fields.add(
      new SelectField({
        name: 'type',
        values: ['SLA', 'Atribuição', 'Interação', 'Aprovação', 'Sistema', 'Alerta', 'StaleTicket'],
        maxSelect: 1,
      }),
    )
    app.save(notifCol)
  },
  (app) => {
    // Reverte notificações type para o conjunto original (sem StaleTicket).
    var notifCol = app.findCollectionByNameOrId('notifications')
    if (notifCol.fields.getByName('type')) {
      notifCol.fields.removeByName('type')
    }
    notifCol.fields.add(
      new SelectField({
        name: 'type',
        values: ['SLA', 'Atribuição', 'Interação', 'Aprovação', 'Sistema', 'Alerta'],
        maxSelect: 1,
      }),
    )
    app.save(notifCol)

    // Remove last_stale_alert_at de tickets.
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    if (ticketsCol.fields.getByName('last_stale_alert_at')) {
      ticketsCol.fields.removeByName('last_stale_alert_at')
    }
    try {
      ticketsCol.removeIndex('idx_tickets_last_stale_alert')
    } catch (_) {}
    app.save(ticketsCol)

    // Remove a collection de configurações.
    var col = app.findCollectionByNameOrId('stale_ticket_alert_settings')
    app.delete(col)
  },
)
