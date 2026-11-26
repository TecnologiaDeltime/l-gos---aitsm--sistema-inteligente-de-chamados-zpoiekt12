// A0_custom_field_defs.js — Campos customizados da ficha do chamado.
// Rotas:
//   GET    /backend/v1/tickets/custom-fields/definitions           (todos logados)
//   POST   /backend/v1/tickets/custom-fields/definitions           (admin/gestor)
//   PUT    /backend/v1/tickets/custom-fields/definitions/{id}      (admin/gestor)
//   DELETE /backend/v1/tickets/custom-fields/definitions/{id}      (admin/gestor)
//   PUT    /backend/v1/tickets/{id}/custom-fields/values           (quem edita o chamado)
//
// Dupla barreira: as regras da coleção já restringem a definição a admin/gestor;
// o hook valida de novo server-side. O item do catálogo é
// tickets.campos_customizados_gerenciar (aceita também o módulo legado 'clients'
// caso um perfil antigo tenha a concessão lá — mesmo padrão de worked_hours_edit.js).
//
// Regras do Goja (JSVM): sem helpers globais fora de IIFE publicado em _g —
// tudo 100% inline dentro de cada handler.

routerAdd(
  'GET',
  '/backend/v1/tickets/custom-fields/definitions',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')

    var includeInactive = false
    if (authRecord.getString('role') === 'admin' || authRecord.getString('role') === 'gestor') {
      includeInactive = true
    }

    var filter = includeInactive ? '' : 'active = true'
    var rows = $app.findRecordsByFilter('custom_field_defs', filter, 'sort_order, created', 0, 0)
    var out = []
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      out.push({
        id: r.id,
        name: r.getString('name'),
        field_type: r.getString('field_type'),
        options: JSON.parse(r.getString('options') || '[]'),
        sort_order: r.getInt('sort_order') || 0,
        active: r.getBool('active'),
        created: r.getString('created'),
        updated: r.getString('updated'),
      })
    }
    return e.json(200, { fields: out })
  },
  $apis.requireAuth(),
)

// ---- permissão de gerência (inline, compartilhada via função publicada em _g) ----
;(function () {
  var canManageDefs = function (authRecord) {
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
          '" && item_key = "campos_customizados_gerenciar" && granted = true && (module_key = "tickets" || module_key = "clients")',
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
    globalThis._g.canManageCustomFieldDefs = canManageDefs
  }
})()

function canManageCustomFieldDefs(authRecord) {
  try {
    if (globalThis._g && globalThis._g.canManageCustomFieldDefs) {
      return globalThis._g.canManageCustomFieldDefs(authRecord)
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
        '" && item_key = "campos_customizados_gerenciar" && granted = true && (module_key = "tickets" || module_key = "clients")',
      '',
      1,
      0,
    )
    return permRows.length > 0
  } catch (_) {
    return false
  }
}

function validateCustomFieldDefPayload(body, forUpdate) {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return { error: 'Nome/rótulo do campo é obrigatório' }
    }
    if (body.name.trim().length > 120) {
      return { error: 'Nome/rótulo do campo deve ter até 120 caracteres' }
    }
  } else if (!forUpdate) {
    return { error: 'Nome/rótulo do campo é obrigatório' }
  }

  var validTypes = ['texto_curto', 'texto_longo', 'numero', 'data', 'selecao', 'sim_nao']
  if (body.field_type !== undefined) {
    if (validTypes.indexOf(body.field_type) === -1) {
      return { error: 'Tipo de campo inválido' }
    }
  } else if (!forUpdate) {
    return { error: 'Tipo de campo é obrigatório' }
  }

  if (body.options !== undefined) {
    if (body.options !== null && !Array.isArray(body.options)) {
      return { error: 'Opções deve ser uma lista de strings' }
    }
    if (Array.isArray(body.options)) {
      for (var i = 0; i < body.options.length; i++) {
        if (typeof body.options[i] !== 'string') {
          return { error: 'Opções deve ser uma lista de strings' }
        }
        if (body.options[i].trim().length > 120) {
          return { error: 'Cada opção deve ter até 120 caracteres' }
        }
      }
      if (body.options.length > 50) {
        return { error: 'Máximo de 50 opções por campo de seleção' }
      }
    }
  }

  if (body.sort_order !== undefined && body.sort_order !== null) {
    var so = Number(body.sort_order)
    if (!Number.isFinite(so) || so < 0) {
      return { error: 'Ordem de exibição deve ser um número não negativo' }
    }
  }

  return null
}

