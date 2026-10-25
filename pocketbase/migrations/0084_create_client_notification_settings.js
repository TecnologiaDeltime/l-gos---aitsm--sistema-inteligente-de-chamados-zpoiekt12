migrate(
  (app) => {
    // 1. Atualizar email_audit_logs para incluir resolucao_chamado em test_type
    try {
      var auditCol = app.findCollectionByNameOrId('email_audit_logs')
      var testTypeField = auditCol.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = [
          'connection_test',
          'dry_run_simulation',
          'teste-envio',
          'teste-smtp',
          'retencao',
          'abertura_chamado',
          'resolucao_chamado',
          'alerta_sla',
          'aprovacao_chamado',
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (err) {
      console.log('Migration 0084: erro ao atualizar test_type em email_audit_logs:', err)
    }

    // 2. Criar coleção client_notification_settings
    // Controla quais alertas e e-mails o cliente recebe:
    // - notify_ticket_created: e-mail de abertura (padrão true)
    // - notify_ticket_resolved: e-mail de resolução (padrão true)
    // - notify_focal_points: enviar cópia aos contatos/pontos focais do cliente (padrão false)
    // - scope: 'global' | 'company'
    const companiesCol = app.findCollectionByNameOrId('companies')

    const settingsCol = new Collection({
      name: 'client_notification_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: [
        {
          name: 'company',
          type: 'relation',
          required: false,
          collectionId: companiesCol.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
        { name: 'notify_ticket_created', type: 'bool', required: false },
        { name: 'notify_ticket_resolved', type: 'bool', required: false },
        { name: 'notify_focal_points', type: 'bool', required: false },
        {
          name: 'scope',
          type: 'select',
          required: false,
          values: ['global', 'company'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_client_notif_scope ON client_notification_settings (scope)',
        'CREATE INDEX idx_client_notif_company ON client_notification_settings (company)',
      ],
    })
    app.save(settingsCol)

    // Seed do registro global padrão com ambos e-mails ativos
    try {
      app.findFirstRecordByData('client_notification_settings', 'scope', 'global')
    } catch (_) {
      const rec = new Record(settingsCol)
      rec.set('company', '')
      rec.set('scope', 'global')
      rec.set('notify_ticket_created', true)
      rec.set('notify_ticket_resolved', true)
      rec.set('notify_focal_points', false)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('client_notification_settings')
      app.delete(col)
    } catch (_) {}

    try {
      var auditCol = app.findCollectionByNameOrId('email_audit_logs')
      var testTypeField = auditCol.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = [
          'connection_test',
          'dry_run_simulation',
          'teste-envio',
          'teste-smtp',
          'retencao',
          'abertura_chamado',
          'alerta_sla',
          'aprovacao_chamado',
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (_) {}
  },
)
