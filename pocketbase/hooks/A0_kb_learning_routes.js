/// <reference path="../pb_data/types.d.ts" />

/**
 * A0_kb_learning_routes.js — Aprendizado contínuo da Base de Conhecimento (kb_sources).
 *
 * Rotas (todas autenticadas):
 * - POST /backend/v1/kb/sources/upload   -> multipart (file, name?): salva PDF em kb_sources e processa (extração + IA)
 * - POST /backend/v1/kb/sources          -> cria fonte de fechamento (closure) já resolvida (texto direto)
 * - POST /backend/v1/kb/sources/process  -> reprocessa fontes pendentes ('Processando' ou 'Erro'), até 3 por chamada
 * - DELETE /backend/v1/kb/sources/{id}   -> remove a fonte
 *
 * Regras da casa (Goja/JSVM):
 * - TODA a lógica é 100% inline nos callbacks — globalThis/_g NUNCA funciona entre callbacks.
 * - Slugs de hooks não podem começar com dígito — por isso o prefixo A0_.
 * - Serviços frontend chamam via pb.send('/backend/v1/kb/...').
 */

// ---------- ROTA: POST /backend/v1/kb/sources/upload (multipart) ----------
routerAdd(
  'POST',
  '/backend/v1/kb/sources/upload',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    try {
      const info = e.requestInfo()
      const body = info.body || {}
      const files = info.files || []

      let fileKey = ''
      for (var k in files) {
        fileKey = k
        break
      }
      if (!fileKey) return e.badRequestError('Nenhum arquivo enviado.')

      const fh = files[fileKey]
      const name = String(body.name || fh.name || 'Fonte PDF').trim() || 'Fonte PDF'

      const col = $app.findCollectionByNameOrId('kb_sources')
      const rec = new Record(col)
      rec.set('name', name.slice(0, 255))
      rec.set('source_type', 'pdf')
      rec.set('status', 'Processando')
      rec.set('uploaded_by', auth.id)
      rec.set('file', fh)

      $app.save(rec)

      // Extração server-side do PDF ($documents.toMarkdown) + resumo com IA.
      // 100% inline no callback (JSVM: funções externas não são visíveis aqui).
      var extracted = ''
      var pagesDetected = 0
      var errorMsg = ''
      try {
        const md = $documents.toMarkdown(rec, 'file')
        if (md && md.text) {
          extracted = String(md.text)
          if (md.pages) pagesDetected = parseInt(md.pages, 10) || 0
        }
      } catch (docErr) {
        errorMsg = 'Extração do PDF falhou: ' + (docErr.message || docErr)
        $app.logger().error('kb_sources upload: ' + errorMsg)
      }

      if (extracted) {
        rec.set('extracted_text', extracted.slice(0, 200000))
        rec.set('pages', pagesDetected)
        try {
          const summaryPrompt =
            'Você é o agente de aprendizado do Lógos AITSM. Leia o documento técnico abaixo e produza:\n' +
            '1) um resumo objetivo (até 6 frases) do conteúdo;\n' +
            '2) uma lista das soluções/procedimentos que ele ensina, prontos para serem reusados como sugestões em chamados.\n\n' +
            'Documento "' +
            name +
            '":\n"""\n' +
            extracted.slice(0, 40000) +
            '\n"""\n\n' +
            'Responda SOMENTE JSON válido: {"summary":"...","solutions":["...","..."]}'

          let aiText = ''
          try {
            const agentRes = $ai.agent('kb-curator-agent').chat({
              user_id: auth.id,
              message: summaryPrompt,
            })
            aiText =
              typeof agentRes === 'string'
                ? agentRes
                : (agentRes && (agentRes.content || agentRes.reply || agentRes.text)) || ''
          } catch (agentErr) {
            try {
              const chatRes = $ai.chat({
                model: 'fast',
                messages: [
                  {
                    role: 'system',
                    content:
                      'Você é um especialista em base de conhecimento ITSM. Responda em JSON puro {"summary":"...","solutions":[...]}.',
                  },
                  { role: 'user', content: summaryPrompt },
                ],
              })
              aiText =
                typeof chatRes === 'string'
                  ? chatRes
                  : (chatRes && (chatRes.content || chatRes.reply || chatRes.text)) || ''
            } catch (chatErr) {
              errorMsg = 'IA indisponível: ' + (chatErr.message || chatErr)
            }
          }

          if (aiText) {
            var clean = aiText.trim()
            if (clean.indexOf('```') === 0) {
              clean = clean.replace(/^```json/i, '').replace(/^```/, '')
              var lastFence = clean.lastIndexOf('```')
              if (lastFence !== -1) clean = clean.substring(0, lastFence)
            }
            try {
              const parsed = JSON.parse(clean.trim())
              rec.set('summary', String(parsed.summary || '').slice(0, 8000))
              if (Array.isArray(parsed.solutions) && parsed.solutions.length > 0) {
                rec.set('tokens', parsed.solutions.slice(0, 30))
              }
            } catch (parseErr) {
              rec.set('summary', clean.slice(0, 8000))
            }
          }
          rec.set('status', 'Pronto')
          rec.set('processed_at', new Date().toISOString())
        } catch (aiOuterErr) {
          errorMsg = 'Falha na análise da IA: ' + (aiOuterErr.message || aiOuterErr)
        }
      } else if (!errorMsg) {
        errorMsg = 'Nenhum texto extraído do PDF (digitalizado ou vazio?).'
      }

      if (errorMsg) {
        rec.set('status', 'Erro')
        rec.set('error', errorMsg.slice(0, 1000))
      }

      $app.save(rec)

      return e.json(200, {
        success: rec.getString('status') !== 'Erro',
        id: rec.id,
        name: rec.getString('name'),
        status: rec.getString('status'),
        summary: rec.getString('summary'),
        pages: rec.getInt('pages'),
        error: rec.getString('error'),
      })
    } catch (err) {
      $app.logger().error('kb_sources upload: ' + (err.message || err))
      return e.json(500, { error: 'Erro no upload/processamento: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)

// ---------- ROTA: POST /backend/v1/kb/sources (fonte de fechamento, texto direto) ----------
routerAdd(
  'POST',
  '/backend/v1/kb/sources',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    try {
      const body = e.requestInfo().body || {}
      const name = String(body.name || '').trim()
      const text = String(body.text || '').trim()
      if (!name) return e.badRequestError('Nome da fonte é obrigatório.')
      if (!text) return e.badRequestError('Texto/conteúdo da fonte é obrigatório.')

      const col = $app.findCollectionByNameOrId('kb_sources')
      const rec = new Record(col)
      rec.set('name', name.slice(0, 255))
      rec.set('source_type', body.source_type === 'closure' ? 'closure' : 'closure')
      rec.set('status', 'Pronto')
      rec.set('extracted_text', text.slice(0, 200000))
      rec.set('summary', String(body.summary || text.slice(0, 500)))
      if (body.ticket) rec.set('ticket', body.ticket)
      if (body.ticket_number) rec.set('ticket_number', String(body.ticket_number).slice(0, 40))
      if (body.category) rec.set('category', String(body.category).slice(0, 100))
      rec.set('tokens', Array.isArray(body.tokens) ? body.tokens : [])
      if (auth && auth.id) rec.set('uploaded_by', auth.id)
      rec.set('processed_at', new Date().toISOString())

      $app.save(rec)

      return e.json(200, {
        success: true,
        id: rec.id,
        name: rec.getString('name'),
        status: rec.getString('status'),
      })
    } catch (err) {
      $app.logger().error('kb_sources create: ' + (err.message || err))
      return e.json(500, { error: 'Erro ao criar fonte: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)

// ---------- ROTA: POST /backend/v1/kb/sources/process (reprocessa pendentes) ----------
routerAdd(
  'POST',
  '/backend/v1/kb/sources/process',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    try {
      const pending = $app.findRecordsByFilter(
        'kb_sources',
        'status = "Processando"',
        '-created',
        3,
        0,
      )

      var results = []
      for (var i = 0; i < pending.length; i++) {
        var rec = pending[i]
        var ok = false
        var errMsg = ''
        var summaryTxt = ''
        try {
          const md = $documents.toMarkdown(rec, 'file')
          const text = md && md.text ? String(md.text) : ''
          if (text) {
            rec.set('extracted_text', text.slice(0, 200000))
            if (md.pages) rec.set('pages', parseInt(md.pages, 10) || 0)

            const summaryPrompt =
              'Você é o agente de aprendizado do Lógos AITSM. Leia o documento técnico abaixo e produza:\n' +
              '1) um resumo objetivo (até 6 frases);\n' +
              '2) uma lista das soluções/procedimentos que ele ensina, prontos para serem reusados como sugestões em chamados.\n\n' +
              'Documento "' +
              rec.getString('name') +
              '":\n"""\n' +
              text.slice(0, 40000) +
              '\n"""\n\n' +
              'Responda SOMENTE JSON válido: {"summary":"...","solutions":["...","..."]}'

            var aiText = ''
            try {
              const agentRes = $ai.agent('kb-curator-agent').chat({
                user_id: auth.id,
                message: summaryPrompt,
              })
              aiText =
                typeof agentRes === 'string'
                  ? agentRes
                  : (agentRes && (agentRes.content || agentRes.reply || agentRes.text)) || ''
            } catch (agentErr) {
              try {
                const chatRes = $ai.chat({
                  model: 'fast',
                  messages: [
                    {
                      role: 'system',
                      content:
                        'Você é um especialista em base de conhecimento ITSM. Responda em JSON puro {"summary":"...","solutions":[...]}.',
                    },
                    { role: 'user', content: summaryPrompt },
                  ],
                })
                aiText =
                  typeof chatRes === 'string'
                    ? chatRes
                    : (chatRes && (chatRes.content || chatRes.reply || chatRes.text)) || ''
              } catch (chatErr) {
                errMsg = 'IA indisponível: ' + (chatErr.message || chatErr)
              }
            }

            if (aiText) {
              var clean = aiText.trim()
              if (clean.indexOf('```') === 0) {
                clean = clean.replace(/^```json/i, '').replace(/^```/, '')
                var lastFence = clean.lastIndexOf('```')
                if (lastFence !== -1) clean = clean.substring(0, lastFence)
              }
              try {
                const parsed = JSON.parse(clean.trim())
                summaryTxt = String(parsed.summary || '').slice(0, 8000)
                if (Array.isArray(parsed.solutions) && parsed.solutions.length > 0) {
                  rec.set('tokens', parsed.solutions.slice(0, 30))
                }
              } catch (parseErr) {
                summaryTxt = clean.slice(0, 8000)
              }
              rec.set('summary', summaryTxt)
            }
            rec.set('status', 'Pronto')
            rec.set('processed_at', new Date().toISOString())
            ok = true
          } else {
            errMsg = 'Nenhum texto extraído do PDF (digitalizado ou vazio?).'
          }
        } catch (docErr) {
          errMsg = 'Extração do PDF falhou: ' + (docErr.message || docErr)
        }

        if (!ok) {
          rec.set('status', 'Erro')
          rec.set('error', String(errMsg).slice(0, 1000))
        }
        $app.save(rec)
        results.push({
          id: rec.id,
          name: rec.getString('name'),
          status: rec.getString('status'),
          error: rec.getString('error'),
        })
      }

      return e.json(200, { success: true, processed: results.length, results: results })
    } catch (err) {
      $app.logger().error('kb_sources process: ' + (err.message || err))
      return e.json(500, { error: 'Erro ao processar fontes: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)

// ---------- ROTA: DELETE /backend/v1/kb/sources/{id} ----------
routerAdd(
  'DELETE',
  '/backend/v1/kb/sources/{id}',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    try {
      const id = e.request.pathValue('id')
      const rec = $app.findRecordById('kb_sources', id)
      $app.delete(rec)
      return e.json(200, { success: true, id: id })
    } catch (err) {
      return e.json(500, { error: 'Erro ao remover fonte: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)
