// ======================================================================
// A0_AA1_sup_test_cron.js — CRON TEMPORÁRIO DE VALIDAÇÃO (REMOVER!)
// Validação em runtime do recurso "Gerenciar equipes de supervisores"
// (supervisor_team_links, migração 0173, + hook operator_allocation_notify).
//
// DISCRIMINADOR: dois gestores de teste são criados; só um ("Gestor Vinculado
// AA1") é vinculado à fila 63rmtcou2tswdml via supervisor_team_links. Se o
// caminho do vínculo do hook operator_allocation_notify funcionar, SOMENTE o
// vinculado recebe a notificação in-app; se falhar, os DOIS recebem (via
// fallback dos gestores da mesma equipe / todos os gestores).
//
// Fase 1 (job AA1_sup_test_create, a cada minuto):
//   - cria 2 gestores de teste (role=gestor, active=true)
//   - cria vínculo de teste em supervisor_team_links (supervisor ↔ fila, active=true)
//   - cria alocação de teste em operator_allocations (operador y76axlkjkx1nute,
//     empresa SEMPER se existir, tipo permanente, active=true, marcador AA1-TESTE-SUP)
//
// Fase 2 (job AA1_sup_test_cleanup, a cada 2 minutos):
//   - só roda depois que a notificação "Alocação do seu operador: ..." existir
//     para o vinculado (evidência do fluxo nos logs)
//   - LIMPEZA padrão da casa: active=false no vínculo e na alocação (registros
//     mantidos para histórico, NUNCA excluir); gestores de teste active=false.
//
// Este arquivo é TEMPORÁRIO e deve ser removido da árvore após a validação.
// Padrão Goja: TODA a lógica inline nos callbacks (sem helpers top-level).
// ======================================================================

cronAdd('AA1_sup_test_create', '* * * * *', function () {
  var marker = 'AA1-TESTE-SUP'
  var queueId = '63rmtcou2tswdml'
  var operatorId = 'y76axlkjkx1nute'

  var firstOrNull = function (collection, filter) {
    try {
      return $app.findFirstRecordByFilter(collection, filter)
    } catch (_) {
      return null
    }
  }

  // guarda anti-duplicidade: alocação de teste já existe?
  if (firstOrNull('operator_allocations', 'notes ~ "' + marker + '"')) {
    console.log('[AA1-TEST] alocação de teste já existe — fase 1 pulada')
    return
  }

  var op = firstOrNull('users', 'id = "' + operatorId + '"')
  if (!op) {
    console.error('[AA1-TEST] operador de teste ' + operatorId + ' não encontrado')
    return
  }
  var opTeam = (op.getString('team') || '').trim()
  console.log(
    '[AA1-TEST] operador OK: ' + (op.getString('name') || op.id) + ' | team="' + opTeam + '"',
  )

  // empresa: SEMPER se existir; senão a primeira disponível (a empresa não
  // interfere na resolução de supervisores — só no texto da notificação)
  var company = firstOrNull('companies', 'trade_name ~ "SEMPER" || legal_name ~ "SEMPER"')
  if (!company) {
    var anyCompanies = []
    try {
      anyCompanies = $app.findRecordsByFilter('companies', 'id != ""', '-created', 1, 0)
    } catch (_) {}
    if (!anyCompanies.length) {
      console.error('[AA1-TEST] nenhuma empresa encontrada — alocação de teste NÃO criada')
      return
    }
    company = anyCompanies[0]
    console.log('[AA1-TEST] SEMPER não encontrada — usando outra empresa para o teste')
  } else {
    console.log('[AA1-TEST] empresa SEMPER encontrada: ' + company.id)
  }

  // ---- gestores de teste (discriminador) ----
  var usersCol = $app.findCollectionByNameOrId('users')

  var gestorVinc = firstOrNull('users', 'email = "aa1.gestor.vinculado@teste.local"')
  if (!gestorVinc) {
    gestorVinc = new Record(usersCol)
    gestorVinc.set('email', 'aa1.gestor.vinculado@teste.local')
    gestorVinc.set('password', 'Aa123456!x')
    gestorVinc.set('passwordConfirm', 'Aa123456!x')
    gestorVinc.set('verified', true)
    gestorVinc.set('name', 'Gestor Vinculado AA1')
    gestorVinc.set('role', 'gestor')
    gestorVinc.set('team', 'Equipe Teste AA1')
    gestorVinc.set('type', 'Interno')
    gestorVinc.set('active', true)
    $app.save(gestorVinc)
    console.log('[AA1-TEST] gestor de teste CRIADO (vinculado): ' + gestorVinc.id)
  }

  var gestorIsol = firstOrNull('users', 'email = "aa1.gestor.isolado@teste.local"')
  if (!gestorIsol) {
    gestorIsol = new Record(usersCol)
    gestorIsol.set('email', 'aa1.gestor.isolado@teste.local')
    gestorIsol.set('password', 'A4x9k2pQ!z')
    gestorIsol.set('passwordConfirm', 'A4x9k2pQ!z')
    gestorIsol.set('verified', true)
    gestorIsol.set('name', 'Gestor Isolado AA1')
    gestorIsol.set('role', 'gestor')
    gestorIsol.set('team', 'Equipe Isolada AA1')
    gestorIsol.set('type', 'Interno')
    gestorIsol.set('active', true)
    $app.save(gestorIsol)
    console.log('[AA1-TEST] gestor de teste CRIADO (isolado): ' + gestorIsol.id)
  }

  // ---- vínculo de teste: supervisor gestor ↔ fila (relation) ----
  var link = firstOrNull(
    'supervisor_team_links',
    'supervisor = "' + gestorVinc.id + '" && team = "' + queueId + '"',
  )
  if (link) {
    if (!link.getBool('active')) {
      link.set('active', true)
      $app.save(link)
      console.log('[AA1-TEST] vínculo de teste REATIVADO (id=' + link.id + ')')
    } else {
      console.log('[AA1-TEST] vínculo de teste já ativo (id=' + link.id + ')')
    }
  } else {
    var linksCol = $app.findCollectionByNameOrId('supervisor_team_links')
    var newLink = new Record(linksCol)
    newLink.set('supervisor', gestorVinc.id)
    newLink.set('team', queueId)
    newLink.set('active', true)
    $app.save(newLink)
    console.log('[AA1-TEST] vínculo de teste CRIADO (id=' + newLink.id + ')')
  }

  // ---- alocação de teste (dispara o hook operator_allocation_notify) ----
  var allocCol = $app.findCollectionByNameOrId('operator_allocations')
  var alloc = new Record(allocCol)
  alloc.set('operator', op.id)
  alloc.set('company', company.id)
  alloc.set('allocation_type', 'permanente')
  alloc.set('active', true)
  alloc.set('notes', marker + ' — alocação criada pelo cron temporário de validação')
  $app.save(alloc)
  console.log(
    '[AA1-TEST] alocação de teste CRIADA (id=' + alloc.id + ', empresa=' + company.id + ')',
  )
  console.log('[AA1-TEST] fase 1 concluída — aguardando [ALOC_SUP] e fase 2 de limpeza')
})