function applyCustomFieldDefPayload(record, body, authRecord) {
  if (body.name !== undefined) record.set('name', body.name.trim())
  if (body.field_type !== undefined) record.set('field_type', body.field_type)
  if (body.options !== undefined) {
    record.set('options', JSON.stringify(body.options || []))
  }
  if (body.sort_order !== undefined && body.sort_order !== null) {
    record.set('sort_order', Math.round(Number(body.sort_order)))
  }
  if (body.active !== undefined) record.set('active', !!body.active)
  if (authRecord && authRecord.id) record.set('created_by', authRecord.id)
}

var createDefHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageCustomFieldDefs(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar campos customizados')
  }

  var body = e.requestInfo().body || {}
  var validation = validateCustomFieldDefPayload(body, false)
  if (validation) return e.badRequestError(validation.error)

  var col
  try {
    col = $app.findCollectionByNameOrId('custom_field_defs')
  } catch (_) {
    return e.json(500, { error: 'Coleção de campos customizados não encontrada' })
  }

  var rec = new Record(col)
  applyCustomFieldDefPayload(rec, body, authRecord)
  if (body.active === undefined) rec.set('active', true)

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error creating custom field def', 'error', err.message)
    return e.json(500, { error: 'Erro ao criar campo customizado' })
  }

  return e.json(200, {
    success: true,
    field: {
      id: rec.id,
      name: rec.getString('name'),
      field_type: rec.getString('field_type'),
      options: JSON.parse(rec.getString('options') || '[]'),
      sort_order: rec.getInt('sort_order') || 0,
      active: rec.getBool('active'),
    },
  })
}

var updateDefHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageCustomFieldDefs(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar campos customizados')
  }

  var defId = e.request.pathValue('id')
  if (!defId) return e.badRequestError('ID do campo é obrigatório')

  var rec
  try {
    rec = $app.findRecordById('custom_field_defs', defId)
  } catch (_) {
    return e.notFoundError('Campo customizado não encontrado')
  }

  var body = e.requestInfo().body || {}
  var validation = validateCustomFieldDefPayload(body, true)
  if (validation) return e.badRequestError(validation.error)

  // Ao ativar um campo do tipo seleção, garantir que ele tenha opções
  if (body.active === true && rec.getString('field_type') === 'selecao') {
    var opts = JSON.parse(rec.getString('options') || '[]')
    if (body.options !== undefined && Array.isArray(body.options)) opts = body.options
    if (opts.length === 0) {
      return e.badRequestError('Campo de seleção precisa de ao menos uma opção')
    }
  }

  applyCustomFieldDefPayload(rec, body, null)

  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error updating custom field def', 'error', err.message)
    return e.json(500, { error: 'Erro ao atualizar campo customizado' })
  }

  return e.json(200, {
    success: true,
    field: {
      id: rec.id,
      name: rec.getString('name'),
      field_type: rec.getString('field_type'),
      options: JSON.parse(rec.getString('options') || '[]'),
      sort_order: rec.getInt('sort_order') || 0,
      active: rec.getBool('active'),
    },
  })
}

var deleteDefHandler = function (e) {
  var authRecord = e.auth
  if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
  if (!canManageCustomFieldDefs(authRecord)) {
    return e.forbiddenError('Sem permissão para gerenciar campos customizados')
  }

  var defId = e.request.pathValue('id')
  if (!defId) return e.badRequestError('ID do campo é obrigatório')

  var rec
  try {
    rec = $app.findRecordById('custom_field_defs', defId)
  } catch (_) {
    return e.notFoundError('Campo customizado não encontrado')
  }

  // Desativa em vez de excluir: preserva os valores já gravados nos chamados.
  rec.set('active', false)
  try {
    $app.save(rec)
  } catch (err) {
    $app.logger().error('Error deactivating custom field def', 'error', err.message)
    return e.json(500, { error: 'Erro ao desativar campo customizado' })
  }

  return e.json(200, { success: true, deactivated: true, id: rec.id })
}

routerAdd(
  'POST',
  '/backend/v1/tickets/custom-fields/definitions',
  createDefHandler,
  $apis.requireAuth(),
)
routerAdd(
  'PUT',
  '/backend/v1/tickets/custom-fields/definitions/{id}',
  updateDefHandler,
  $apis.requireAuth(),
)
routerAdd(
  'DELETE',
  '/backend/v1/tickets/custom-fields/definitions/{id}',
  deleteDefHandler,
  $apis.requireAuth(),
)

