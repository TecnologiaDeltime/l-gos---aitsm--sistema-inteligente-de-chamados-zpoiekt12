routerAdd(
  'POST',
  '/backend/v1/problems/ai-effectiveness',
  function (e) {
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var problemId = body.problem_id
    if (!problemId) return e.badRequestError('problem_id is required')

    var problem = null
    try {
      problem = $app.findRecordById('problems', problemId)
    } catch (_) {
      return e.notFoundError('problem not found')
    }

    var beforeCount = problem.getInt('incidents_before_count') || 0
    var afterCount = problem.getInt('incidents_after_count') || 0
    var reduction = beforeCount > 0 ? Math.round((1 - afterCount / beforeCount) * 100) : 0

    var incidentData = {
      antes: {
        quantidade: beforeCount,
        frequencia: problem.getString('frequency') || 'N/A',
        impacto: problem.getString('impact') || 'N/A',
      },
      depois: {
        quantidade: afterCount,
        impacto: problem.getString('impact_classification') || 'N/A',
      },
      reducao_percentual: reduction,
    }

    var aiRecommendation = null
    try {
      var prompt =
        'Compare os dados de incidentes antes e depois da solução de contorno e gere uma recomendação de efetividade. '
      prompt += 'Dados: ' + JSON.stringify(incidentData) + '. '
      prompt +=
        'Indique se a solução foi efetiva, parcialmente efetiva ou não efetiva, com justificativa. Responda em português.'

      var reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em ITIL 4. Analisa a efetividade de soluções de contorno comparando dados antes e depois. A recomendação é apenas apoio à decisão; a decisão final é do responsável. Responda em português.',
          },
          { role: 'user', content: prompt },
        ],
      })
      aiRecommendation = reply.choices[0].message.content
    } catch (err) {
      aiRecommendation = null
    }

    return e.json(200, {
      incident_data: incidentData,
      ai_recommendation: aiRecommendation,
    })
  },
  $apis.requireAuth(),
)
