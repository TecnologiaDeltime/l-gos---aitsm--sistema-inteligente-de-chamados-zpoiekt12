// Resolve em massa todos os tickets do mesmo grupo de associação de {id}.
// Body: { "solution_description": "...", "resolved_by": "userId" }
//
// Regras:
//  - Todos os tickets do grupo que ainda estão ABERTOS são resolvidos.
//  - Tickets já fechados (Resolvido/Cancelado/Encerrado) são ignorados.
//  - Todos recebem o MESMO solution_description, resolved_at e resolved_by.
//  - Ticket pai com filhos pendentes: NÃO é resolvido (pulado) e listado em
//    `skipped_blocked`.
//  - Cria histórico e dispara os hooks de resolução (consumo de horas,
//    pesquisa de satisfação) via $app.save normal.
routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/batch-resolve',
  (e) => {
    var ticketId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var solutionDescription = body.solution_description || ''
    var resolvedById = body.resolved_by || (e.auth ? e.auth.id : '')

    if (!ticketId) {
      return e.badRequestError('ID do ticket é obrigatório')
    }
    if (!resolvedById) {
      return e.badRequestError('resolved_by é obrigatório')
    }
    if (!solutionDescription || solutionDescription.trim().length < 10) {
      return e.badRequestError('A solução deve ter no mínimo 10 caracteres.')
    }

    var CLOSED = ['Resolvido', 'Cancelado', 'Encerrado']

    try {
      var current = $app.findRecordById('tickets', ticketId)
      var groupId = current.getString('association_group_id')
      if (!groupId) {
        return e.json(400, { error: 'Este chamado não possui associações.' })
      }

      var nowIso = new Date().toISOString()
      var solutionTrim = solutionDescription.trim()

      // Busca todos os tickets do grupo.
      var members = $app.findRecordsByFilter(
        'tickets',
        "association_group_id = '" + groupId + "'",
        'created',
        1000,
        0,
      )

      var resolvedIds = []
      var skippedClosed = []
      var skippedBlocked = []

      for (var i = 0; i < members.length; i++) {
        var t = members[i]

        // Já fechado: ignora.
        if (CLOSED.indexOf(t.getString('status')) !== -1) {
          skippedClosed.push(t.id)
          continue
        }

        // Ticket pai com filhos pendentes: bloqueia (não resolve).
        var parentId = t.getString('parent_ticket_id')
        // Se o próprio ticket tem filhos, verifica pendentes.
        try {
          var children = $app.findRecordsByFilter(
            'tickets',
            "parent_ticket_id = '" + t.id + "'",
            'created',
            1000,
            0,
          )
          var hasPendingChild = false
          for (var c = 0; c < children.length; c++) {
            if (CLOSED.indexOf(children[c].getString('status')) === -1) {
              hasPendingChild = true
              break
            }
          }
          if (hasPendingChild) {
            skippedBlocked.push(t.id)
            continue
          }
        } catch (_) {}

        // Aplica a resolução — mesmos campos para todos.
        t.set('status', 'Resolvido')
        t.set('solution', solutionTrim)
        t.set('resolution_date', nowIso)
        t.set('closed_by', resolvedById)
        $app.save(t)
        resolvedIds.push(t.id)

        // Histórico de resolução.
        try {
          var histCol = $app.findCollectionByNameOrId('ticket_history')
          var hist = new Record(histCol)
          hist.set('ticket', t.id)
          hist.set('user', resolvedById)
          hist.set('action', 'Resolvido em Massa')
          hist.set('field', 'solution')
          hist.set('old_value', '')
          var trunc =
            solutionTrim.length > 200 ? solutionTrim.substring(0, 200) + '...' : solutionTrim
          hist.set('new_value', trunc + ' (fechamento em massa - grupo ' + groupId + ')')
          $app.save(hist)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        group_id: groupId,
        resolved: resolvedIds,
        skipped_closed: skippedClosed,
        skipped_blocked: skippedBlocked,
        resolved_at: nowIso,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao resolver em massa: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
