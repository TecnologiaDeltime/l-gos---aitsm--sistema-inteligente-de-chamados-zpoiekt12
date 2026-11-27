// A0_inventory.js — Inventário de Aparelhos (celulares e câmeras).
// Rotas:
//   GET  /backend/v1/inventory/devices            (todos logados — consulta)
//   POST /backend/v1/inventory/devices            (inventario_gerenciar)
//   PUT  /backend/v1/inventory/devices/{id}       (inventario_gerenciar)
//   PUT  /backend/v1/inventory/devices/{id}/deactivate (inventario_gerenciar — desativar)
//   GET  /backend/v1/inventory/devices/{id}/movements (inventario_consultar)
//   POST /backend/v1/inventory/devices/{id}/movements (inventario_gerenciar — movimentação manual)
//
// Regras do projeto:
//   - NUNCA apagar registro: desativar = status 'desativado' (histórico preservado).
//   - Dupla barreira: regras da coleção já restringem escrita a admin/gestor;
//     o hook valida de novo a permissão granular inventory.inventario_gerenciar.
//   - Goja (JSVM): sem helpers globais fora de IIFE publicado em _g — tudo inline.
//   - Slug sem dígitos, prefixo A0_.

routerAdd(
  'GET',
  '/backend/v1/inventory/devices',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')

    var body = e.requestInfo().query || {}
    var filters = []
    var safeParam = function (v) {
      return String(v == null ? '' : v)
        .replace(/"/g, "'")
        .trim()
    }

    var type = safeParam(body.type)
    if (type && (type === 'celular' || type === 'camera')) {
      filters.push('device_type = "' + type + '"')
    }
    var status = safeParam(body.status)
    if (
      status &&
      (status === 'disponivel' ||
        status === 'em_uso' ||
        status === 'manutencao' ||
        status === 'desativado')
    ) {
      filters.push('status = "' + status + '"')
    }

    var all = String(body.all || '') === '1'
    var includeInactive = status === 'desativado'
    if (!includeInactive && !status && !all) {
      // Padrão: listagem ativa oculta os desativados (all=1 quando quiser vê-los)
      filters.push("status != 'desativado'")
    }

    var rows = $app.findRecordsByFilter(
      'inventory_devices',
      filters.join(' && '),
      'device_type, brand, model, created',
      0,
      0,
    )
    var out = []
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      var assignedName = ''
      var assignedId = ''
      try {
        var assigned = r.expandFind('assigned_to')
        if (assigned) {
          assignedId = assigned.id
          assignedName = assigned.getString('name')
        }
      } catch (_) {}
      out.push({
        id: r.id,
        device_type: r.getString('device_type'),
        brand: r.getString('brand'),
        model: r.getString('model'),
        serial_number: r.getString('serial_number'),
        phone_number: r.getString('phone_number'),
        condition: r.getString('condition'),
        status: r.getString('status'),
        assigned_to: assignedId,
        assigned_to_name: assignedName,
        notes: r.getString('notes'),
        created: r.getString('created'),
        updated: r.getString('updated'),
      })
    }
    return e.json(200, { devices: out })
  },
  $apis.requireAuth(),
)

// ---- permissões (inline, publicadas em _g com fallback local) ----
;(function () {
  var canConsultInventory = function (authRecord) {
    if (!authRecord) return false
    if (authRecord.getString('role') === 'admin' || authRecord.getString('role') === 'gestor') {
      return true
    }
    try {
      var profId = authRecord.getString('profile_id')
      if (!profId) return false
      var permRows = $app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' +
          profId +
          '" && item_key = "inventario_consultar" && granted = true && module_key = "inventory"',
        '',
        1,
        0,
      )
      return permRows.length > 0
    } catch (_) {
      return false
    }
  }
  var canManageInventory = function (authRecord) {
    if (!authRecord) return false
    if (authRecord.getString('role') === 'admin' || authRecord.getString('role') === 'gestor') {
      return true
    }
    try {
      var profId = authRecord.getString('profile_id')
      if (!profId) return false
      var permRows = $app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' +
          profId +
          '" && item_key = "inventario_gerenciar" && granted = true && module_key = "inventory"',
        '',
        1,
        0,
      )
      return permRows.length > 0
    } catch (_) {
      return false
    }
  }
  if (typeof globalThis !== 'undefined') {
    if (typeof globalThis._g === 'undefined') globalThis._g = {}
    globalThis._g.canConsultInventory = canConsultInventory
    globalThis._g.canManageInventory = canManageInventory
  }
})()