cronAdd('AA1_sup_test_cleanup', '*/2 * * * *', function () {
  var firstOrNull = function (collection, filter) {
    try {
      return $app.findFirstRecordByFilter(collection, filter)
    } catch (_) {
      return null
    }
  }

  // só limpa quando a evidência já existe: notificação in-app ao vinculado
  var vinc = firstOrNull('users', 'email = "aa1.gestor.vinculado@teste.local"')
  if (!vinc) return
  var notif = firstOrNull(
    'notifications',
    'user = "' + vinc.id + '" && title ~ "Alocação do seu operador"',
  )
  if (!notif) return
  console.log(
    '[AA1-TEST] notificação ao vinculado confirmada (id=' + notif.id + ') — iniciando limpeza',
  )

  // 1. alocações de teste → active=false (registros mantidos para histórico)
  try {
    var allocs = $app.findRecordsByFilter(
      'operator_allocations',
      'notes ~ "AA1-TESTE-SUP"',
      '',
      0,
      0,
    )
    for (var i = 0; i < allocs.length; i++) {
      if (allocs[i].getBool('active')) {
        allocs[i].set('active', false)
        $app.save(allocs[i])
        console.log('[AA1-TEST] alocação de teste DESATIVADA (id=' + allocs[i].id + ')')
      }
    }
  } catch (e1) {
    console.error(
      '[AA1-TEST] falha ao desativar alocações de teste: ' +
        (e1 && e1.message ? e1.message : String(e1)),
    )
  }

  // 2. vínculos de teste → active=false; gestores de teste → active=false
  var testEmails = ['aa1.gestor.vinculado@teste.local', 'aa1.gestor.isolado@teste.local']
  for (var j = 0; j < testEmails.length; j++) {
    var g = firstOrNull('users', 'email = "' + testEmails[j] + '"')
    if (!g) continue
    try {
      var links = $app.findRecordsByFilter(
        'supervisor_team_links',
        'supervisor = "' + g.id + '"',
        '',
        0,
        0,
      )
      for (var k = 0; k < links.length; k++) {
        if (links[k].getBool('active')) {
          links[k].set('active', false)
          $app.save(links[k])
          console.log('[AA1-TEST] vínculo de teste DESATIVADO (id=' + links[k].id + ')')
        }
      }
    } catch (e2) {
      console.error(
        '[AA1-TEST] falha ao desativar vínculos de teste: ' +
          (e2 && e2.message ? e2.message : String(e2)),
      )
    }
    if (g.getBool('active')) {
      g.set('active', false)
      $app.save(g)
      console.log('[AA1-TEST] gestor de teste DESATIVADO (id=' + g.id + ')')
    }
  }

  console.log('[AA1-TEST] limpeza concluída')
})
