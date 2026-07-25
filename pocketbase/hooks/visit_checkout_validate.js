routerAdd(
  'POST',
  '/backend/v1/visits/{id}/checkout',
  (e) => {
    const visitId = e.request.pathValue('id')
    if (!visitId) return e.badRequestError('Visit ID is required')
    const body = e.requestInfo().body || {}

    const required = ['result', 'activities_performed']
    for (var i = 0; i < required.length; i++) {
      if (!body[required[i]] || !String(body[required[i]]).trim()) {
        return e.badRequestError('Campo obrigatório ausente: ' + required[i])
      }
    }

    let visit
    try {
      visit = $app.findRecordById('technical_visits', visitId)
    } catch (_) {
      return e.notFoundError('Visit not found')
    }

    if (visit.getString('status') !== 'Em Andamento') {
      return e.badRequestError('Visit is not in progress')
    }

    const now = new Date().toISOString()
    visit.set('status', 'Concluída')
    visit.set('checkout_at', now)
    visit.set('result', body.result || '')
    visit.set('activities_performed', body.activities_performed || '')
    visit.set('pending_items', body.pending_items || '')
    visit.set('return_needed', !!body.return_needed)
    visit.set('final_odometer', body.final_odometer || 0)
    visit.set('checkout_lat', body.lat || '')
    visit.set('checkout_lon', body.lon || '')
    visit.set('technician_status', 'Finalizando Serviço')

    if (body.initial_odometer && body.final_odometer) {
      var mileage = parseFloat(body.final_odometer) - parseFloat(body.initial_odometer)
      if (mileage < 0) mileage = 0
      visit.set('calculated_mileage', mileage)
    }
    if (body.travel_time_in) visit.set('travel_time_in', body.travel_time_in)
    if (body.waiting_time) visit.set('waiting_time', body.waiting_time)
    if (body.service_time) visit.set('service_time', body.service_time)
    if (body.travel_time_out) visit.set('travel_time_out', body.travel_time_out)
    if (body.total_time) visit.set('total_time', body.total_time)

    $app.save(visit)

    const ticketId = visit.getString('ticket')
    if (ticketId && body.update_ticket !== false) {
      try {
        const ticket = $app.findRecordById('tickets', ticketId)
        ticket.set('needs_technical_visit', true)
        $app.save(ticket)
      } catch (_) {}
    }

    return e.json(200, { success: true, status: 'Concluída', checkout_at: now })
  },
  $apis.requireAuth(),
)
