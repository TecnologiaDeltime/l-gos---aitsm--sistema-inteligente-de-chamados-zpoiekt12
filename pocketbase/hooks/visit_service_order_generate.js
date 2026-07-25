routerAdd(
  'POST',
  '/backend/v1/visits/{id}/service-order',
  (e) => {
    const visitId = e.request.pathValue('id')
    if (!visitId) return e.badRequestError('Visit ID is required')

    let visit
    try {
      visit = $app.findRecordById('technical_visits', visitId)
    } catch (_) {
      return e.notFoundError('Visit not found')
    }

    if (visit.getString('status') !== 'Concluída') {
      return e.badRequestError('Visit must be completed before generating service order')
    }

    var soCol = $app.findCollectionByNameOrId('service_orders')
    var orderNumber =
      'OS-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)

    var content = {
      visit_id: visit.id,
      ticket: visit.getString('ticket'),
      technician: visit.getString('technician'),
      client: visit.getString('client_address'),
      scheduled_date: visit.getString('scheduled_date'),
      scheduled_time: visit.getString('scheduled_time'),
      checkin_at: visit.getString('checkin_at'),
      checkout_at: visit.getString('checkout_at'),
      visit_reason: visit.getString('visit_reason'),
      result: visit.getString('result'),
      activities: visit.getString('activities_performed'),
      pending_items: visit.getString('pending_items'),
      mileage: visit.getFloat('calculated_mileage') || 0,
      initial_odometer: visit.getFloat('initial_odometer') || 0,
      final_odometer: visit.getFloat('final_odometer') || 0,
      service_time: visit.getInt('service_time') || 0,
      travel_time: (visit.getInt('travel_time_in') || 0) + (visit.getInt('travel_time_out') || 0),
    }

    try {
      var ticketId = visit.getString('ticket')
      if (ticketId) {
        var ticket = $app.findRecordById('tickets', ticketId)
        content.ticket_number = ticket.getString('number')
        content.ticket_title = ticket.getString('title')
      }
    } catch (_) {}

    var so = new Record(soCol)
    so.set('visit', visit.id)
    so.set('ticket', visit.getString('ticket'))
    so.set('technician', visit.getString('technician'))
    so.set('client', visit.getString('client'))
    so.set('order_number', orderNumber)
    so.set('content_json', JSON.stringify(content))
    so.set('generated_at', new Date().toISOString())
    $app.save(so)

    visit.set('service_order_generated', true)
    $app.saveNoValidate(visit)

    return e.json(200, { success: true, order_number: orderNumber, id: so.id })
  },
  $apis.requireAuth(),
)
