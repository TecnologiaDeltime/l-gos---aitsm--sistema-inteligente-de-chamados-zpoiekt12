/// <reference path="../pb_data/types.d.ts" />
/**
 * A1_sla_business_hours.js — helpers globais de contabilidade de SLA por expediente.
 * Empacotado em IIFE com publicação via globalThis (padrão A0_/brand_constants.js),
 * porque o PocketBase JSVM roda cada hook em um pool de VM separado: funções/variáveis
 * de topo de outro arquivo NÃO são visíveis dentro dos callbacks (onRecord*, cronAdd).
 *
 * Empresa operadora: coleção company_settings (registro único).
 * Formato business_hours (JSON):
 *   { "0": {enabled:false}, "1": {enabled:true,start:"09:00",end:"18:00"}, ... }  (0=domingo)
 * Formato holidays (JSON): [ {date:"2026-12-25", name:"Natal"} ]
 * Fuso: America/Sao_Paulo (campo timezone; vazio = America/Sao_Paulo, UTC-3 fixo).
 * Sem cadastro ou com expediente vazio => calendário contínuo 24x7 (comportamento atual).
 */
;(function () {
  var TZ_OFFSET_SAO_PAULO_MIN = -180 // UTC-3

  function bhGetCompanySettings() {
    try {
      var rows = $app.findRecordsByFilter('company_settings', 'id != ""', '', 1, 0)
      if (rows && rows.length > 0) return rows[0]
    } catch (_) {}
    return null
  }

  // "09:00" -> minutos desde 00:00; inválido => -1
  function bhParseHHMM(s) {
    if (!s) return -1
    var m = String(s)
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return -1
    var h = parseInt(m[1], 10)
    var mi = parseInt(m[2], 10)
    if (isNaN(h) || isNaN(mi) || h > 24 || mi > 59) return -1
    return h * 60 + mi
  }

  function bhParseJsonSafe(raw) {
    if (!raw) return null
    if (typeof raw === 'object') return raw
    try {
      return JSON.parse(raw)
    } catch (_) {
      return null
    }
  }

  function bhBuildWeek(businessHoursRaw) {
    var parsed = bhParseJsonSafe(businessHoursRaw)
    if (!parsed) return null
    var week = []
    for (var d = 0; d < 7; d++) {
      var day = parsed[String(d)] || parsed[d] || null
      var enabled = !!(day && (day.enabled === true || day.enabled === 'true'))
      var start = day ? bhParseHHMM(day.start) : -1
      var end = day ? bhParseHHMM(day.end) : -1
      var hasWindow = enabled && start >= 0 && end > start
      week.push({ enabled: hasWindow, start: hasWindow ? start : -1, end: hasWindow ? end : -1 })
    }
    // Sem nenhum dia com expediente válido => null (calendário contínuo)
    for (var k = 0; k < 7; k++) {
      if (week[k].enabled) return week
    }
    return null
  }

  function bhBuildHolidays(holidaysRaw) {
    var parsed = bhParseJsonSafe(holidaysRaw)
    if (!parsed || !parsed.length) return null
    var set = {}
    for (var i = 0; i < parsed.length; i++) {
      var item = parsed[i]
      if (!item) continue
      var dateStr = typeof item === 'string' ? item : String(item.date || '')
      var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) set[m[1] + '-' + m[2] + '-' + m[3]] = true
      else {
        // aceita "25/12" (recorrente, todo ano) — aplica ao ano da data avaliada
        var md = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/)
        if (md) set['*-' + ('0' + md[2]).slice(-2) + '-' + ('0' + md[1]).slice(-2)] = true
        else set[dateStr] = true
      }
    }
    var count = 0
    for (var key in set) {
      count++
    }
    return count > 0 ? set : null
  }

  function bhIsHoliday(holidays, utcMs, offsetMin) {
    if (!holidays) return false
    var localMs = utcMs + offsetMin * 60000
    var d = new Date(localMs)
    var y = d.getUTCFullYear()
    var mo = ('0' + (d.getUTCMonth() + 1)).slice(-2)
    var da = ('0' + d.getUTCDate()).slice(-2)
    var key = y + '-' + mo + '-' + da
    if (holidays[key]) return true
    if (holidays['*-' + mo + '-' + da]) return true
    return false
  }

  function bhWindowOnDate(week, holidays, dateKey, offsetMin) {
    var d = new Date(dateKey + 'T00:00:00Z') // âncora UTC do dia local
    var dow = d.getUTCDay()
    var day = week[dow]
    if (!day || !day.enabled) return null
    var dayUtcMs = d.getTime()
    if (bhIsHoliday(holidays, dayUtcMs - offsetMin * 60000, offsetMin)) return null
    var startUtcMs = dayUtcMs - offsetMin * 60000 + day.start * 60000
    var endUtcMs = dayUtcMs - offsetMin * 60000 + day.end * 60000
    return { start: new Date(startUtcMs), end: new Date(endUtcMs) }
  }

  /** Data local "YYYY-MM-DD" do instante (fuso da empresa operadora). */
  function bhLocalDateKey(utcMs, offsetMin) {
    var d = new Date(utcMs + offsetMin * 60000)
    return (
      d.getUTCFullYear() +
      '-' +
      ('0' + (d.getUTCMonth() + 1)).slice(-2) +
      '-' +
      ('0' + d.getUTCDate()).slice(-2)
    )
  }

  /**
   * Prazo por expediente: adiciona "minutes" de tempo-útil a partir de "fromMs" (UTC ms).
   * Fora do expediente o relógio fica parado (noite, folga semanal, feriado).
   * Retorna ISO string UTC.
   */
  function bhAddBusinessMinutes(fromMs, minutes, week, holidays, offsetMin) {
    var remaining = minutes
    // limite de segurança: varredura limitada (500 iterações)
    var guard = 0
    var cursorMs = fromMs
    var lastDateKey = bhLocalDateKey(cursorMs, offsetMin)
    var win = bhWindowOnDate(week, holidays, lastDateKey, offsetMin)

    while (remaining > 0 && guard < 500) {
      guard++
      if (!win) {
        // pula para o início do próximo dia com expediente
        cursorMs += 24 * 3600 * 1000
        var nk = bhLocalDateKey(cursorMs, offsetMin)
        if (nk === lastDateKey) {
          cursorMs += 6 * 3600 * 1000 // segurança anti-loop
          nk = bhLocalDateKey(cursorMs, offsetMin)
        }
        lastDateKey = nk
        win = bhWindowOnDate(week, holidays, lastDateKey, offsetMin)
        continue
      }
      if (cursorMs < win.start.getTime()) {
        cursorMs = win.start.getTime()
      }
      if (cursorMs >= win.end.getTime()) {
        // já passou do fim do expediente: avança um dia
        cursorMs += 24 * 3600 * 1000
        lastDateKey = bhLocalDateKey(cursorMs, offsetMin)
        win = bhWindowOnDate(week, holidays, lastDateKey, offsetMin)
        continue
      }
      var availableMin = Math.floor((win.end.getTime() - cursorMs) / 60000)
      if (availableMin >= remaining) {
        cursorMs = cursorMs + remaining * 60000
        remaining = 0
        break
      }
      remaining -= availableMin
      cursorMs = win.end.getTime()
      cursorMs += 24 * 3600 * 1000
      lastDateKey = bhLocalDateKey(cursorMs, offsetMin)
      win = bhWindowOnDate(week, holidays, lastDateKey, offsetMin)
    }

    // Aviso: se estourar o guard, retorna o cursor (prazo conservador)
    return new Date(cursorMs).toISOString()
  }

  /** O instante utcMs está dentro da janela de expediente? (usado pelo cron de recálculo) */
  function bhIsInBusinessWindow(utcMs, week, holidays, offsetMin) {
    var win = bhWindowOnDate(week, holidays, bhLocalDateKey(utcMs, offsetMin), offsetMin)
    if (!win) return false
    var ms = utcMs
    return ms >= win.start.getTime() && ms < win.end.getTime()
  }

  /**
   * Ponto de entrada usado pelos hooks:
   * retorna null quando NÃO há expediente configurado (usar calendário contínuo).
   */
  function bhComputeDeadline(fromMs, minutes, offsetMin) {
    if (!minutes || minutes <= 0) return null
    var cs = bhGetCompanySettings()
    if (!cs) return null
    var week = bhBuildWeek(cs.get('business_hours'))
    if (!week) return null
    var holidays = bhBuildHolidays(cs.get('holidays'))
    var tz = cs.getString('timezone') || ''
    if (tz && tz !== 'America/Sao_Paulo') {
      // fuso declarado diferente do suportado: usa o offset informado em horas (ex.: "-3")
      var offParsed = parseInt(tz, 10)
      if (!isNaN(offParsed)) offsetMin = offParsed * 60
    }
    return bhAddBusinessMinutes(fromMs, minutes, week, holidays, offsetMin)
  }

  // --- Publicação via globalThis (única ponte entre os pools de VM do JSVM) ---
  globalThis.bhComputeDeadline = bhComputeDeadline
  globalThis.bhIsInBusinessWindow = bhIsInBusinessWindow
  globalThis.bhBuildWeek = bhBuildWeek
  globalThis.bhBuildHolidays = bhBuildHolidays
  globalThis.bhGetCompanySettings = bhGetCompanySettings
  globalThis.TZ_OFFSET_SAO_PAULO_MIN = TZ_OFFSET_SAO_PAULO_MIN
  globalThis.slaBusinessHoursLoaded = true
})()
