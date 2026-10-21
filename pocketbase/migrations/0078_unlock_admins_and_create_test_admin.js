migrate(
  (app) => {
    // 1. Limpar bloqueios e tentativas falhas em todas as contas de administrador e gestor
    try {
      const adminUsers = app.findRecordsByFilter(
        '_pb_users_auth_',
        'role = "admin" || role = "gestor"',
        '',
        100,
        0,
      )
      for (let i = 0; i < adminUsers.length; i++) {
        const u = adminUsers[i]
        u.set('failed_login_attempts', 0)
        u.set('locked_until', null)
        app.save(u)
      }
    } catch (e) {
      console.log('Aviso ao desbloquear admins existentes:', e)
    }

    // 2. Garantir que exista uma conta de teste ativa com perfil administrador
    // E-mail: admin@teste.local
    // Senha temporária: Admin@123456
    // Sem 2FA obrigatório para testes de acesso imediatos
    const testEmail = 'admin@teste.local'
    const testPass = 'Admin@123456'

    let testUser = null
    try {
      testUser = app.findAuthRecordByEmail('_pb_users_auth_', testEmail)
    } catch (_) {}

    if (!testUser) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      testUser = new Record(usersCol)
      testUser.setEmail(testEmail)
      testUser.setPassword(testPass)
      testUser.setVerified(true)
      testUser.set('name', 'Administrador de Testes')
      testUser.set('role', 'admin')
      testUser.set('active', true)
      testUser.set('failed_login_attempts', 0)
      testUser.set('locked_until', null)
      testUser.set('totp_enabled', false)
      testUser.set('must_change_password', false)
      app.save(testUser)
      console.log('Conta admin de teste criada: ' + testEmail)
    } else {
      testUser.setPassword(testPass)
      testUser.setVerified(true)
      testUser.set('role', 'admin')
      testUser.set('active', true)
      testUser.set('failed_login_attempts', 0)
      testUser.set('locked_until', null)
      testUser.set('totp_enabled', false)
      testUser.set('must_change_password', false)
      app.save(testUser)
      console.log('Conta admin de teste atualizada com senha conhecida: ' + testEmail)
    }

    // 3. Garantir que inovacao@deltime.com.br também esteja desbloqueada e ativa
    try {
      const inovacao = app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
      inovacao.set('failed_login_attempts', 0)
      inovacao.set('locked_until', null)
      inovacao.set('active', true)
      app.save(inovacao)
    } catch (_) {}

    // 4. Garantir que lbsouza58@gmail.com também esteja desbloqueada e ativa
    try {
      const luiz = app.findAuthRecordByEmail('_pb_users_auth_', 'lbsouza58@gmail.com')
      luiz.set('failed_login_attempts', 0)
      luiz.set('locked_until', null)
      luiz.set('active', true)
      app.save(luiz)
    } catch (_) {}
  },
  (app) => {
    try {
      const testUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@teste.local')
      if (testUser) {
        app.delete(testUser)
      }
    } catch (_) {}
  },
)
