// pocketbase/migrations/0081_restrict_operators_management_to_admin.js
migrate(
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

      // Apenas admin pode criar e excluir operadores na coleção users
      // List e View continuam acessíveis aos operadores internos
      // Update continua restrito ao próprio usuário (suas credenciais) ou admin
      usersCol.createRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      usersCol.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      usersCol.updateRule =
        '@request.auth.id != "" && (' +
        'id = @request.auth.id || ' +
        '@request.auth.role = "admin"' +
        ')'

      app.save(usersCol)
    } catch (e) {
      console.log(
        '0081_restrict_operators_management_to_admin: Erro ao ajustar regras de users:',
        e,
      )
    }
  },
  (app) => {
    // Reversão para regras anteriores
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      usersCol.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      usersCol.updateRule =
        '@request.auth.id != "" && (' +
        'id = @request.auth.id || ' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor"' +
        ')'
      app.save(usersCol)
    } catch (_) {}
  },
)
