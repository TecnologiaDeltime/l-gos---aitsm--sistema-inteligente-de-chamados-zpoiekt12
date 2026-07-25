cronAdd('workflow_scheduler', '0 * * * *', function () {
  var automations = []
  try {
    automations = $app.findRecordsByFilter(
      'automations',
      'status = "Ativa" && schedule_cron != ""',
      '',
      0,
      0,
    )
  } catch (_) {
    return
  }

  for (var i = 0; i < automations.length; i++) {
    var auto = automations[i]

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
    if (!definition || !definition.blocks) continue

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
    execution.set('status', 'Em Execução')
    execution.set('started_at', new Date().toISOString())
    $app.save(execution)

    var logCol = $app.findCollectionByNameOrId('workflow_execution_logs')

    function findNextBlock(def, blockId) {
      for (var k = 0; k < def.connections.length; k++) {
        if (def.connections[k].source === blockId) {
          for (var m = 0; m < def.blocks.length; m++) {
            if (def.blocks[m].id === def.connections[k].target) return def.blocks[m]
          }
        }
      }
      return null
    }

    var currentBlock = startBlock
    var maxIter = 50
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

      if (currentBlock.type === 'start') {
        log.set('result', 'Iniciado (agendado)')
        nb = findNextBlock(definition, currentBlock.id)
      } else if (currentBlock.type === 'notification') {
        try {
          var ncfg = currentBlock.config || {}
          var admins = $app.findRecordsByFilter(
            'users',
            'role = "admin" || role = "gestor"',
            '',
            0,
            0,
          )
          var notifCol = $app.findCollectionByNameOrId('notifications')
          for (var ai = 0; ai < admins.length; ai++) {
            var n = new Record(notifCol)
            n.set('user', admins[ai].id)
            n.set('title', ncfg.title || 'Notificação Agendada')
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
      } else if (currentBlock.type === 'action') {
        log.set('result', 'Executado (sem contexto de chamado)')
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

    if (iter >= maxIter) {
      execution.set('status', 'Erro')
      execution.set('error', 'Loop detectado')
      $app.save(execution)
    }
  }
})
