// A0_inventory.js — Inventário de Aparelhos (celulares e câmeras).
// Rotas:
//   GET  /backend/v1/inventory/devices            (todos logados — consulta)
//   POST /backend/v1/inventory/devices            (inventario_gerenciar)
//   PUT  /backend/v1/inventory/devices/{id}       (inventario_gerenciar)
//   PUT  /backend/v1/inventory/devices/{id}/deactivate (inventario_gerenciar — desativar)
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

    var includeInactive = status === 'desativado'
    if (!includeInactive && !status) {
      // Padrão: listagem ativa oculta os desativados (consulta explicita quando quiser vê-los)
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

// ---- permissão de gerência (inline, publicada em _g com fallback local) ----
;(function () {
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
    globalThis._g.canManageInventory = canManageInventory
  }
})()

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

  rec.set('status', 'desativado')

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error deactivating inventory device', 'error', err.message)
    return e.json(500, { error: 'Erro ao desativar aparelho' })
  }

  return e.json(200, { success: true, id: rec.id, status: 'desativado' })
}

routerAdd('POST', '/backend/v1/inventory/devices', createDeviceHandler, $apis.requireAuth())

routerAdd('PUT', '/backend/v1/inventory/devices/{id}', updateDeviceHandler, $apis.requireAuth())

routerAdd(
  'PUT',
  '/backend/v1/inventory/devices/{id}/deactivate',
  deactivateDeviceHandler,
  $apis.requireAuth(),
)
