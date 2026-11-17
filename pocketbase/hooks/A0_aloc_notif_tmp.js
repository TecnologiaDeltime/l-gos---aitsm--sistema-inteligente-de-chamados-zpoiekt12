/// <reference path="../pb_data/types.d.ts" />

// TEMPORÁRIO — validação do operator_allocation_notify + supervisor (REMOVER APÓS O TESTE)
// Run 1: cria NOVA alocação de teste (marca única por dia) → dispara hook de notificação
// Run 2: desativa (active=false) → mantém registro para histórico
// Marca de teste: notes contém 'TESTE-NOTIF-AUTO'

cronAdd('AA1_aloc_notif_tmp', '*/1 * * * *', function () {
  var MARKER = 'TESTE-NOTIF-AUTO-' + new Date().toISOString().slice(0, 10)
  var OPERATOR_ID = 'y76axlkjkx1nute' // operador teste (tecnico)
  var COMPANY_ID = '0j705kwwux2lf6n' // SEMPER ENERGIA

  var existing = null
  try {
    existing = $app.findFirstRecordByFilter(
      'operator_allocations',
      'notes ~ "' + MARKER + '"',
    )
  } catch (_) {}

  if (!existing) {
    try {
      var col = $app.findCollectionByNameOrId('operator_allocations')
      var rec = new Record(col)
      rec.set('operator', OPERATOR_ID)
      rec.set('company', COMPANY_ID)
      rec.set('allocation_type', 'permanente')
      rec.set('active', true)
      rec.set('notes', 'Alocação de teste ' + MARKER + ' — criada automaticamente na validação')
      $app.save(rec)
      console.log('[AA1_TMP] alocação de teste CRIADA (id=' + rec.id + ')')
    } catch (errC) {
      console.error('[AA1_TMP] falha ao criar alocação de teste: ' + (errC && errC.message ? errC.message : String(errC)))
    }
    return
  }

  if (existing.getBool('active')) {
    existing.set('active', false)
    $app.save(existing)
    console.log('[AA1_TMP] alocação de teste DESATIVADA (id=' + existing.id + ') — registro mantido')
  }
})
