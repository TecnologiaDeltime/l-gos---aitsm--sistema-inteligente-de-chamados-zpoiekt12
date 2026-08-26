// Hook que roda após a criação de qualquer ticket para gerar sugestão de triagem se ainda não houver
onRecordAfterCreateSuccess((e) => {
  try {
    var ticket = e.record
    var existingTriage = ticket.get('triage_suggestions')
    if (
      existingTriage &&
      typeof existingTriage === 'object' &&
      Object.keys(existingTriage).length > 0
    ) {
      return e.next()
    }

    var title = ticket.getString('title') || ''
    var description = ticket.getString('description') || ''
    if (!title && !description) return e.next()

    var categories = []
    try {
      categories = $app.findRecordsByFilter('tkt_categories', 'active = true', 'name', 100, 0)
    } catch (_) {}

    var fullText = (title + ' ' + description).toLowerCase()
    var bestCategory = null
    var bestScore = 0
    var suggestedType = 'Incidente'

    if (/dúvida|duvida|como fa|pergunta|esclarecer|orienta/i.test(fullText)) {
      suggestedType = 'Dúvida'
    } else if (
      /solicito|solicita|acesso|novo|criar|instalar|liberar|comprar|troca/i.test(fullText)
    ) {
      suggestedType = 'Requisição de Serviço'
    } else if (/problema recorrente|falha geral|indisponibilidade sistêmica|raiz/i.test(fullText)) {
      suggestedType = 'Problema'
    }

    for (var c = 0; c < categories.length; c++) {
      var cat = categories[c]
      var catName = (cat.getString('name') || '').toLowerCase()
      var catDesc = (cat.getString('description') || '').toLowerCase()
      var score = 0

      var words = catName.split(/[\s,/-]+/)
      for (var w = 0; w < words.length; w++) {
        var word = words[w].trim()
        if (word.length >= 3 && fullText.indexOf(word) !== -1) {
          score += 2
        }
      }
      if (catDesc && fullText.indexOf(catDesc) !== -1) {
        score += 3
      }

      if (score > bestScore) {
        bestScore = score
        bestCategory = cat
      }
    }

    var triageSuggestion = null
    var aiEnhanced = false

    try {
      var catListStr = categories
        .map(function (c) {
          return (
            c.id +
            ': ' +
            c.getString('name') +
            (c.getString('parent') ? ' (Subcategoria)' : ' (Categoria)')
          )
        })
        .join('\n')

      var reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente ITSM de triagem de chamados. Classifique o chamado retornando APENAS um JSON no formato: {"type": "Incidente|Requisição de Serviço|Problema|Dúvida", "category_id": "ID_DA_CATEGORIA_OU_VAZIO", "service_name": "Nome da atividade ou vazio", "confidence": 0.85, "reason": "Breve justificativa em português"}',
          },
          {
            role: 'user',
            content:
              'Título: ' +
              title +
              '\nDescrição: ' +
              description +
              '\n\nCatálogo disponível:\n' +
              catListStr,
          },
        ],
      })

      var aiContent = reply.choices[0].message.content
      var matchJson = aiContent.match(/\{[\s\S]*\}/)
      if (matchJson) {
        var parsed = JSON.parse(matchJson[0])
        var matchedCatName = ''
        if (parsed.category_id) {
          try {
            var foundCat = $app.findRecordById('tkt_categories', parsed.category_id)
            matchedCatName = foundCat.getString('name')
          } catch (_) {}
        }
        triageSuggestion = {
          type: parsed.type || suggestedType,
          category: parsed.category_id || (bestCategory ? bestCategory.id : ''),
          category_name: matchedCatName || (bestCategory ? bestCategory.getString('name') : ''),
          service: parsed.service_name || (bestCategory ? bestCategory.getString('name') : ''),
          confidence: parsed.confidence || 0.85,
          reason: parsed.reason || 'Sugerido por IA com base no catálogo de serviços.',
          source: 'ai_fast',
        }
        aiEnhanced = true
      }
    } catch (_) {}

    if (!aiEnhanced && bestCategory) {
      triageSuggestion = {
        type: suggestedType,
        category: bestCategory.id,
        category_name: bestCategory.getString('name'),
        service: bestCategory.getString('name'),
        confidence: Math.min(0.9, 0.5 + bestScore * 0.1),
        reason: 'Sugerido com base na correspondência de palavras-chave do catálogo.',
        source: 'keyword_match',
      }
    }

    if (triageSuggestion) {
      var ticketRecord = $app.findRecordById('tickets', ticket.id)
      ticketRecord.set('triage_suggestions', triageSuggestion)
      $app.save(ticketRecord)
    }
  } catch (err) {
    $app.logger().error('ticket_triage_suggest: error', 'error', err.message)
  }

  return e.next()
}, 'tickets')
