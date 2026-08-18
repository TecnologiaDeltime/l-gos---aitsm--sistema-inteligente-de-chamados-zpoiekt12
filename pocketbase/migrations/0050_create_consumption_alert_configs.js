migrate(
  (app) => {
    // Collection: consumption_alert_configs
    // Configura os alertas de consumo de horas contratuais por nível de
    // atendimento (Nível 1, Nível 2, ...). Pode ser global (company vazio)
    // ou específica por empresa.
    var companiesCol = app.findCollectionByNameOrId('companies')

    var collection = new Collection({
      name: 'consumption_alert_configs',
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
        { name: 'notify_admins', type: 'bool', required: false },
        { name: 'notify_focal_points', type: 'bool', required: false },
        { name: 'notify_ticket_responsible', type: 'bool', required: false },
        { name: 'notify_quality_team', type: 'bool', required: false },
        { name: 'notify_company_responsible', type: 'bool', required: false },
        { name: 'quality_team_emails', type: 'text', required: false },
        { name: 'threshold_80_enabled', type: 'bool', required: false },
        { name: 'threshold_90_enabled', type: 'bool', required: false },
        { name: 'threshold_100_enabled', type: 'bool', required: false },
        // Último percentual notificado por combinação contrato+nível.
        // Ex.: { "contractId_nivel1": 80, "contractId_nivel2": 90 }
        { name: 'last_notified_level_pcts', type: 'json', required: false, maxSize: 5242880 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_consumption_alert_configs_company ON consumption_alert_configs (company)',
      ],
    })
    app.save(collection)

    // Seed: registro global padrão (company vazio), todos os toggles ligados
    // exceto notify_quality_team.
    try {
      app.findFirstRecordByFilter('consumption_alert_configs', 'company = ""', '', 0, 0)
    } catch (_) {
      var rec = new Record(collection)
      rec.set('company', '')
      rec.set('enabled', true)
      rec.set('notify_admins', true)
      rec.set('notify_focal_points', true)
      rec.set('notify_ticket_responsible', true)
      rec.set('notify_quality_team', false)
      rec.set('notify_company_responsible', true)
      rec.set('quality_team_emails', '')
      rec.set('threshold_80_enabled', true)
      rec.set('threshold_90_enabled', true)
      rec.set('threshold_100_enabled', true)
      rec.set('last_notified_level_pcts', {})
      app.save(rec)
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('consumption_alert_configs')
    app.delete(col)
  },
)
