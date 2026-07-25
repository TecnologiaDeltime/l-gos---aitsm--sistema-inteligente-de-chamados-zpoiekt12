routerAdd('POST', '/backend/v1/surveys/{token}/respond', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  const body = e.requestInfo().body || {}

  try {
    const survey = $app.findFirstRecordByData('satisfaction_surveys', 'token', token)
    if (survey.get('responded_at')) {
      return e.badRequestError('Survey already responded')
    }

    survey.set('quality_score', Number(body.quality_score) || 0)
    survey.set('time_score', Number(body.time_score) || 0)
    survey.set('communication_score', Number(body.communication_score) || 0)
    survey.set('technical_score', Number(body.technical_score) || 0)
    survey.set('solution_score', Number(body.solution_score) || 0)
    survey.set('overall_score', Number(body.overall_score) || 0)
    survey.set('comment', body.comment || '')
    survey.set('responded_at', new Date().toISOString())
    $app.save(survey)

    const ticket = $app.findRecordById('tickets', survey.getString('ticket'))
    var scores = [
      Number(body.quality_score),
      Number(body.time_score),
      Number(body.communication_score),
      Number(body.technical_score),
      Number(body.solution_score),
      Number(body.overall_score),
    ]
    var sum = 0
    var count = 0
    scores.forEach(function (s) {
      if (s > 0) {
        sum += s
        count++
      }
    })
    var avg = count > 0 ? sum / count : 0
    ticket.set('satisfaction_score', avg)
    $app.save(ticket)

    return e.json(200, { success: true })
  } catch (err) {
    return e.notFoundError('Survey not found')
  }
})
