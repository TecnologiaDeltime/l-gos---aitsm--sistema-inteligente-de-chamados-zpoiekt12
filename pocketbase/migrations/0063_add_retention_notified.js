migrate(
  (app) => {
    // 1. Adicionar campo retention_notified (bool) na coleção retained_tickets
    var retainedTickets = app.findCollectionByNameOrId('retained_tickets')
    if (!retainedTickets.fields.getByName('retention_notified')) {
      retainedTickets.fields.add(
        new BoolField({
          name: 'retention_notified',
        }),
      )
      app.save(retainedTickets)
    }

    // 2. Expandir select de alert_audit_logs para incluir RETAINED_TICKETS se existir o campo
    try {
      var auditLogs = app.findCollectionByNameOrId('alert_audit_logs')
      var alertTypeField = auditLogs.fields.getByName('alert_type')
      if (alertTypeField) {
        var currentValues = alertTypeField.values || []
        if (currentValues.indexOf('RETAINED_TICKETS') === -1) {
          currentValues.push('RETAINED_TICKETS')
          alertTypeField.values = currentValues
          app.save(auditLogs)
        }
      }
    } catch (_) {}

    // 3. Expandir select de notifications para incluir RetainedTicket se existir o campo
    try {
      var notifications = app.findCollectionByNameOrId('notifications')
      var typeField = notifications.fields.getByName('type')
      if (typeField) {
        var currentTypes = typeField.values || []
        if (currentTypes.indexOf('RetainedTicket') === -1) {
          currentTypes.push('RetainedTicket')
          typeField.values = currentTypes
          app.save(notifications)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      var retainedTickets = app.findCollectionByNameOrId('retained_tickets')
      var field = retainedTickets.fields.getByName('retention_notified')
      if (field) {
        retainedTickets.fields.remove(field)
        app.save(retainedTickets)
      }
    } catch (_) {}
  },
)
