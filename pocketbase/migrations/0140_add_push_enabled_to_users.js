migrate(
  (app) => {
    // 0140 — Notificações push do navegador: preferência individual por usuário.
    // Campo push_enabled (bool) na coleção users (_pb_users_auth_). Opt-in: nasce
    // vazio (falso) e cada usuário liga o seu próprio toggle em Configurações >
    // Notificações. Sem administração central nova, não há item novo no catálogo
    // de permissões (a preferência é individual, não um recurso controlado por perfil).
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('push_enabled')) {
      users.fields.add(new BoolField({ name: 'push_enabled' }))
      app.save(users)
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = users.fields.getByName('push_enabled')
      if (field) {
        users.fields.remove(field)
        app.save(users)
      }
    } catch (_) {}
  },
)
