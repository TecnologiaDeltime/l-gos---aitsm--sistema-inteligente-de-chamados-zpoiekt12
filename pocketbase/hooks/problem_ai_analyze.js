routerAdd(
  'POST',
  '/backend/v1/problems/ai-analyze',
  function (e) {
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var days = body.days || 30
    var minIncidents = body.min_incidents || 5

    var cutoff = new Date()
    cutoff.setTime(cutoff.getTime() - days * 86400000)

    var tickets = []
    try {
      tickets = $app.findRecordsByFilter('tickets', '', '-created', 500, 0)
    } catch (_) {}

    var byService = {}
    tickets.forEach(function (t) {
      var created = t.getString('created')
      if (!created) return
      var d = new Date(created)
      if (d < cutoff) return
      var svc = t.getString('service') || t.getString('category') || 'N/A'
      if (!byService[svc]) byService[svc] = []
      byService[svc].push({
        number: t.getString('number'),
        title: t.getString('title'),
        priority: t.getString('priority'),
        status: t.getString('status'),
        company: t.getString('company'),
      })
    })

    var recurrences = []
    Object.keys(byService).forEach(function (svc) {
      if (byService[svc].length >= minIncidents) {
        recurrences.push({
          service: svc,
          count: byService[svc].length,
          incidents: byService[svc].slice(0, 20),
        })
      }
    })

    var aiAnalysis = null
    if (recurrences.length > 0) {
      try {
        var prompt =
          'Analise os seguintes padrões de incidentes recorrentes e sugira problemas potenciais. '
        prompt +=
          'Para cada padrão, sugira: possível problema, incidentes relacionados, categoria, prioridade, impacto, possíveis causas, padrões de recorrência, hipóteses de causa raiz, perguntas para investigação, soluções de contorno, e necessidade de mudança. '
        prompt += 'NUNCA sugira fechar problemas automaticamente. Responda em português.\n\n'
        prompt += JSON.stringify(recurrences, null, 2)

        var reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um especialista em ITIL 4 e Gerenciamento de Problemas. Analisa incidentes e identifica padrões para sugerir problemas. Responde sempre em português de forma estruturada.',
            },
            { role: 'user', content: prompt },
          ],
        })
        aiAnalysis = reply.choices[0].message.content
      } catch (err) {
        aiAnalysis = null
      }
    }

    return e.json(200, {
      recurrences: recurrences,
      ai_analysis: aiAnalysis,
      suggestion:
        recurrences.length > 0
          ? 'Foi identificada possível recorrência. Deseja criar um Problema?'
          : null,
    })
  },
  $apis.requireAuth(),
)