function canConsultInventory(authRecord) {
  try {
    if (globalThis._g && globalThis._g.canConsultInventory) {
      return globalThis._g.canConsultInventory(authRecord)
    }
  } catch (_) {}
  // fallback inline (mesma lógica, sem depender de _g)
  if (!authRecord) return false
  if (authRecord.getString('role') === 'admin' || authRecord.getString('role') === 'gestor') {
    return true
  }
  try {
    var profId = authRecord.getString('profile_id')
    if (!profId) return false
    var permRows = $app.findRecordsByFilter(
      'profile_permissions',
      'profile = "' +
        profId +
        '" && item_key = "inventario_consultar" && granted = true && module_key = "inventory"',
      '',
      1,
      0,
    )
    return permRows.length > 0
  } catch (_) {
    return false
  }
}

function canManageInventory(authRecord) {
  try {
    if (globalThis._g && globalThis._g.canManageInventory) {
      return globalThis._g.canManageInventory(authRecord)
    }
  } catch (_) {}
  // fallback inline (mesma lógica, sem depender de _g)
  if (!authRecord) return false
  if (authRecord.getString('role') === 'admin' || authRecord.getString('role') === 'gestor') {
    return true
  }
  try {
    var profId = authRecord.getString('profile_id')
    if (!profId) return false
    var permRows = $app.findRecordsByFilter(
      'profile_permissions',
      'profile = "' +
        profId +
        '" && item_key = "inventario_gerenciar" && granted = true && module_key = "inventory"',
      '',
      1,
      0,
    )
    return permRows.length > 0
  } catch (_) {
    return false
  }
}

function validateDevicePayload(body, forUpdate) {
  var knownTypes = ['celular', 'camera']
  var knownStatus = ['disponivel', 'em_uso', 'manutencao', 'desativado']
  var knownCondition = ['novo', 'uso']

  if (!forUpdate || body.device_type !== undefined) {
    if (knownTypes.indexOf(body.device_type) === -1) {
      return { error: 'Tipo de aparelho inválido (use celular ou câmera)' }
    }
  }
  if (!forUpdate || body.brand !== undefined) {
    if (typeof body.brand !== 'string' || !body.brand.trim()) {
      return { error: 'Informe a marca do aparelho' }
    }
  }
  if (!forUpdate || body.model !== undefined) {
    if (typeof body.model !== 'string' || !body.model.trim()) {
      return { error: 'Informe o modelo do aparelho' }
    }
  }
  if (!forUpdate || body.status !== undefined) {
    if (knownStatus.indexOf(body.status) === -1) {
      return { error: 'Status inválido' }
    }
  }
  if (body.condition !== undefined && body.condition !== '' && body.condition !== null) {
    if (knownCondition.indexOf(body.condition) === -1) {
      return { error: 'Estado inválido (use novo ou uso)' }
    }
  }
  if (body.serial_number !== undefined && body.serial_number !== null) {
    var sn = String(body.serial_number).trim()
    if (sn.length > 120) return { error: 'Número de série/IMEI muito longo (máx. 120)' }
  }
  if (body.phone_number !== undefined && body.phone_number !== null) {
    var ph = String(body.phone_number).trim()
    if (ph.length > 40) return { error: 'Número de linha/chip muito longo (máx. 40)' }
  }
  if (body.notes !== undefined && body.notes !== null) {
    var nt = String(body.notes).trim()
    if (nt.length > 2000) return { error: 'Observação muito longa (máx. 2000)' }
  }
  return null
}

function applyDevicePayload(record, body, authRecord) {
  if (body.device_type !== undefined) record.set('device_type', body.device_type)
  if (body.brand !== undefined) record.set('brand', String(body.brand).trim())
  if (body.model !== undefined) record.set('model', String(body.model).trim())
  if (body.serial_number !== undefined) {
    record.set('serial_number', String(body.serial_number || '').trim())
  }
  if (body.phone_number !== undefined) {
    record.set('phone_number', String(body.phone_number || '').trim())
  }
  if (body.condition !== undefined) {
    record.set('condition', body.condition === '' || body.condition === null ? '' : body.condition)
  }
  if (body.status !== undefined) record.set('status', body.status)
  if (body.notes !== undefined) record.set('notes', String(body.notes || '').trim())
  if (body.assigned_to !== undefined) {
    if (!body.assigned_to || body.assigned_to === '') {
      record.set('assigned_to', '')
    } else {
      try {
        var u = $app.findRecordById('users', body.assigned_to)
        record.set('assigned_to', u.id)
      } catch (_) {
        record.set('assigned_to', '')
      }
    }
  }
  if (authRecord && authRecord.id) record.set('created_by', authRecord.id)
}

