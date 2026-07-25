onRecordAfterCreateSuccess(function (e) {
  var ticket = e.record

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

  function evalCondition(block, tkt) {
    var cfg = block.config || {}
    var field = cfg.field,
      op = cfg.operator,
      val = cfg.value
    if (!field) return true
    var tVal = tkt.getString(field)
    if (op === '=') return tVal === val
    if (op === '!=') return tVal !== val
    if (op === 'contains') return tVal.indexOf(val) !== -1
    if (op === 'empty') return !tVal
    if (op === 'not empty') return !!tVal
    if (op === 'in') {
      var vals = (val || '').split(',')
      return vals.indexOf(tVal) !== -1
    }
    if (op === 'not in') {
      var vals2 = (val || '').split(',')
      return vals2.indexOf(tVal) === -1
    }
    if (op === '>') return parseFloat(tVal) > parseFloat(val)
    if (op === '<') return parseFloat(tVal) < parseFloat(val)
    return true
  }

  function execAction(block, tkt) {
    var cfg = block.config || {}
    var at = cfg.actionType
    if (!at) return
    var updated = $app.findRecordById('tickets', tkt.id)
    if (at === 'Alterar Prioridade') updated.set('priority', cfg.value)
    else if (at === 'Alterar Status') updated.set('status', cfg.value)
    else if (at === 'Alterar Categoria') updated.set('category', cfg.value)
    else if (at === 'Alterar Fila') updated.set('queue', cfg.value)
    else if (at === 'Atribuir Responsável') updated.set('assigned_to', cfg.value)
    else if (at === 'Alterar Impacto') updated.set('impact', cfg.value)
    else if (at === 'Alterar Urgência') updated.set('urgency', cfg.value)
    else if (at === 'Alterar Tipo') updated.set('type', cfg.value)
    else if (at === 'Fechar Chamado') {
      updated.set('status', 'Encerrado')
      updated.set('closure_date', new Date().toISOString())
    } else if (at === 'Pausar SLA') updated.set('sla_paused', true)
    else if (at === 'Resumir SLA') updated.set('sla_paused', false)
    $app.save(updated)
  }

  function sendNotif(block, tkt) {
    var cfg = block.config || {}
    var notifCol = $app.findCollectionByNameOrId('notifications')
    var uid = tkt.getString('assigned_to') || tkt.getString('created_by') || ''
    if (!uid) return
    var n = new Record(notifCol)
    n.set('user', uid)
    n.set('ticket', tkt.id)
    n.set('title', cfg.title || 'Notificação de Automação')
    n.set('message', cfg.message || '')
    n.set('type', 'Sistema')
    n.set('read', false)
    $app.save(n)
  }

  function createTask(block, tkt, autoId, execId) {
    var cfg = block.config || {}
    var col = $app.findCollectionByNameOrId('workflow_tasks')
    var task = new Record(col)
    task.set('ticket', tkt.id)
    task.set('automation', autoId)
    task.set('execution', execId)
    task.set('title', cfg.taskTitle || 'Tarefa de Automação')
    task.set('description', cfg.taskDesc || '')
    task.set('status', 'Pendente')
    task.set('task_type', cfg.taskType || 'Independente')
    $app.save(task)
  }

  function createApprovalReq(block, tkt, execId) {
    var cfg = block.config || {}
    var col = $app.findCollectionByNameOrId('approvals')
    var ap = new Record(col)
    ap.set('ticket', tkt.id)
    ap.set('requester', tkt.getString('assigned_to') || tkt.getString('created_by') || '')
    ap.set('approver', cfg.approver || '')
    ap.set('type', cfg.approvalType || 'Outros')
    ap.set('justification', cfg.taskDesc || 'Aprovação solicitada por automação')
    ap.set('status', 'Pendente')
    ap.set('token', $security.randomString(32))
    ap.set('workflow_execution', execId)
    $app.save(ap)
  }

  var automations = []
  try {
    automations = $app.findRecordsByFilter(
      'automations',
      'status = "Ativa" && schedule_cron = ""',
      '-execution_priority',
      0,
      0,
    )
  } catch (_) {
    return e.next()
  }

  for (var i = 0; i < automations.length; i++) {
    var auto = automations[i]
    var tType = auto.getString('ticket_type')
    var catalog = auto.getString('catalog')
    var client = auto.getString('client')
    if (tType && ticket.getString('type') !== tType) continue
    if (catalog && ticket.getString('category') !== catalog) continue
    if (client && ticket.getString('company') !== client) continue

    var versions = []
    try {
      versions = $app.findRecordsByFilter(
        'workflow_versions',
        'automation = "' + auto.id + '" && status = "Publicado"',
        '-version_number',
        1,
        0,
      )
    } catch (_) {
      continue
    }
    if (versions.length === 0) continue

    var version = versions[0]
    var definition
    try {
      definition = JSON.parse(version.getString('definition') || '{}')
    } catch (_) {
      continue
    }
    if (!definition || !definition.blocks || !definition.connections) continue

    var startBlock = null
    for (var j = 0; j < definition.blocks.length; j++) {
      if (definition.blocks[j].type === 'start') {
        startBlock = definition.blocks[j]
        break
      }
    }
    if (!startBlock) continue

    var execCol = $app.findCollectionByNameOrId('workflow_executions')
    var execution = new Record(execCol)
    execution.set('automation', auto.id)
    execution.set('version', version.id)
    execution.set('ticket', ticket.id)
    execution.set('status', 'Em Execução')
    execution.set('started_at', new Date().toISOString())
    $app.save(execution)

    var logCol = $app.findCollectionByNameOrId('workflow_execution_logs')
    var currentBlock = startBlock
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
      var nextBlock = null

      if (currentBlock.type === 'start') {
        log.set('result', 'Iniciado')
        nextBlock = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'condition') {
        var condResult = evalCondition(currentBlock, ticket)
        log.set('result', condResult ? 'Verdadeiro' : 'Falso')
        nextBlock = findNextBlock(definition, currentBlock.id, condResult ? 'yes' : 'no')
      } else if (currentBlock.type === 'decision') {
        var decResult = evalCondition(currentBlock, ticket)
        log.set('result', decResult ? 'Sim' : 'Não')
        nextBlock = findNextBlock(definition, currentBlock.id, decResult ? 'yes' : 'no')
      } else if (currentBlock.type === 'action') {
        try {
          execAction(currentBlock, ticket)
          log.set('result', 'Executado')
        } catch (err) {
          log.set('result', 'Erro')
          log.set('error', err.message)
        }
        nextBlock = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'notification') {
        try {
          sendNotif(currentBlock, ticket)
          log.set('result', 'Enviado')
        } catch (err) {
          log.set('result', 'Erro')
          log.set('error', err.message)
        }
        nextBlock = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'task') {
        try {
          createTask(currentBlock, ticket, auto.id, execution.id)
          log.set('result', 'Tarefa criada')
        } catch (err) {
          log.set('result', 'Erro')
          log.set('error', err.message)
        }
        nextBlock = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'integration') {
        var icfg = currentBlock.config || {}
        try {
          var res = $http.send({
            url: icfg.url,
            method: icfg.method || 'GET',
            headers: {},
            body: icfg.body || '',
            timeout: 30,
          })
          log.set('result', 'HTTP ' + res.statusCode)
        } catch (err) {
          log.set('result', 'Erro')
          log.set('error', err.message)
        }
        nextBlock = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'approval') {
        try {
          createApprovalReq(currentBlock, ticket, execution.id)
          log.set('result', 'Aguardando aprovação')
        } catch (err) {
          log.set('result', 'Erro')
          log.set('error', err.message)
        }
        execution.set('status', 'Aguardando Aprovação')
        execution.set('current_block', currentBlock.id)
        $app.save(execution)
        $app.save(log)
        break
      } else if (currentBlock.type === 'wait') {
        log.set('result', 'Aguardando')
        execution.set('status', 'Aguardando')
        execution.set('current_block', currentBlock.id)
        $app.save(execution)
        $app.save(log)
        break
      } else if (currentBlock.type === 'end') {
        log.set('result', 'Concluído')
        execution.set('status', 'Concluído')
        execution.set('completed_at', new Date().toISOString())
        $app.save(execution)
        $app.save(log)
        break
      }

      $app.save(log)
      currentBlock = nextBlock
    }

    if (iter >= maxIter) {
      execution.set('status', 'Erro')
      execution.set('error', 'Possível loop infinito')
      $app.save(execution)
    }
  }

  return e.next()
}, 'tickets')
