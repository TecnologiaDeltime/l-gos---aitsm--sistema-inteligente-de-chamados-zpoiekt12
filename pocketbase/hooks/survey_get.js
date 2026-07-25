routerAdd('GET', '/backend/v1/surveys/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  try {
    const survey = $app.findFirstRecordByData('satisfaction_surveys', 'token', token)
    const ticket = $app.findRecordById('tickets', survey.getString('ticket'))

    return e.json(200, {
      id: survey.id,
      ticket_number: ticket.getString('number'),
      ticket_title: ticket.getString('title'),
      responded: !!survey.get('responded_at'),
      quality_score: survey.get('quality_score') || 0,
      time_score: survey.get('time_score') || 0,
      communication_score: survey.get('communication_score') || 0,
      technical_score: survey.get('technical_score') || 0,
      solution_score: survey.get('solution_score') || 0,
      overall_score: survey.get('overall_score') || 0,
      comment: survey.getString('comment') || '',
    })
  } catch (err) {
    return e.notFoundError('Survey not found')
  }
})