// ---- Histórico de movimentação ----

var MOVEMENT_TYPES = [
  'cadastrado',
  'atribuido',
  'devolvido',
  'manutencao',
  'editado',
  'desativado',
  'reativado',
  'manual',
]

// Grava uma movimentação. Erros de histórico NUNCA derrubam a ação principal
// (cadastrar/editar/desativar) — apenas logam.
function recordMovement(deviceId, movementType, description, previousOwnerId, newOwnerId, actorId) {
  try {
    var col = $app.findCollectionByNameOrId('inventory_movements')
    var rec = new Record(col)
    rec.set('device', deviceId)
    rec.set('movement_type', movementType)
    rec.set('description', String(description || '').slice(0, 2000))
    if (previousOwnerId) rec.set('previous_owner', previousOwnerId)
    if (newOwnerId) rec.set('new_owner', newOwnerId)
    if (actorId) rec.set('performed_by', actorId)
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error recording inventory movement', 'error', err.message)
  }
}

// Nome do usuário por id (para textos do histórico).
function userNameById(userId) {
  if (!userId) return ''
  try {
    var u = $app.findRecordById('users', userId)
    return u.getString('name') || u.getString('email') || ''
  } catch (_) {
    return ''
  }
}

// Compara o aparelho antes/depois da gravação e descreve as diferenças.
// Detecta principalmente mudança de responsável e de status.
var FIELD_LABELS = {
  brand: 'Marca',
  model: 'Modelo',
  serial_number: 'IMEI/Serial',
  phone_number: 'Linha',
  condition: 'Estado',
  status: 'Status',
  assigned_to: 'Responsável',
  notes: 'Observação',
  device_type: 'Tipo',
}

function buildFieldDiff(before, after) {
  var changes = []
  var keys = Object.keys(FIELD_LABELS)
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    var beforeVal = before[k] === undefined || before[k] === null ? '' : String(before[k])
    var afterVal = after[k] === undefined || after[k] === null ? '' : String(after[k])
    if (beforeVal !== afterVal) {
      changes.push({ field: k, from: beforeVal, to: afterVal })
    }
  }
  return changes
}

function describeDiff(diff) {
  var parts = []
  for (var i = 0; i < diff.length; i++) {
    var c = diff[i]
    var label = FIELD_LABELS[c.field] || c.field
    if (c.field === 'assigned_to') {
      var from = c.from ? userNameById(c.from) : 'Sem responsável'
      var to = c.to ? userNameById(c.to) : 'Sem responsável'
      parts.push('Responsável: de "' + from + '" para "' + to + '"')
    } else if (c.field === 'status') {
      parts.push('Status: ' + c.from + ' → ' + c.to)
    } else if (c.field === 'device_type') {
      var fromT = c.from === 'camera' ? 'Câmera' : 'Celular'
      var toT = c.to === 'camera' ? 'Câmera' : 'Celular'
      parts.push('Tipo: ' + fromT + ' → ' + toT)
    } else {
      parts.push(label + ' alterado')
    }
  }
  return parts.join('; ')
}

function snapshotDevice(rec) {
  var assignedTo = ''
  try {
    var rel = rec.getStringSlice('assigned_to')
    if (rel && rel.length > 0) assignedTo = String(rel[0])
  } catch (_) {
    try {
      assignedTo = rec.getString('assigned_to')
    } catch (__) {
      assignedTo = ''
    }
  }
  return {
    device_type: rec.getString('device_type'),
    brand: rec.getString('brand'),
    model: rec.getString('model'),
    serial_number: rec.getString('serial_number'),
    phone_number: rec.getString('phone_number'),
    condition: rec.getString('condition'),
    status: rec.getString('status'),
    assigned_to: assignedTo,
    notes: rec.getString('notes'),
  }
}

var createDeviceHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageInventory(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar o inventário')
  }

  var body = e.requestInfo().body || {}
  var validation = validateDevicePayload(body, false)
  if (validation) return e.badRequestError(validation.error)

  var col
  try {
    col = $app.findCollectionByNameOrId('inventory_devices')
  } catch (_) {
    return e.json(500, { error: 'Coleção do inventário não encontrada' })
  }

  var rec = new Record(col)
  applyDevicePayload(rec, body, authRecord)
  if (body.status === undefined) rec.set('status', 'disponivel')
  if (body.condition === undefined) rec.set('condition', 'uso')

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error creating inventory device', 'error', err.message)
    return e.json(500, { error: 'Erro ao cadastrar aparelho' })
  }

  // Histórico: movimentação de criação.
  var snapshot = snapshotDevice(rec)
  var createdDesc =
    'Aparelho cadastrado: ' +
    snapshot.brand +
    ' ' +
    snapshot.model +
    (snapshot.serial_number ? ' (IMEI/Serial: ' + snapshot.serial_number + ')' : '')
  if (snapshot.assigned_to) {
    recordMovement(rec.id, 'cadastrado', createdDesc, '', snapshot.assigned_to, authRecord.id)
    recordMovement(
      rec.id,
      'atribuido',
      'Responsável inicial: ' + userNameById(snapshot.assigned_to),
      '',
      snapshot.assigned_to,
      authRecord.id,
    )
  } else {
    recordMovement(rec.id, 'cadastrado', createdDesc, '', '', authRecord.id)
  }

  return e.json(200, { success: true, id: rec.id })
}

var updateDeviceHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageInventory(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar o inventário')
  }

  var devId = e.request.pathValue('id')
  if (!devId) return e.badRequestError('ID do aparelho é obrigatório')

  var rec
  try {
    rec = $app.findRecordById('inventory_devices', devId)
  } catch (_) {
    return e.notFoundError('Aparelho não encontrado')
  }

  var before = snapshotDevice(rec)

  var body = e.requestInfo().body || {}
  var validation = validateDevicePayload(body, true)
  if (validation) return e.badRequestError(validation.error)

  applyDevicePayload(rec, body, null)

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error updating inventory device', 'error', err.message)
    return e.json(500, { error: 'Erro ao atualizar aparelho' })
  }

  // Histórico: registra o que mudou (principalmente responsável e status).
  var after = snapshotDevice(rec)
  var diff = buildFieldDiff(before, after)
  if (diff.length > 0) {
    var desc = describeDiff(diff)
    var prevOwner = before.assigned_to
    var newOwner = after.assigned_to
    if (prevOwner !== newOwner) {
      // Mudança de responsável: grava como atribuído (ou devolvido se ficou sem).
      var ownerDesc = prevOwner
        ? 'Responsável alterado: de "' +
          userNameById(prevOwner) +
          '" para "' +
          (newOwner ? userNameById(newOwner) : 'Sem responsável') +
          '"'
        : 'Aparelho atribuído a: ' + userNameById(newOwner)
      recordMovement(
        rec.id,
        newOwner ? 'atribuido' : 'devolvido',
        ownerDesc + (desc ? ' — ' + desc : ''),
        prevOwner,
        newOwner,
        authRecord.id,
      )
    } else {
      recordMovement(rec.id, 'editado', desc, prevOwner, newOwner, authRecord.id)
    }
  }

  return e.json(200, { success: true, id: rec.id })
}

// Desativar = status 'desativado' — nunca apaga registro (padrão do projeto).
var deactivateDeviceHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageInventory(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar o inventário')
  }

  var devId = e.request.pathValue('id')
  if (!devId) return e.badRequestError('ID do aparelho é obrigatório')

  var rec
  try {
    rec = $app.findRecordById('inventory_devices', devId)
  } catch (_) {
    return e.notFoundError('Aparelho não encontrado')
  }

  var before = snapshotDevice(rec)
  rec.set('status', 'desativado')

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error deactivating inventory device', 'error', err.message)
    return e.json(500, { error: 'Erro ao desativar aparelho' })
  }

  // Histórico: desativação mantém responsável (só muda status).
  var desc = 'Aparelho desativado (saída da listagem ativa; registro preservado)'
  if (before.assigned_to) {
    desc = desc + ' — Responsável: ' + userNameById(before.assigned_to)
  }
  recordMovement(rec.id, 'desativado', desc, before.assigned_to, before.assigned_to, authRecord.id)

  return e.json(200, { success: true, id: rec.id, status: 'desativado' })
}

