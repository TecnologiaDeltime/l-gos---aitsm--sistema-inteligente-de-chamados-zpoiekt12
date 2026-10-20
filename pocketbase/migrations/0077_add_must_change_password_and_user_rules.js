migrate(
  (app) => {
    // 1. Adicionar campo must_change_password (bool) na coleção users (_pb_users_auth_)
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let changed = false

    if (!users.fields.getByName('must_change_password')) {
      users.fields.add(new BoolField({ name: 'must_change_password' }))
      changed = true
    }

    // 2. Garantir que administradores e gestores possam gerenciar usuários pela API
    // Se a regra de list/view estiver apenas id = @request.auth.id, o admin não lista novos operadores
    // Mantemos compatibilidade: usuários veem a si próprios, e admins/gestores veem todos.
    users.listRule =
      '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "gestor")'
    users.viewRule =
      '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "gestor")'
    users.createRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
    users.updateRule =
      '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "gestor")'
    users.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'

    app.save(users)
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = users.fields.getByName('must_change_password')
      if (field) {
        users.fields.removeByName('must_change_password')
      }
      users.listRule = 'id = @request.auth.id'
      users.viewRule = 'id = @request.auth.id'
      users.createRule = ''
      users.updateRule = 'id = @request.auth.id'
      users.deleteRule = 'id = @request.auth.id'
      app.save(users)
    } catch (_) {}
  },
)
