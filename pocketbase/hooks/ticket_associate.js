// Associa (bidirecionalmente) o ticket {id} a um ou mais tickets abertos.
// Body: { "target_ids": ["ticketId1", "ticketId2", ...] }
//
// Regras:
//  - O ticket atual e todos os alvos devem estar ABERTOS (status não Resolvido/
//    Cancelado/Encerrado).
//  - Tickets filhos (parent_ticket_id preenchido) NÃO podem ser associados.
//  - Não é permitido associar o ticket a si mesmo.
//  - A associação é bidirecional: todos os tickets envolvidos (atual + alvos +
//    quaisquer outros tickets já pertencentes aos mesmos grupos) recebem o
//    MESMO association_group_id, formando um único grupo consolidado.
routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/associate',
  (e) => {
    var ticketId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var targetIds = body.target_ids || []
    var authId = e.auth ? e.auth.id : ''

    if (!ticketId) {
      return e.badRequestError('ID do ticket é obrigatório')
    }
    if (!authId) {
      return e.badRequestError('Autenticação obrigatória')
    }
    if (!targetIds || targetIds.length === 0) {
      return e.badRequestError('Informe ao menos um ticket para associar')
    }

    var CLOSED = ['Resolvido', 'Cancelado', 'Encerrado']

    try {
      var current = $app.findRecordById('tickets', ticketId)

      // Valida o ticket atual.
      if (CLOSED.indexOf(current.getString('status')) !== -1) {
        return e.json(400, { error: 'Ticket atual não está aberto.' })
      }
      if (current.getString('parent_ticket_id')) {
        return e.json(400, {
          error: 'Ticket filho (com pai) não pode ser associado.',
        })
      }

      // IDs únicos de alvo (sem duplicatas e sem o próprio ticket atual).
      var seen = {}
      seen[ticketId] = true
      var uniqueTargets = []
      for (var i = 0; i < targetIds.length; i++) {
        var tid = targetIds[i]
        if (!tid || seen[tid]) continue
        seen[tid] = true
        uniqueTargets.push(tid)
      }

      if (uniqueTargets.length === 0) {
        return e.badRequestError('Nenhum ticket válido para associar.')
      }

      // Valida cada alvo e coleta IDs já associados (para merge de grupos).
      var allIds = [ticketId]
      for (var j = 0; j < uniqueTargets.length; j++) {
        var targetId = uniqueTargets[j]
        var target
        try {
          target = $app.findRecordById('tickets', targetId)
        } catch (_) {
          return e.json(404, { error: 'Ticket não encontrado: ' + targetId })
        }
        if (CLOSED.indexOf(target.getString('status')) !== -1) {
          return e.json(400, {
            error: 'Ticket ' + target.getString('number') + ' não está aberto.',
          })
        }
        if (target.getString('parent_ticket_id')) {
          return e.json(400, {
            error: 'Ticket ' + target.getString('number') + ' é filho e não pode ser associado.',
          })
        }
        allIds.push(targetId)
      }

      // Coleta todos os tickets já pertencentes aos grupos existentes para
      // formar um único grupo consolidado.
      var groupId = ''
      var groupMembers = {}
      for (var k = 0; k < allIds.length; k++) {
        var rec = $app.findRecordById('tickets', allIds[k])
        var existingGroup = rec.getString('association_group_id')
        if (existingGroup) {
          if (!groupId) groupId = existingGroup
          // Busca todos os membros deste grupo existente.
          var members = $app.findRecordsByFilter(
            'tickets',
            "association_group_id = '" + existingGroup + "'",
            'created',
            1000,
            0,
          )
          for (var m = 0; m < members.length; m++) {
            groupMembers[members[m].id] = members[m]
          }
        }
      }

      // Garante que os tickets envolvidos diretamente também estejam no mapa.
      for (var n = 0; n < allIds.length; n++) {
        var r = $app.findRecordById('tickets', allIds[n])
        groupMembers[r.id] = r
      }

      // Se nenhum grupo existia, gera um novo id.
      if (!groupId) {
        groupId = $security.randomString(20)
      }

      // Aplica o groupId a todos os membros consolidados.
      var updatedIds = []
      var memberIds = Object.keys(groupMembers)
      for (var p = 0; p < memberIds.length; p++) {
        var member = groupMembers[memberIds[p]]
        if (member.getString('association_group_id') !== groupId) {
          member.set('association_group_id', groupId)
          $app.save(member)
          updatedIds.push(member.id)
        }
      }

      // Histórico no ticket atual.
      try {
        var historyCol = $app.findCollectionByNameOrId('ticket_history')
        var hist = new Record(historyCol)
        hist.set('ticket', ticketId)
        hist.set('user', authId)
        hist.set('action', 'Associação de Chamados')
        hist.set('field', 'association_group_id')
        hist.set('old_value', current.original().getString('association_group_id') || '')
        hist.set('new_value', String(uniqueTargets.length) + ' ticket(s) - grupo ' + groupId)
        $app.save(hist)
      } catch (_) {}

      return e.json(200, {
        success: true,
        group_id: groupId,
        associated_count: uniqueTargets.length,
        updated: updatedIds.length,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao associar chamados: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
