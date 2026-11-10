/// <reference path="../pb_data/types.d.ts" />
/**
 * Z95_sla_recalc_cron.js — cron de recálculo do SLA dos chamados abertos (a cada 30 min).
 * Fora do expediente da empresa operadora: marca sla_status "Pausado (Expediente)".
 * Dentro do expediente: retoma a contabilização (volta a "Dentro do Prazo" /
 * "Violado" conforme o prazo já gravado), sem tocar em prazos já consumidos.
 *
 * Toda lógica vive INLINE no callback do cronAdd ou via globalThis, porque o
 * PocketBase JSVM roda cada hook em um pool de VM separado — funções de topo de
 * outro arquivo não são visíveis aqui (regra do projeto; helpers em A1_sla_business_hours.js
 * são publicados via globalThis e consumidos como globalThis.bh*).
 */
cronAdd('sla-recalc-open-tickets', '*/30 * * * *', () => {
  try {
    // Sem cadastro de expediente => nada a pausar (calendário contínuo 24x7)
    var cs =
      typeof globalThis.bhGetCompanySettings === 'function'
        ? globalThis.bhGetCompanySettings()
        : null
    if (!cs) return

    var week = globalThis.bhBuildWeek(cs.get('business_hours'))
    if (!week) return

    var holidays = globalThis.bhBuildHolidays(cs.get('holidays'))
    var offsetMin = globalThis.TZ_OFFSET_SAO_PAULO_MIN
    var tz = cs.getString('timezone') || ''
    if (tz && tz !== 'America/Sao_Paulo') {
      var offParsed = parseInt(tz, 10)
      if (!isNaN(offParsed)) offsetMin = offParsed * 60
    }

    var open = $app.findRecordsByFilter(
      'tickets',
      "sla_paused != true && status != 'Resolvido' && status != 'Encerrado' && status != 'Cancelado' && sla_response_deadline != ''",
      '',
      0,
      0,
    )

    var now = new Date()
    var nowMs = now.getTime()
    var fixed = 0

    for (var i = 0; i < open.length; i++) {
      var t = open[i]
      var inWindow = globalThis.bhIsInBusinessWindow(nowMs, week, holidays, offsetMin)

      if (inWindow) {
        // Retomada: sai de "Pausado (Expediente)" e reavalia contra o prazo gravado
        if (t.getString('sla_status') === 'Pausado (Expediente)') {
          var dl = t.getString('sla_response_deadline')
          var dlMs = dl ? new Date(dl).getTime() : NaN
          var resumed = !isNaN(dlMs) && nowMs > dlMs ? 'Violado' : 'Dentro do Prazo'
          t.set('sla_status', resumed)
          try {
            $app.save(t)
            fixed++
          } catch (saveErr) {
            console.error('[SLA Expediente] falha ao retomar chamado ' + t.id, saveErr)
          }
        }
      } else {
        // Pausa por expediente: apenas chamados ainda sem primeira resposta/atribuição
        var status = t.getString('status') || ''
        var pausable =
          status === 'Novo' || status === 'Em Triagem' || status === 'Aguardando Atribuição'
        if (pausable && t.getString('sla_status') !== 'Pausado (Expediente)') {
          t.set('sla_status', 'Pausado (Expediente)')
          try {
            $app.save(t)
            fixed++
          } catch (saveErr2) {
            console.error('[SLA Expediente] falha ao pausar chamado ' + t.id, saveErr2)
          }
        }
      }
    }
    if (fixed > 0) {
      console.log('[SLA Expediente] recalculo periódico: ' + fixed + ' chamado(s) ajustado(s)')
    }
  } catch (err) {
    console.error('[SLA Expediente] erro no recálculo periódico:', err)
  }
})
