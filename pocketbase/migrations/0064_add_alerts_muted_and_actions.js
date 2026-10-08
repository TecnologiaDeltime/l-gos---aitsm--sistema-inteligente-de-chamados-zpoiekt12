migrate(
  (app) => {
    // 1. Adicionar campo alerts_muted (bool) na coleção users (_pb_users_auth_)
    // Nota: Em PocketBase, BoolField não deve ser required para permitir false/null sem falha de validação
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('alerts_muted')) {
      users.fields.add(
        new BoolField({
          name: 'alerts_muted',
        }),
      )
      app.save(users)
    }

    // 2. Expandir select de alert_audit_logs para incluir MUTE_ALERTS e UNMUTE_ALERTS se existir o campo
    try {
      const auditLogs = app.findCollectionByNameOrId('alert_audit_logs')
      const actionField = auditLogs.fields.getByName('action')
      if (actionField) {
        const currentActions = actionField.values || []
        let changed = false
        if (currentActions.indexOf('MUTE_ALERTS') === -1) {
          currentActions.push('MUTE_ALERTS')
          changed = true
        }
        if (currentActions.indexOf('UNMUTE_ALERTS') === -1) {
          currentActions.push('UNMUTE_ALERTS')
          changed = true
        }
        if (changed) {
          actionField.values = currentActions
          app.save(auditLogs)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = users.fields.getByName('alerts_muted')
      if (field) {
        users.fields.remove(field)
        app.save(users)
      }
    } catch (_) {}
  },
)
