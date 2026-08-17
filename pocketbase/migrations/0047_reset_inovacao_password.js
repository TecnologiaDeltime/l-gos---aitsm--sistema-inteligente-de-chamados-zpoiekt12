migrate(
  (app) => {
    // Reset the password for inovacao@deltime.com.br to Skip@Pass.
    // The user could not log in (no auth-with-password attempts reached the
    // backend), so we force a known-good password and re-verify the account.
    const email = 'inovacao@deltime.com.br'
    const newPassword = 'Skip@Pass'

    let record
    try {
      record = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (e) {
      throw new Error('Usuário "' + email + '" não encontrado: ' + e)
    }

    record.setPassword(newPassword)
    record.setVerified(true)
    record.set('active', true)
    app.save(record)
    console.log('Senha redefinida para ' + email)
  },
  (app) => {
    // No reversible down — password reset cannot be undone.
  },
)
