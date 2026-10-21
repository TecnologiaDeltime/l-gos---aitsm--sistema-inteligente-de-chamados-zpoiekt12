migrate(
  (app) => {
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
    } catch (err) {
      console.log('Migration 0079: erro ao atualizar test_type em email_audit_logs:', err)
    }
  },
  (app) => {
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
    } catch (_) {}
  },
)
