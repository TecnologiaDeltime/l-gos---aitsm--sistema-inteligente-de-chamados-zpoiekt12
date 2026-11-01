migrate(
  (app) => {
    // 1. Campos de avaliação e satisfação na coleção client_monthly_reports
    const monthlyReports = app.findCollectionByNameOrId('client_monthly_reports')
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!monthlyReports.fields.getByName('satisfaction_score')) {
      monthlyReports.fields.add(
        new NumberField({
          name: 'satisfaction_score',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    if (!monthlyReports.fields.getByName('satisfaction_comment')) {
      monthlyReports.fields.add(
        new TextField({
          name: 'satisfaction_comment',
        }),
      )
    }

    if (!monthlyReports.fields.getByName('satisfaction_responded_at')) {
      monthlyReports.fields.add(
        new DateField({
          name: 'satisfaction_responded_at',
        }),
      )
    }

    if (!monthlyReports.fields.getByName('satisfaction_responded_by')) {
      monthlyReports.fields.add(
        new RelationField({
          name: 'satisfaction_responded_by',
          collectionId: usersCollection.id,
          maxSelect: 1,
        }),
      )
    }

    // Permite que usuários autenticados (incluindo clientes gestores/pontos focais) atualizem a avaliação
    // Mantém admin e gestor livres para editar tudo, e clientes autenticados para salvar suas avaliações
    monthlyReports.updateRule = "@request.auth.id != ''"

    app.save(monthlyReports)

    // 2. Campo de prazo de reabertura (em dias) em client_notification_settings
    try {
      const notifSettings = app.findCollectionByNameOrId('client_notification_settings')
      if (!notifSettings.fields.getByName('reopen_window_days')) {
        notifSettings.fields.add(
          new NumberField({
            name: 'reopen_window_days',
            min: 0,
            max: 365,
            onlyInt: true,
          }),
        )
        app.save(notifSettings)
      }

      // Atualiza o registro global padrão se existir
      try {
        const globalRec = app.findFirstRecordByData(
          'client_notification_settings',
          'scope',
          'global',
        )
        if (globalRec && !globalRec.getInt('reopen_window_days')) {
          globalRec.set('reopen_window_days', 2)
          app.save(globalRec)
        }
      } catch (_) {}
    } catch (err) {
      console.log('Migration 0100: aviso ao adicionar reopen_window_days:', err)
    }
  },
  (app) => {
    try {
      const monthlyReports = app.findCollectionByNameOrId('client_monthly_reports')
      const scoreField = monthlyReports.fields.getByName('satisfaction_score')
      if (scoreField) monthlyReports.fields.remove(scoreField)
      const commentField = monthlyReports.fields.getByName('satisfaction_comment')
      if (commentField) monthlyReports.fields.remove(commentField)
      const dateField = monthlyReports.fields.getByName('satisfaction_responded_at')
      if (dateField) monthlyReports.fields.remove(dateField)
      const userField = monthlyReports.fields.getByName('satisfaction_responded_by')
      if (userField) monthlyReports.fields.remove(userField)
      monthlyReports.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      app.save(monthlyReports)
    } catch (_) {}

    try {
      const notifSettings = app.findCollectionByNameOrId('client_notification_settings')
      const reopenField = notifSettings.fields.getByName('reopen_window_days')
      if (reopenField) notifSettings.fields.remove(reopenField)
      app.save(notifSettings)
    } catch (_) {}
  },
)
