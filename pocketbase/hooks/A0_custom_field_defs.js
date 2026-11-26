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
// Regras de validação dos valores (migração 0560): required, min_chars, max_chars,
// min_value, max_value — validadas AQUI no PUT de valores (segunda barreira além
// do card na ficha). 0/ausente = sem regra.
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
        required: r.getBool('required'),
        min_chars: r.getNumber('min_chars') || 0,
        max_chars: r.getNumber('max_chars') || 0,
        min_value: r.getNumber('min_value') || 0,
        max_value: r.getNumber('max_value') || 0,
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

  // Regras de validação (0/null = sem regra)
  var ruleNames = ['min_chars', 'max_chars', 'min_value', 'max_value']
  for (var ri = 0; ri < ruleNames.length; ri++) {
    var rn = ruleNames[ri]
    if (body[rn] !== undefined && body[rn] !== null && body[rn] !== '') {
      var rv = Number(body[rn])
      if (!Number.isFinite(rv) || rv < 0) {
        return { error: 'Regra de validação inválida (' + rn + ')' }
      }
    }
  }
  if (
    body.min_chars !== undefined &&
    body.min_chars !== null &&
    body.min_chars !== '' &&
    body.max_chars !== undefined &&
    body.max_chars !== null &&
    body.max_chars !== ''
  ) {
    var mnC = Number(body.min_chars)
    var mxC = Number(body.max_chars)
    if (mnC > mxC) {
      return { error: 'Mínimo de caracteres não pode ser maior que o máximo' }
    }
  }
  if (
    body.min_value !== undefined &&
    body.min_value !== null &&
    body.min_value !== '' &&
    body.max_value !== undefined &&
    body.max_value !== null &&
    body.max_value !== ''
  ) {
    var mnV = Number(body.min_value)
    var mxV = Number(body.max_value)
    if (mnV > mxV) {
      return { error: 'Valor mínimo não pode ser maior que o valor máximo' }
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
  // Regras de validação
  if (body.required !== undefined) record.set('required', !!body.required)
  var ruleNums = ['min_chars', 'max_chars', 'min_value', 'max_value']
  for (var ni = 0; ni < ruleNums.length; ni++) {
    var nn = ruleNums[ni]
    if (body[nn] !== undefined) {
      var nv = body[nn] === null || body[nn] === '' ? 0 : Number(body[nn])
      record.set(nn, Number.isFinite(nv) && nv > 0 ? nv : 0)
    }
  }
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
      required: rec.getBool('required'),
      min_chars: rec.getNumber('min_chars') || 0,
      max_chars: rec.getNumber('max_chars') || 0,
      min_value: rec.getNumber('min_value') || 0,
      max_value: rec.getNumber('max_value') || 0,
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
      required: rec.getBool('required'),
      min_chars: rec.getNumber('min_chars') || 0,
      max_chars: rec.getNumber('max_chars') || 0,
      min_value: rec.getNumber('min_value') || 0,
      max_value: rec.getNumber('max_value') || 0,
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

    var valuesCol
    try {
      valuesCol = $app.findCollectionByNameOrId('custom_field_values')
    } catch (_) {
      return e.json(500, { error: 'Coleção de valores não encontrada' })
    }

    // Definições ativas — mapa por id para as regras de validação.
    var activeDefs = $app.findRecordsByFilter('custom_field_defs', 'active = true', '', 0, 0)
    var defsById = {}
    for (var d = 0; d < activeDefs.length; d++) {
      defsById[activeDefs[d].id] = activeDefs[d]
    }

    // Segunda barreira: validação das regras ANTES de gravar qualquer valor.
    // 1) Obrigatórios: todo campo ativo marcado como required precisa de valor.
    for (var dr = 0; dr < activeDefs.length; dr++) {
      var defReq = activeDefs[dr]
      if (!defReq.getBool('required')) continue
      var rv = values[defReq.id]
      var hasRv = rv !== null && rv !== undefined && rv !== '' && rv !== false
      if (!hasRv) {
        return e.badRequestError('Campo "' + defReq.getString('name') + '" é obrigatório')
      }
    }
    // 2) Regras por campo enviado (caracteres/faixa numérica/opção da lista).
    var sentIds = []
    for (var k0 in values) {
      if (Object.prototype.hasOwnProperty.call(values, k0)) sentIds.push(k0)
    }
    for (var s = 0; s < sentIds.length; s++) {
      var fid = sentIds[s]
      var def = defsById[fid]
      if (!def) continue // campo inativo/desconhecido é ignorado abaixo
      if (!def.getBool('active')) continue
      var val = values[fid]
      if (val === null || val === undefined || val === '' || val === false) continue
      var fType = def.getString('field_type')
      if (fType === 'numero') {
        var num = Number(val)
        if (!Number.isFinite(num)) {
          return e.badRequestError(
            'Campo "' + def.getString('name') + '" deve ser um número válido',
          )
        }
        var mnV2 = def.getNumber('min_value') || 0
        var mxV2 = def.getNumber('max_value') || 0
        if ((mnV2 > 0 && num < mnV2) || (mxV2 > 0 && num > mxV2)) {
          var faixa
          if (mnV2 > 0 && mxV2 > 0) {
            faixa = 'Valor deve estar entre ' + mnV2 + ' e ' + mxV2
          } else if (mnV2 > 0) {
            faixa = 'Valor deve ser maior ou igual a ' + mnV2
          } else {
            faixa = 'Valor deve ser menor ou igual a ' + mxV2
          }
          return e.badRequestError('Campo "' + def.getString('name') + '": ' + faixa)
        }
      } else if (fType === 'texto_curto' || fType === 'texto_longo') {
        var txtV = String(val)
        var mnC2 = def.getNumber('min_chars') || 0
        var mxC2 = def.getNumber('max_chars') || 0
        if (mnC2 > 0 && txtV.length < mnC2) {
          return e.badRequestError(
            'Campo "' + def.getString('name') + '": Mínimo de ' + mnC2 + ' caracteres',
          )
        }
        if (mxC2 > 0 && txtV.length > mxC2) {
          return e.badRequestError(
            'Campo "' + def.getString('name') + '": Máximo de ' + mxC2 + ' caracteres',
          )
        }
      } else if (fType === 'selecao') {
        var optsV = JSON.parse(def.getString('options') || '[]')
        if (optsV.indexOf(String(val)) === -1) {
          return e.badRequestError(
            'Campo "' + def.getString('name') + '": escolha uma das opções da lista',
          )
        }
      }
    }

    var savedCount = 0
    var fieldIds = sentIds

    for (var f = 0; f < fieldIds.length; f++) {
      var fieldId = fieldIds[f]
      var value = values[fieldId]

      var defSave = defsById[fieldId]
      if (!defSave) continue // inativo ou inexistente: não aceita novos valores

      var fieldType = defSave.getString('field_type')

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
        var num2 = Number(value)
        if (!Number.isFinite(num2)) continue
        rec.set('value_number', num2)
      } else if (fieldType === 'data') {
        var d = String(value)
        if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue
        rec.set('value_date', d.substring(0, 10) + ' 00:00:00.000Z')
      } else if (fieldType === 'sim_nao') {
        rec.set('value_bool', value === true || value === 'true' || value === 1)
      } else {
        // texto_curto, texto_longo, selecao
        var txt = String(value)
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
