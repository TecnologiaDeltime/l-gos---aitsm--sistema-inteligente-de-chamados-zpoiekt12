onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  const original = record.original()
  if (!original) return e.next()

  const oldStatus = original.getString('status')
  const newStatus = record.getString('status')
  if (oldStatus === newStatus) return e.next()
  if (newStatus !== 'Resolvido' && newStatus !== 'Encerrado') return e.next()

  try {
    $app.findFirstRecordByData('satisfaction_surveys', 'ticket', record.id)
    return e.next()
  } catch (_) {}

  const companyId = record.getString('company')
  if (!companyId) return e.next()

  let respondentId = record.getString('assigned_to')
  if (!respondentId) {
    try {
      const admin = $app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
      respondentId = admin.id
    } catch (_) {
      return e.next()
    }
  }

  const token = $security.randomString(32)

  try {
    const surveysCol = $app.findCollectionByNameOrId('satisfaction_surveys')
    const survey = new Record(surveysCol)
    survey.set('ticket', record.id)
    survey.set('company', companyId)
    survey.set('respondent', respondentId)
    survey.set('token', token)
    $app.save(survey)

    const notifsCol = $app.findCollectionByNameOrId('notifications')
    const notif = new Record(notifsCol)
    notif.set('user', respondentId)
    notif.set('ticket', record.id)
    notif.set('title', 'Pesquisa de Satisfação')
    notif.set(
      'message',
      'O chamado ' +
        record.getString('number') +
        ' foi resolvido. Pesquisa de satisfação disponível.',
    )
    notif.set('type', 'Sistema')
    notif.set('read', false)
    $app.save(notif)
  } catch (err) {
    $app.logger().error('Error creating satisfaction survey', 'error', err.message)
  }

  return e.next()
}, 'tickets')
