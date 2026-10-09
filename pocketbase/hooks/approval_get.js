routerAdd('GET', '/backend/v1/debug-globals', (e) => {
  var names = Object.getOwnPropertyNames(globalThis).sort()
  var dollar = names.filter((n) => n.startsWith('$'))
  var hasTls = typeof $tls !== 'undefined'
  var hasNet = typeof $net !== 'undefined'
  var hasOs = typeof $os !== 'undefined'
  var osProps = []
  if (hasOs) {
    try {
      osProps = Object.getOwnPropertyNames($os)
    } catch (_) {}
  }
  return e.json(200, {
    dollar_globals: dollar,
    has_tls: hasTls,
    has_net: hasNet,
    has_os: hasOs,
    os_props: osProps,
  })
})

routerAdd('GET', '/backend/v1/approvals/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  try {
    const approval = $app.findFirstRecordByData('approvals', 'token', token)
    const ticket = $app.findRecordById('tickets', approval.getString('ticket'))
    const requester = $app.findRecordById('users', approval.getString('requester'))

    return e.json(200, {
      id: approval.id,
      type: approval.getString('type'),
      justification: approval.getString('justification'),
      estimated_hours: approval.get('estimated_hours') || 0,
      estimated_cost: approval.get('estimated_cost') || 0,
      deadline: approval.getString('deadline'),
      status: approval.getString('status'),
      approver_comment: approval.getString('approver_comment'),
      ticket_number: ticket.getString('number'),
      ticket_title: ticket.getString('title'),
      requester_name: requester.getString('name'),
    })
  } catch (err) {
    return e.notFoundError('Approval not found')
  }
})
