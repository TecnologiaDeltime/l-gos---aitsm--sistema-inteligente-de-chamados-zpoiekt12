migrate(
  (app) => {
    // 1. Atualizar email_config com os campos da Política de Retenção
    var emailConfig = app.findCollectionByNameOrId('email_config')

    if (!emailConfig.fields.getByName('retention_enabled')) {
      emailConfig.fields.add(
        new BoolField({
          name: 'retention_enabled',
        }),
      )
    }

    if (!emailConfig.fields.getByName('retention_days')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'retention_days',
          onlyInt: true,
          min: 1,
        }),
      )
    }

    if (!emailConfig.fields.getByName('retention_action')) {
      emailConfig.fields.add(
        new SelectField({
          name: 'retention_action',
          values: ['archive', 'delete'],
          maxSelect: 1,
        }),
      )
    }

    if (!emailConfig.fields.getByName('archive_folder')) {
      emailConfig.fields.add(
        new TextField({
          name: 'archive_folder',
        }),
      )
    }

    if (!emailConfig.fields.getByName('last_retention_at')) {
      emailConfig.fields.add(
        new DateField({
          name: 'last_retention_at',
        }),
      )
    }

    if (!emailConfig.fields.getByName('last_retention_status')) {
      emailConfig.fields.add(
        new TextField({
          name: 'last_retention_status',
        }),
      )
    }

    if (!emailConfig.fields.getByName('last_retention_error')) {
      emailConfig.fields.add(
        new TextField({
          name: 'last_retention_error',
        }),
      )
    }

    if (!emailConfig.fields.getByName('last_retention_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'last_retention_count',
          onlyInt: true,
        }),
      )
    }

    if (!emailConfig.fields.getByName('total_archived_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'total_archived_count',
          onlyInt: true,
        }),
      )
    }

    if (!emailConfig.fields.getByName('total_deleted_count')) {
      emailConfig.fields.add(
        new NumberField({
          name: 'total_deleted_count',
          onlyInt: true,
        }),
      )
    }

    app.save(emailConfig)

    // Preencher padrões nas linhas existentes de email_config
    try {
      var records = app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (records.length > 0) {
        var rec = records[0]
        if (!rec.getInt('retention_days')) {
          rec.set('retention_days', 30)
        }
        if (!rec.getString('retention_action')) {
          rec.set('retention_action', 'archive')
        }
        if (!rec.getString('archive_folder')) {
          rec.set('archive_folder', 'Arquivo')
        }
        if (rec.get('retention_enabled') === undefined || rec.get('retention_enabled') === null) {
          rec.set('retention_enabled', false)
        }
        app.save(rec)
      }
    } catch (_) {}

    // 2. Atualizar email_audit_logs para aceitar o test_type 'retencao'
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
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (auditErr) {
      console.log('Migration 0072: could not update email_audit_logs test_type', auditErr)
    }
  },
  (app) => {
    try {
      var emailConfig = app.findCollectionByNameOrId('email_config')
      var fieldsToRemove = [
        'retention_enabled',
        'retention_days',
        'retention_action',
        'archive_folder',
        'last_retention_at',
        'last_retention_status',
        'last_retention_error',
        'last_retention_count',
        'total_archived_count',
        'total_deleted_count',
      ]
      for (var i = 0; i < fieldsToRemove.length; i++) {
        var f = emailConfig.fields.getByName(fieldsToRemove[i])
        if (f) emailConfig.fields.remove(f)
      }
      app.save(emailConfig)
    } catch (_) {}
  },
)
