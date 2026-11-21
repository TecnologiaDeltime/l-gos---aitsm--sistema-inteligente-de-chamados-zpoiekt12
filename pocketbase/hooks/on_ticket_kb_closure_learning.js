/**
 * on_ticket_kb_closure_learning.js
 *
 * Aprendizado contínuo da Base de Conhecimento: quando um chamado é resolvido
 * ou encerrado com solução, grava automaticamente um registro em kb_sources
 * (source_type 'closure') com a solução do operador, processado por IA
 * (resumo cirúrgico + tokens), para alimentar as sugestões do agente de chamados.
 *
 * 100% self-contained: toda a lógica é inline nos callbacks (regra da casa JSVM).
 */

onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  if (!record) return e.next()

  let original = null
  try {
    original = record.original()
  } catch (_) {
    return e.next()
  }
  if (!original) return e.next()

  const oldStatus = original.getString('status')
  const newStatus = record.getString('status')
  if (oldStatus === newStatus) return e.next()
  if (newStatus !== 'Resolvido' && newStatus !== 'Encerrado') return e.next()

  const solution = (record.getString('solution') || '').trim()
  if (solution.length < 15) return e.next() // solução trivial/ausente: nada a aprender

  // Evita duplicar a fonte de aprendizado do mesmo chamado (reaberturas etc.)
  try {
    $app.findFirstRecordByFilter('kb_sources', 'ticket = {:tid} && source_type = "closure"', {
      tid: record.id,
    })
    return e.next() // já existe fonte de fechamento para este chamado
  } catch (_) {
    // não encontrou: segue para criar
  }

  try {
    // Contexto leve para a IA: título + categoria textual do chamado
    var ticketTitle = record.getString('title') || ''
    var categoryName = ''
    try {
      const catId = record.getString('category')
      if (catId) {
        const catRec = $app.findRecordById('categories', catId)
        categoryName = catRec.getString('name')
      }
    } catch (_) {}

    var ticketNumber = record.getString('number') || ''
    var requesterName = record.getString('requester_name') || ''

    // IA: transforma a solução em conhecimento cirúrgico
    var summaryTxt = solution.slice(0, 500)
    var tokensArr = []
    try {
      const prompt =
        'Você é o agente de aprendizado do Lógos AITSM. Abaixo está a solução registrada por um operador ' +
        'ao encerrar um chamado. Transforme-a em conhecimento reutilizável para futuras sugestões.\n' +
        'Chamado #' +
        ticketNumber +
        ' — "' +
        ticketTitle +
        '"' +
        (categoryName ? ' (categoria: ' + categoryName + ')' : '') +
        (requesterName ? ' — solicitante: ' + requesterName : '') +
        '\nSolução:\n"""\n' +
        solution.slice(0, 12000) +
        '\n"""\n\n' +
        'Responda SOMENTE JSON válido: {"summary":"resumo objetivo em até 3 frases, mencionando o problema e a solução aplicada","tokens":["palavra-chave1","palavra-chave2",...]} ' +
        'com no máximo 8 tokens em minúsculas, sem acentos, relevantes para busca (ex.: "impressora", "fila travada", "spooler").'

      var aiText = ''
      try {
        const chatRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um especialista em base de conhecimento ITSM. Responda em JSON puro {"summary":"...","tokens":[...]}.',
            },
            { role: 'user', content: prompt },
          ],
        })
        aiText =
          typeof chatRes === 'string'
            ? chatRes
            : (chatRes && (chatRes.content || chatRes.reply || chatRes.text)) || ''
      } catch (chatErr) {
        $app
          .logger()
          .warn(
            'kb_closure_learning: IA indisponível, gravando solução sem resumo: ' +
              (chatErr.message || chatErr),
          )
      }

      if (aiText) {
        var clean = String(aiText).trim()
        if (clean.indexOf('```') === 0) {
          clean = clean.replace(/^```json/i, '').replace(/^```/, '')
          var lastFence = clean.lastIndexOf('```')
          if (lastFence !== -1) clean = clean.substring(0, lastFence)
        }
        try {
          const parsed = JSON.parse(clean.trim())
          summaryTxt = String(parsed.summary || summaryTxt).slice(0, 8000)
          if (Array.isArray(parsed.tokens) && parsed.tokens.length > 0) {
            tokensArr = parsed.tokens
              .map(function (t) {
                return String(t).toLowerCase()
              })
              .slice(0, 8)
          }
        } catch (parseErr) {
          summaryTxt = clean.slice(0, 8000)
        }
      }
    } catch (aiErr) {
      $app.logger().warn('kb_closure_learning: erro na IA: ' + (aiErr.message || aiErr))
    }

    const kbCol = $app.findCollectionByNameOrId('kb_sources')
    const kbRec = new Record(kbCol)
    kbRec.set(
      'name',
      ('Chamado #' + ticketNumber + ' — ' + (ticketTitle || 'Solução')).slice(0, 255),
    )
    kbRec.set('source_type', 'closure')
    kbRec.set('status', 'Pronto')
    kbRec.set(
      'extracted_text',
      (
        'Solução registrada no fechamento do chamado #' +
        ticketNumber +
        ' — ' +
        ticketTitle +
        '\nCategoria: ' +
        (categoryName || 'N/A') +
        '\n\n' +
        solution
      ).slice(0, 200000),
    )
    kbRec.set('summary', summaryTxt)
    kbRec.set('ticket', record.id)
    kbRec.set('ticket_number', ticketNumber)
    if (categoryName) kbRec.set('category', categoryName.slice(0, 100))
    kbRec.set('tokens', tokensArr)
    if (e.auth && e.auth.id) kbRec.set('uploaded_by', e.auth.id)
    kbRec.set('processed_at', new Date().toISOString())
    $app.save(kbRec)
  } catch (err) {
    $app.logger().error('kb_closure_learning: falha ao gravar kb_source: ' + (err.message || err))
  }

  return e.next()
}, 'tickets')
