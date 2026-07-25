onRecordAfterUpdateSuccess(function (e) {
  var approval = e.record
  var original = approval.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = approval.getString('status')
  if (oldStatus === newStatus || newStatus === 'Pendente') return e.next()

  var execId = approval.getString('workflow_execution')
  if (!execId) return e.next()

  var execution
  try {
    execution = $app.findRecordById('workflow_executions', execId)
  } catch (_) {
    return e.next()
  }
  if (execution.getString('status') !== 'Aguardando Aprovação') return e.next()

  var versionId = execution.getString('version')
  if (!versionId) return e.next()

  var version
  try {
    version = $app.findRecordById('workflow_versions', versionId)
  } catch (_) {
    return e.next()
  }

  var definition
  try {
    definition = JSON.parse(version.getString('definition') || '{}')
  } catch (_) {
    return e.next()
  }
  if (!definition || !definition.blocks) return e.next()

  var currentBlockId = execution.getString('current_block')
  if (!currentBlockId) return e.next()

  function findNextBlock(def, blockId, port) {
    for (var i = 0; i < def.connections.length; i++) {
      var conn = def.connections[i]
      if (conn.source === blockId) {
        if (!port || !conn.sourcePort || conn.sourcePort === port) {
          for (var j = 0; j < def.blocks.length; j++) {
            if (def.blocks[j].id === conn.target) return def.blocks[j]
          }
        }
      }
    }
    return null
  }

  var port = newStatus === 'Aprovado' ? 'yes' : 'no'
  var nextBlock = findNextBlock(definition, currentBlockId, port)

  execution.set('status', 'Em Execução')
  $app.save(execution)

  var ticketId = execution.getString('ticket')
  var ticket = null
  if (ticketId) {
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (_) {}
  }

  var logCol = $app.findCollectionByNameOrId('workflow_execution_logs')
  var currentBlock = nextBlock
  var maxIter = 100
  var iter = 0

  while (currentBlock && iter < maxIter) {
    iter++
    var log = new Record(logCol)
    log.set('execution', execution.id)
    log.set('block_id', currentBlock.id)
    log.set('block_type', currentBlock.type)
    log.set('block_label', currentBlock.label || '')
    log.set('timestamp', new Date().toISOString())
    var nb = null

    if (currentBlock.type === 'action' && ticket) {
      try {
        var cfg = currentBlock.config || {}
        var updated = $app.findRecordById('tickets', ticket.id)
        var at = cfg.actionType
        if (at === 'Alterar Prioridade') updated.set('priority', cfg.value)
        else if (at === 'Alterar Status') updated.set('status', cfg.value)
        else if (at === 'Fechar Chamado') {
          updated.set('status', 'Encerrado')
          updated.set('closure_date', new Date().toISOString())
        }
        $app.save(updated)
        log.set('result', 'Executado')
      } catch (err) {
        log.set('result', 'Erro')
        log.set('error', err.message)
      }
      nb = findNextBlock(definition, currentBlock.id)
    } else if (currentBlock.type === 'notification' && ticket) {
      try {
        var ncfg = currentBlock.config || {}
        var notifCol = $app.findCollectionByNameOrId('notifications')
        var uid = ticket.getString('assigned_to') || ''
        if (uid) {
          var n = new Record(notifCol)
          n.set('user', uid)
          n.set('ticket', ticket.id)
          n.set('title', ncfg.title || 'Notificação')
          n.set('message', ncfg.message || '')
          n.set('type', 'Sistema')
          n.set('read', false)
          $app.save(n)
        }
        log.set('result', 'Enviado')
      } catch (err) {
        log.set('result', 'Erro')
        log.set('error', err.message)
      }
      nb = findNextBlock(definition, currentBlock.id)
    } else if (currentBlock.type === 'end') {
      log.set('result', 'Concluído')
      execution.set('status', 'Concluído')
      execution.set('completed_at', new Date().toISOString())
      $app.save(execution)
      $app.save(log)
      break
    } else {
      log.set('result', 'Processado')
      nb = findNextBlock(definition, currentBlock.id)
    }

    $app.save(log)
    currentBlock = nb
  }

  return e.next()
}, 'approvals')