// Listar histórico de movimentação de um aparelho (inventario_consultar).
var listMovementsHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canConsultInventory(authRecord)) {
    return e.forbiddenError('Sem permissão para consultar o inventário')
  }

  var devId = e.request.pathValue('id')
  if (!devId) return e.badRequestError('ID do aparelho é obrigatório')

  try {
    $app.findRecordById('inventory_devices', devId)
  } catch (_) {
    return e.notFoundError('Aparelho não encontrado')
  }

  var rows = $app.findRecordsByFilter(
    'inventory_movements',
    'device = "' + devId + '"',
    '-created',
    0,
    0,
  )
  var out = []
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    out.push({
      id: r.id,
      movement_type: r.getString('movement_type'),
      description: r.getString('description'),
      performed_by_name: expandUserName(r, 'performed_by'),
      previous_owner_name: expandUserName(r, 'previous_owner'),
      new_owner_name: expandUserName(r, 'new_owner'),
      created: r.getString('created'),
    })
  }
  return e.json(200, { movements: out })
}

function expandUserName(record, fieldName) {
  try {
    var rec = record.expandFind(fieldName)
    if (rec) return rec.getString('name') || rec.getString('email') || ''
  } catch (_) {}
  return ''
}

// Movimentação manual (inventario_gerenciar) — ex. "Atribuir a", "Enviar para
// manutenção", "Devolvido". Tipos com efeito alteram o aparelho E registram o
// evento (uma única gravação, sem passar pelo handler de update).
var addMovementHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageInventory(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar o inventário')
  }

  var devId = e.request.pathValue('id')
  if (!devId) return e.badRequestError('ID do aparelho é obrigatório')

  var rec
  try {
    rec = $app.findRecordById('inventory_devices', devId)
  } catch (_) {
    return e.notFoundError('Aparelho não encontrado')
  }
  var before = snapshotDevice(rec)

  var body = e.requestInfo().body || {}
  var movementType = String(body.movement_type || '')
  if (MOVEMENT_TYPES.indexOf(movementType) === -1) {
    return e.badRequestError('Tipo de movimentação inválido')
  }
  if (
    movementType === 'cadastrado' ||
    movementType === 'desativado' ||
    movementType === 'reativado'
  ) {
    return e.badRequestError(
      'Use as ações de cadastrar, desativar ou reativar para registrar este tipo de movimentação',
    )
  }

  var desc = String(body.description || '').trim()
  if (!desc) return e.badRequestError('Informe a descrição da movimentação')
  if (desc.length > 2000) return e.badRequestError('Descrição muito longa (máx. 2000)')

  var newOwner = ''
  if (body.new_owner !== undefined && body.new_owner !== null && String(body.new_owner) !== '') {
    try {
      var u = $app.findRecordById('users', String(body.new_owner))
      newOwner = u.id
    } catch (_) {
      return e.badRequestError('Usuário informado como novo responsável não encontrado')
    }
  }

  // Efeito da movimentação no aparelho ( quando o tipo tem efeito):
  // atribuido → troca o responsável; devolvido → limpa o responsável;
  // manutencao → status 'manutencao'. editado/manual → só registra.
  if (movementType === 'atribuido' && !newOwner) {
    return e.badRequestError('Informe o novo responsável para atribuir o aparelho')
  }
  var changed = false
  if (movementType === 'atribuido' && newOwner !== before.assigned_to) {
    rec.set('assigned_to', newOwner)
    changed = true
  } else if (movementType === 'devolvido' && before.assigned_to) {
    rec.set('assigned_to', '')
    changed = true
  } else if (movementType === 'manutencao' && before.status !== 'manutencao') {
    rec.set('status', 'manutencao')
    changed = true
  }

  if (changed) {
    try {
      $app.save(rec)
    } catch (err) {
      $app.logger().error('Error applying inventory movement to device', 'error', err.message)
      return e.json(500, { error: 'Erro ao aplicar a movimentação no aparelho' })
    }
  }

  recordMovement(
    devId,
    movementType,
    desc,
    before.assigned_to,
    changed ? rec.getString('assigned_to') : newOwner,
    authRecord.id,
  )

  return e.json(200, { success: true })
}

routerAdd('POST', '/backend/v1/inventory/devices', createDeviceHandler, $apis.requireAuth())

routerAdd('PUT', '/backend/v1/inventory/devices/{id}', updateDeviceHandler, $apis.requireAuth())

routerAdd(
  'PUT',
  '/backend/v1/inventory/devices/{id}/deactivate',
  deactivateDeviceHandler,
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/inventory/devices/{id}/movements',
  listMovementsHandler,
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/inventory/devices/{id}/movements',
  addMovementHandler,
  $apis.requireAuth(),
)
