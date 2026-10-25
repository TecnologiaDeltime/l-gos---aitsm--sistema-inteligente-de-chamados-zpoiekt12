routerAdd('GET', '/backend/v1/approvals/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  try {
    const approval = $app.findFirstRecordByData('approvals', 'token', token)
    const ticket = $app.findRecordById('tickets', approval.getString('ticket'))

    var requesterName = 'Solicitante'
    try {
      const requester = $app.findRecordById('users', approval.getString('requester'))
      requesterName = requester.getString('name') || requester.getString('email') || requesterName
    } catch (_) {}

    var companyName = ''
    try {
      const companyId = ticket.getString('company')
      if (companyId) {
        const comp = $app.findRecordById('companies', companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      }
    } catch (_) {}

    var categoryName = ''
    try {
      const catId = ticket.getString('category')
      if (catId) {
        const cat = $app.findRecordById('tkt_categories', catId)
        categoryName = cat.getString('name')
      }
    } catch (_) {}

    var subcategoryName = ''
    try {
      const subId = ticket.getString('subcategory')
      if (subId) {
        const sub = $app.findRecordById('tkt_categories', subId)
        subcategoryName = sub.getString('name')
      }
    } catch (_) {}

    return e.json(200, {
      id: approval.id,
      type: approval.getString('type'),
      justification: approval.getString('justification'),
      estimated_hours: approval.get('estimated_hours') || 0,
      estimated_cost: approval.get('estimated_cost') || 0,
      deadline: approval.getString('deadline'),
      status: approval.getString('status'),
      approver_comment: approval.getString('approver_comment'),
      mode: approval.getString('mode'),
      stage: approval.getInt('stage'),
      target_email: approval.getString('target_email'),
      ticket_id: ticket.id,
      ticket_number: ticket.getString('number'),
      ticket_title: ticket.getString('title'),
      ticket_description: ticket.getString('description'),
      requester_name: requesterName,
      company_name: companyName,
      category_name: categoryName,
      subcategory_name: subcategoryName,
      created: approval.getString('created'),
      approved_at: approval.getString('approved_at'),
      rejected_at: approval.getString('rejected_at'),
    })
  } catch (err) {
    return e.notFoundError('Approval not found')
  }
})
