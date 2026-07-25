routerAdd(
  'POST',
  '/backend/v1/visits/{id}/checkin',
  (e) => {
    const visitId = e.request.pathValue('id')
    if (!visitId) return e.badRequestError('Visit ID is required')
    const body = e.requestInfo().body || {}
    const lat = body.lat || ''
    const lon = body.lon || ''
    const radius = body.radius || 300
    const justification = body.justification || ''

    let visit
    try {
      visit = $app.findRecordById('technical_visits', visitId)
    } catch (_) {
      return e.notFoundError('Visit not found')
    }

    if (visit.getString('status') === 'Em Andamento' || visit.getString('status') === 'Concluída') {
      return e.badRequestError('Visit already checked in')
    }

    const now = new Date().toISOString()
    visit.set('status', 'Em Andamento')
    visit.set('checkin_at', now)
    visit.set('checkin_lat', lat)
    visit.set('checkin_lon', lon)
    visit.set('checkin_justification', justification)
    visit.set('technician_status', 'Em Serviço Presencial')
    $app.save(visit)

    const historyCol = $app.findCollectionByNameOrId('ticket_history')
    const ticketId = visit.getString('ticket')
    if (ticketId) {
      try {
        const hist = new Record(historyCol)
        hist.set('ticket', ticketId)
        hist.set('user', e.auth ? e.auth.id : '')
        hist.set('action', 'Check-in de visita técnica')
        hist.set('field', 'checkin')
        hist.set('new_value', now)
        $app.save(hist)
      } catch (_) {}
    }

    const notifCol = $app.findCollectionByNameOrId('notifications')
    try {
      var admins = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', '', 0, 0)
      for (var i = 0; i < admins.length; i++) {
        var n = new Record(notifCol)
        n.set('user', admins[i].id)
        n.set('ticket', ticketId)
        n.set('title', 'Check-in de Visita')
        n.set('message', 'Check-in registrado para visita #' + visitId.slice(0, 8))
        n.set('type', 'Sistema')
        n.set('read', false)
        $app.save(n)
      }
    } catch (_) {}

    return e.json(200, { success: true, status: 'Em Andamento', checkin_at: now })
  },
  $apis.requireAuth(),
)