// ---- salvar valores por chamado ----
routerAdd(
  'PUT',
  '/backend/v1/tickets/{id}/custom-fields/values',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')

    var ticketId = e.request.pathValue('id')
    if (!ticketId) return e.badRequestError('ID do chamado é obrigatório')

    var ticket
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (_) {
      return e.notFoundError('Chamado não encontrado')
    }

    var body = e.requestInfo().body || {}
    var values = body.values
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return e.badRequestError('Envie "values" como objeto { field_id: valor }')
    }

    var defsCol
    try {
      defsCol = $app.findCollectionByNameOrId('custom_field_defs')
    } catch (_) {
      return e.json(500, { error: 'Coleção de campos customizados não encontrada' })
    }
    var valuesCol
    try {
      valuesCol = $app.findCollectionByNameOrId('custom_field_values')
    } catch (_) {
      return e.json(500, { error: 'Coleção de valores não encontrada' })
    }

    var savedCount = 0
    var fieldIds = []
    for (var key in values) {
      if (Object.prototype.hasOwnProperty.call(values, key)) fieldIds.push(key)
    }

    for (var f = 0; f < fieldIds.length; f++) {
      var fieldId = fieldIds[f]
      var value = values[fieldId]

      var def
      try {
        def = $app.findRecordById('custom_field_defs', fieldId)
      } catch (_) {
        continue
      }
      if (!def.getBool('active')) continue // campo inativo não aceita novos valores

      var fieldType = def.getString('field_type')

      var rec
      var existing = $app.findRecordsByFilter(
        'custom_field_values',
        'ticket = "' + ticketId + '" && field_id = "' + fieldId + '"',
        '',
        1,
        0,
      )
      var hasValue =
        value !== null && value !== undefined && value !== '' && value !== false ? true : false

      if (!hasValue) {
        // valor vazio: limpa o registro (os campos ficam null)
        if (existing.length > 0) {
          rec = existing[0]
          rec.set('value_text', '')
          rec.set('value_number', 0)
          rec.set('value_date', '')
          rec.set('value_bool', false)
          rec.set('created_by', authRecord.id)
          try {
            $app.save(rec)
            savedCount++
          } catch (err) {
            $app.logger().error('Error clearing custom field value', 'error', err.message)
          }
        }
        continue
      }

      if (existing.length > 0) {
        rec = existing[0]
      } else {
        rec = new Record(valuesCol)
        rec.set('ticket', ticketId)
        rec.set('field_id', fieldId)
      }
      rec.set('value_text', '')
      rec.set('value_number', 0)
      rec.set('value_date', '')
      rec.set('value_bool', false)

      if (fieldType === 'numero') {
        var num = Number(value)
        if (!Number.isFinite(num)) continue
        rec.set('value_number', num)
      } else if (fieldType === 'data') {
        var d = String(value)
        if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue
        rec.set('value_date', d.substring(0, 10) + ' 00:00:00.000Z')
      } else if (fieldType === 'sim_nao') {
        rec.set('value_bool', value === true || value === 'true' || value === 1)
      } else {
        // texto_curto, texto_longo, selecao
        var txt = String(value)
        if (fieldType === 'selecao') {
          var opts = JSON.parse(def.getString('options') || '[]')
          if (opts.indexOf(txt) === -1) continue // valor fora da lista de opções
        }
        if (txt.length > 8000) txt = txt.substring(0, 8000)
        rec.set('value_text', txt)
      }

      rec.set('created_by', authRecord.id)
      try {
        $app.save(rec)
        savedCount++
      } catch (err) {
        $app.logger().error('Error saving custom field value', 'error', err.message)
      }
    }

    // Histórico do chamado: registro legível na aba Histórico da ficha
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', ticketId)
      hist.set('user', authRecord.id)
      hist.set('action', 'Campos Customizados')
      hist.set('field', 'custom_fields')
      hist.set('old_value', '')
      hist.set('new_value', savedCount + ' campo(s) atualizado(s)')
      $app.save(hist)
    } catch (err) {
      $app.logger().error('Error recording custom fields history', 'error', err.message)
    }

    return e.json(200, { success: true, saved: savedCount })
  },
  $apis.requireAuth(),
)
