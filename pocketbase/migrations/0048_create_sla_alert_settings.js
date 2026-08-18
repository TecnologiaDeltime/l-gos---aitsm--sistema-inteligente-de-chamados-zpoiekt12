migrate(
  (app) => {
    // Collection: sla_alert_settings
    // Armazena as configurações dos alertas de SLA de Resposta (globais ou por empresa).
    const collection = new Collection({
      name: 'sla_alert_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: [
        // Empresa (vazio = configuração global). maxSelect 1 para relação simples.
        {
          name: 'company',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('companies').id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
        { name: 'enabled', type: 'bool', required: false },
        { name: 'popup_enabled', type: 'bool', required: false },
        { name: 'email_enabled', type: 'bool', required: false },
        { name: 'voice_enabled', type: 'bool', required: false },
        { name: 'minutes_before_expiry', type: 'number', required: false, onlyInt: true, min: 1 },
        { name: 'interval_minutes', type: 'number', required: false, onlyInt: true, min: 1 },
        { name: 'scope', type: 'select', required: false, values: ['global', 'company'] },
        { name: 'last_alert_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sla_alert_settings_company ON sla_alert_settings (company)'],
    })
    app.save(collection)

    // Seed: um registro global padrão (scope=global, company vazio).
    try {
      app.findFirstRecordByData('sla_alert_settings', 'scope', 'global')
    } catch (_) {
      const rec = new Record(collection)
      rec.set('company', '')
      rec.set('enabled', true)
      rec.set('popup_enabled', true)
      rec.set('email_enabled', true)
      rec.set('voice_enabled', true)
      rec.set('minutes_before_expiry', 60)
      rec.set('interval_minutes', 10)
      rec.set('scope', 'global')
      app.save(rec)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('sla_alert_settings')
    app.delete(col)
  },
)
