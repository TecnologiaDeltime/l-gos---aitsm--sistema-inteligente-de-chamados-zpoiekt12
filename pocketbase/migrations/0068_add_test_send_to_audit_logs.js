migrate(
  (app) => {
    try {
      const emailAuditLogs = app.findCollectionByNameOrId('email_audit_logs')
      const testTypeField = emailAuditLogs.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = ['connection_test', 'dry_run_simulation', 'teste-envio']
        testTypeField.maxSelect = 1
        app.save(emailAuditLogs)
      }
    } catch (err) {
      console.log('Migration 0068: could not update test_type field', err)
    }
  },
  (app) => {
    try {
      const emailAuditLogs = app.findCollectionByNameOrId('email_audit_logs')
      const testTypeField = emailAuditLogs.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = ['connection_test', 'dry_run_simulation']
        testTypeField.maxSelect = 1
        app.save(emailAuditLogs)
      }
    } catch (_) {}
  },
)
