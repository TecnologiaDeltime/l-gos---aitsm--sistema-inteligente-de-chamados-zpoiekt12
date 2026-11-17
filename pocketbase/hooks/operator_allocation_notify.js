/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Notificação de Nova Alocação de Operador (Lógos AITSM / Skip Cloud)
// ----------------------------------------------------------------------------
// Quando um registro em operator_allocations é criado com active=true (ou um
// registro existente é reativado — active false→true), notifica o operador E
// o(s) supervisor(es) responsável(is):
//   (a) notificação in-app (coleção notifications, type 'Atribuição');
//   (b) e-mail ao operador via Central de Alertas (alert_key =
//       'operator_allocation_notify', criado DESLIGADO pela migração 0170);
//   (c) supervisor(es) do operador (role gestor, preferindo a mesma equipe;
//       fallback admins ativos): notificação in-app + e-mail via alert_key
//       'operator_allocation_notify_supervisor' (migração 0172, nasce
//       DESLIGADO), com mensagem "Seu operador {nome} foi alocado ao cliente
//       {empresa}. Tipo: … Recorrência… Vigência…".
// Supervisores vinculados (supervisor_team_links, migração 0173) entram
// SEMPRE. `team` do vínculo é relation → queues.id, então a checagem resolve
// a(s) equipe(s) do operador por DOIS caminhos e deduplica:
//   1. filas em que o operador é membro (queues.members ?= operatorId);
//   2. fila cujo NOME = users.team do operador (convenção do
//      ticket_auto_assign, que também casa queues.name com users.team).
// Anti-duplicidade: e-mails registrados em email_sent_logs (reference_id =
// allocation id + ':' + data do dia; do supervisor: + ':sup:'); notificação
// in-app verificada por usuário+title+data (uma por destinatário/dia/título).
// Módulo 100% autocontido (resiliente ao escopo isolado do Goja JSVM no PocketBase):
// TODA a lógica fica inline dentro de cada callback — nem funções top-level do
// arquivo, nem helpers publicados via globalThis (_g) são visíveis nos callbacks
// neste pool (padrão comprovado de ticket_created_client_email.js /
// ticket_approval_check.js).
// Sempre invoca e.next() para manter a cadeia de hooks.
// ============================================================================

// ---------------------------------------------------------------------------
// CALLBACK 1: criação de alocação
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess(function (e) {
  try {
    var allocation = e.record
    if (!allocation) return e.next()
    if (!allocation.getBool('active')) return e.next()

    console.log(
      '[ALOC_OPERATOR] criação ativa detectada (id=' + allocation.id + ') — notificando operador',
    )

    var operatorId = allocation.getString('operator')
    var companyId = allocation.getString('company')
    var unitId = allocation.getString('unit') || ''

    if (!operatorId || !companyId) {
      console.warn('[ALOC_OPERATOR] alocação sem operador ou cliente — nada a fazer')
      return e.next()
    }

    var operatorName = ''
    var operatorEmail = ''
    var operatorTeam = ''
    try {
      var op = $app.findRecordById('users', operatorId)
      operatorName = op.getString('name') || 'Operador'
      operatorEmail = (op.getString('email') || '').trim()
      operatorTeam = (op.getString('team') || '').trim()
    } catch (errOp) {
      console.warn(
        '[ALOC_OPERATOR] operador não encontrado (' +
          (errOp && errOp.message ? errOp.message : String(errOp)) +
          ')',
      )
    }

    var companyName = ''
    try {
      var comp = $app.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var unitName = ''
    if (unitId) {
      try {
        var unitRec = $app.findRecordById('company_units', unitId)
        unitName = unitRec.getString('name') || ''
      } catch (_) {}
    }

    var allocationType = allocation.getString('allocation_type') || 'permanente'
    var typeLabel =
      allocationType === 'permanente' ? 'Exclusiva / Permanente' : 'Por Período (recorrência)'

    // Recorrência resumida (dias/semanas/meses), espelha formatRecurrence do frontend
    var recurrenceSummary = 'Exclusiva — sempre'
    if (allocationType === 'periodo') {
      recurrenceSummary = 'Todo o período da vigência'
      try {
        var recJson = allocation.getString('recurrence_json') || ''
        if (recJson) {
          var rec = JSON.parse(recJson)
          var parts = []
          var weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          var monthNames = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
          ]
          if (rec.days_of_week && rec.days_of_week.length > 0) {
            var sortedDays = rec.days_of_week.slice().sort(function (a, b) {
              return a - b
            })
            var dayLabels = []
            for (var dIdx = 0; dIdx < sortedDays.length; dIdx++) {
              dayLabels.push(weekdayLabels[sortedDays[dIdx]] || String(sortedDays[dIdx]))
            }
            parts.push('Dias: ' + dayLabels.join(', '))
          }
          if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
            var sortedWeeks = rec.weeks_of_month.slice().sort(function (a, b) {
              return a - b
            })
            parts.push('Semana(s): ' + sortedWeeks.join(', '))
          }
          if (rec.months && rec.months.length > 0) {
            var sortedMonths = rec.months.slice().sort(function (a, b) {
              return a - b
            })
            var monthLabels = []
            for (var mIdx = 0; mIdx < sortedMonths.length; mIdx++) {
              monthLabels.push(monthNames[sortedMonths[mIdx] - 1] || String(sortedMonths[mIdx]))
            }
            parts.push('Meses: ' + monthLabels.join(', '))
          }
          if (parts.length > 0) recurrenceSummary = parts.join(' · ')
        }
      } catch (_) {}
    }

    function localFormatDate(raw) {
      if (!raw) return ''
      var d = new Date(raw)
      if (isNaN(d.getTime())) return String(raw)
      return (
        ('0' + d.getDate()).slice(-2) +
        '/' +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        '/' +
        d.getFullYear()
      )
    }

    var vigenciaParts = []
    var startDate = allocation.getString('start_date') || ''
    var endDate = allocation.getString('end_date') || ''
    if (startDate) vigenciaParts.push('Início: ' + localFormatDate(startDate))
    if (endDate) vigenciaParts.push('Fim: ' + localFormatDate(endDate))
    var vigencia = vigenciaParts.length > 0 ? vigenciaParts.join(' | ') : 'Sem prazo definido'

    var notes = (allocation.getString('notes') || '').trim() || '—'
    var todayPrefix = new Date().toISOString().slice(0, 10)
    var notifTitle = 'Nova alocação: ' + (companyName || 'Cliente')

    // =======================================================================
    // (a) NOTIFICAÇÃO IN-APP (uma por operador/dia/título)
    // =======================================================================
    var alreadyNotified = false
    try {
      var cleanOpId = String(operatorId).replace(/"/g, '\\"')
      var cleanTitle = notifTitle.replace(/"/g, '\\"')
      var dupNotif = $app.findFirstRecordByFilter(
        'notifications',
        'user = "' +
          cleanOpId +
          '" && title = "' +
          cleanTitle +
          '" && created >= "' +
          todayPrefix +
          ' 00:00:00.000Z"',
      )
      alreadyNotified = !!dupNotif
    } catch (_) {}

    if (alreadyNotified) {
      console.log('[ALOC_OPERATOR] notificação in-app já existe hoje para este operador — pulada')
    } else {
      try {
        var notifsCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifsCol)
        notif.set('user', operatorId)
        notif.set('title', notifTitle)
        notif.set(
          'message',
          'Você foi alocado ao cliente ' +
            (companyName || 'Cliente') +
            (unitName ? ' (' + unitName + ')' : '') +
            '. Tipo: ' +
            typeLabel +
            '. Recorrência: ' +
            recurrenceSummary +
            '. Vigência: ' +
            vigencia +
            '.',
        )
        notif.set('type', 'Atribuição')
        notif.set('read', false)
        $app.save(notif)
        console.log('[ALOC_OPERATOR] notificação in-app criada para ' + operatorName)
      } catch (errN) {
        console.error(
          '[ALOC_OPERATOR] falha na notificação in-app: ' +
            (errN && errN.message ? errN.message : String(errN)),
        )
      }
    }

    // =======================================================================
    // (b) E-MAIL AO OPERADOR VIA CENTRAL DE ALERTAS (só com o alerta LIGADO)
    // Isolado em do/while: qualquer break aqui NÃO impede o bloco (c) do
    // supervisor (o alerta do operador nasce desligado e não pode travá-lo).
    // =======================================================================
    do {
      if (!operatorEmail) {
        console.warn('[ALOC_OPERATOR] operador sem e-mail — envio pulado')
        break
      }

      var templateData = {
        operador: operatorName,
        cliente: companyName || 'Cliente',
        unidade: unitName || '— (sede)',
        tipo_alocacao: typeLabel,
        recorrencia: recurrenceSummary,
        vigencia: vigencia,
        observacoes: notes,
      }

      var cfg = null
      try {
        cfg = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "operator_allocation_notify"',
        )
      } catch (errCfg) {
        console.error(
          '[ALOC_OPERATOR] falha ao ler email_alert_settings: ' +
            (errCfg && errCfg.message ? errCfg.message : String(errCfg)),
        )
      }

      if (!cfg) {
        console.error(
          '[ALOC_OPERATOR] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify)',
        )
        break
      }
      if (!cfg.getBool('enabled')) {
        console.log(
          '[ALOC_OPERATOR] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify)',
        )
        break
      }

      function localInterpolateTemplate(template, data) {
        if (!template) return ''
        var result = template
        if (data && typeof data === 'object') {
          var keys = Object.keys(data)
          for (var i = 0; i < keys.length; i++) {
            var val = data[keys[i]] == null ? '' : String(data[keys[i]])
            result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
          }
        }
        return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
      }

      function localHasEmailAlreadyBeenSent(referenceId, recipient) {
        if (!referenceId || !recipient) return false
        try {
          var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
          var rec = $app.findFirstRecordByFilter(
            'email_sent_logs',
            'alert_key = "operator_allocation_notify" && reference_id = "' +
              String(referenceId).trim().replace(/"/g, '\\"') +
              '" && recipient = "' +
              cleanRecipient +
              '"',
          )
          return !!rec
        } catch (_) {
          return false
        }
      }

      function localRecordEmailSentLog(referenceId, recipient, subject) {
        if (!referenceId || !recipient) return
        try {
          var col = $app.findCollectionByNameOrId('email_sent_logs')
          var log = new Record(col)
          log.set('alert_key', 'operator_allocation_notify')
          log.set('reference_id', String(referenceId).trim())
          log.set('recipient', String(recipient).trim().toLowerCase())
          log.set('sent_at', new Date().toISOString().replace('T', ' '))
          log.set('subject', subject || '')
          log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
          $app.save(log)
        } catch (errL) {
          console.warn(
            '[ALOC_OPERATOR] falha ao salvar email_sent_logs: ' +
              (errL && errL.message ? errL.message : String(errL)),
          )
        }
      }

      function localBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
        var primaryColor = cfg.getString('primary_color') || '#D97706'
        var headerTitle = cfg.getString('header_title') || 'Lógos AITSM'
        return (
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
          '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
          '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
          '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
          primaryColor +
          '; text-align: left;">' +
          '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
          headerTitle +
          '</span>' +
          (headerSubtitle
            ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
              headerSubtitle +
              '</p>'
            : '') +
          '</td></tr>' +
          '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
          bodyContent +
          '</td></tr>' +
          '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
          footerText +
          '</td></tr></table></body></html>'
        )
      }

      var bodyTemplate =
        cfg.getString('body_template') || cfg.getString('default_body_template') || ''
      var subjectTemplate =
        cfg.getString('subject_template') ||
        cfg.getString('default_subject_template') ||
        'Nova alocação: {{cliente}}'
      var headerSubtitle = cfg.getString('header_subtitle') || 'Central de Alocação de Operadores'
      var footerText =
        cfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente'

      var subject = localInterpolateTemplate(subjectTemplate, templateData)
      var bodyContent = localInterpolateTemplate(bodyTemplate, templateData)
      var htmlContent = localBuildEmailHtml(bodyContent, headerSubtitle, footerText)
      var textFallback = bodyContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      var referenceId = allocation.id + ':' + todayPrefix
      var recipient = operatorEmail.trim().toLowerCase()

      if (localHasEmailAlreadyBeenSent(referenceId, recipient)) {
        console.log(
          '[ALOC_OPERATOR] e-mail já enviado hoje para este operador — pulado (anti-duplicidade)',
        )
        break
      }

      try {
        var senderAddress = 'noreply@mail.goskip.dev'
        var senderName = 'Lógos AITSM'
        try {
          var s = $app.settings
          if (typeof s === 'function') s = s()
          if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
          if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
        } catch (_) {}

        var message = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: recipient }],
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })
        $app.newMailClient().send(message)
        localRecordEmailSentLog(referenceId, recipient, subject)
        console.log(
          '[ALOC_OPERATOR] e-mail enviado via Skip Cloud | destinatário=' +
            recipient +
            ' | assunto=' +
            subject,
        )
      } catch (errSend) {
        console.error(
          '[ALOC_OPERATOR] FALHA no envio Skip Cloud | destinatário=' +
            recipient +
            ' | motivo: ' +
            (errSend && errSend.message ? errSend.message : String(errSend)),
        )
      }
    } while (false)

    // =======================================================================
    // (c) SUPERVISOR(ES) — resolve supervisores do operador e notifica:
    //     in-app sempre; e-mail só com o alerta
    //     operator_allocation_notify_supervisor LIGADO (migração 0172).
    //     Ordem de resolução (dedupe por id):
    //       1. vínculos ativos em supervisor_team_links (team é relation →
    //          queues.id; a(s) equipe(s) do operador sai de queues.members
    //          e da fila cujo NOME = users.team);
    //       2. gestores da mesma users.team;
    //       3. TODOS os gestores ativos;
    //       4. fallback admins ativos (padrão change_approval_check).
    // =======================================================================
    var supervisors = []
    var supervisorIds = {}
    var teamInfo = 'sem equipe'
    try {
      var opTeam = (operatorTeam || '').trim()
      if (opTeam) teamInfo = 'users.team=' + opTeam

      var opQueueIds = []
      try {
        var opQueues = $app.findRecordsByFilter(
          'queues',
          'members ?= "' + String(operatorId).replace(/"/g, '\\"') + '"',
          '',
          0,
          0,
        )
        for (var qi = 0; qi < opQueues.length; qi++) {
          opQueueIds.push(opQueues[qi].id)
          if (opQueues[qi].getString('name')) {
            teamInfo = 'queues("' + opQueues[qi].getString('name') + '")'
          }
        }
      } catch (errQ) {
        console.warn(
          '[ALOC_SUP] falha ao resolver filas do operador: ' +
            (errQ && errQ.message ? errQ.message : String(errQ)),
        )
      }
      if (opTeam) {
        try {
          var qByName = $app.findFirstRecordByFilter(
            'queues',
            'name = "' + opTeam.replace(/"/g, '\\"') + '"',
          )
          if (qByName && opQueueIds.indexOf(qByName.id) === -1) opQueueIds.push(qByName.id)
        } catch (_) {}
      }

      var stlConds = []
      for (var oi = 0; oi < opQueueIds.length; oi++) {
        stlConds.push('team = "' + String(opQueueIds[oi]).replace(/"/g, '\\"') + '"')
      }
      var stlLinks = []
      if (stlConds.length > 0) {
        try {
          stlLinks = $app.findRecordsByFilter(
            'supervisor_team_links',
            '(' + stlConds.join(' || ') + ') && active = true',
            '',
            0,
            0,
          )
        } catch (errStl) {
          console.error(
            '[ALOC_SUP] falha ao consultar supervisor_team_links: ' +
              (errStl && errStl.message ? errStl.message : String(errStl)),
          )
        }
      }
      console.log(
        '[ALOC_SUP] equipe(s) do operador: ' +
          teamInfo +
          ' | vínculos ativos encontrados: ' +
          stlLinks.length,
      )

      for (var li = 0; li < stlLinks.length; li++) {
        var supIdLink = stlLinks[li].getString('supervisor') || ''
        if (!supIdLink) continue
        try {
          var supRecLink = $app.findRecordById('users', supIdLink)
          var supActive = supRecLink.getBool('active')
          var supRole = (supRecLink.getString('role') || '').toLowerCase()
          if (supRole === 'gestor' && supActive) {
            supervisors.push(supRecLink)
            supervisorIds[supIdLink] = true
          }
        } catch (errLinkUser) {
          console.error(
            '[ALOC_SUP] vínculo de equipe aponta para usuário inexistente (' +
              supIdLink +
              '): ' +
              (errLinkUser && errLinkUser.message ? errLinkUser.message : String(errLinkUser)),
          )
        }
      }
      console.log('[ALOC_SUP] supervisores vinculados incluídos: ' + supervisors.length)

      var gestores = $app.findRecordsByFilter('users', 'role = "gestor" && active = true', '', 0, 0)
      var sameTeam = []
      for (var gi = 0; gi < gestores.length; gi++) {
        var gTeam = (gestores[gi].getString('team') || '').trim()
        if (opTeam && gTeam && gTeam === opTeam) sameTeam.push(gestores[gi])
      }
      console.log(
        '[ALOC_SUP] gestores ativos: ' +
          gestores.length +
          ' | gestores da mesma equipe: ' +
          sameTeam.length,
      )
      for (var st = 0; st < sameTeam.length; st++) {
        if (!supervisorIds[sameTeam[st].id]) {
          supervisorIds[sameTeam[st].id] = true
          supervisors.push(sameTeam[st])
        }
      }
      if (supervisors.length === 0) {
        // Fallback da casa (padrão change_approval_check): sem supervisores/gestores → admins ativos
        var admins = $app.findRecordsByFilter('users', 'role = "admin" && active = true', '', 0, 0)
        for (var ai = 0; ai < admins.length; ai++) {
          var aId = admins[ai].id
          if (aId === operatorId) continue
          if (!supervisorIds[aId]) {
            supervisorIds[aId] = true
            supervisors.push(admins[ai])
          }
        }
      }
    } catch (errSupRes) {
      console.error(
        '[ALOC_SUP] falha ao resolver supervisores: ' +
          (errSupRes && errSupRes.message ? errSupRes.message : String(errSupRes)),
      )
    }

    if (supervisors.length === 0) {
      console.log(
        '[ALOC_SUP] nenhum supervisor/gestor aplicável — notificação ao supervisor pulada',
      )
    } else {
      var supNotifTitle = 'Alocação do seu operador: ' + (operatorName || 'Operador')
      var supMessage =
        'Seu operador ' +
        (operatorName || 'Operador') +
        ' foi alocado ao cliente ' +
        (companyName || 'Cliente') +
        (unitName ? ' (' + unitName + ')' : '') +
        '. Tipo: ' +
        typeLabel +
        '. Recorrência: ' +
        recurrenceSummary +
        '. Vigência: ' +
        vigencia +
        '.'

      // ---- (c.1) notificação in-app ao supervisor (uma por supervisor/dia/título) ----
      for (var ni = 0; ni < supervisors.length; ni++) {
        var supRec = supervisors[ni]
        var supName = supRec.getString('name') || 'Supervisor'
        var supDup = false
        try {
          var cleanSupId = String(supRec.id).replace(/"/g, '\\"')
          var cleanSupTitle = supNotifTitle.replace(/"/g, '\\"')
          supDup = !!$app.findFirstRecordByFilter(
            'notifications',
            'user = "' +
              cleanSupId +
              '" && title = "' +
              cleanSupTitle +
              '" && created >= "' +
              todayPrefix +
              ' 00:00:00.000Z"',
          )
        } catch (_) {}
        if (supDup) {
          console.log('[ALOC_SUP] notificação in-app já existe hoje para ' + supName + ' — pulada')
          continue
        }
        try {
          var notifsColSup = $app.findCollectionByNameOrId('notifications')
          var notifSup = new Record(notifsColSup)
          notifSup.set('user', supRec.id)
          notifSup.set('title', supNotifTitle)
          notifSup.set('message', supMessage)
          notifSup.set('type', 'Atribuição')
          notifSup.set('read', false)
          $app.save(notifSup)
          console.log('[ALOC_SUP] notificação in-app criada para supervisor ' + supName)
        } catch (errNSup) {
          console.error(
            '[ALOC_SUP] falha na notificação in-app (' +
              supName +
              '): ' +
              (errNSup && errNSup.message ? errNSup.message : String(errNSup)),
          )
        }
      }

      // ---- (c.2) e-mail ao supervisor via Central de Alertas (só com o alerta LIGADO) ----
      var supCfg = null
      try {
        supCfg = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "operator_allocation_notify_supervisor"',
        )
      } catch (errSupCfg) {
        console.error(
          '[ALOC_SUP] falha ao ler email_alert_settings: ' +
            (errSupCfg && errSupCfg.message ? errSupCfg.message : String(errSupCfg)),
        )
      }
      if (!supCfg) {
        console.error(
          '[ALOC_SUP] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify_supervisor)',
        )
      } else if (!supCfg.getBool('enabled')) {
        console.log(
          '[ALOC_SUP] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify_supervisor)',
        )
      } else {
        function supInterpolateTemplate(template, data) {
          if (!template) return ''
          var result = template
          if (data && typeof data === 'object') {
            var keys = Object.keys(data)
            for (var i = 0; i < keys.length; i++) {
              var val = data[keys[i]] == null ? '' : String(data[keys[i]])
              result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
            }
          }
          return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
        }

        function supHasEmailAlreadyBeenSent(referenceId, recipient) {
          if (!referenceId || !recipient) return false
          try {
            var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
            var rec = $app.findFirstRecordByFilter(
              'email_sent_logs',
              'alert_key = "operator_allocation_notify_supervisor" && reference_id = "' +
                String(referenceId).trim().replace(/"/g, '\\"') +
                '" && recipient = "' +
                cleanRecipient +
                '"',
            )
            return !!rec
          } catch (_) {
            return false
          }
        }

        function supRecordEmailSentLog(referenceId, recipient, subject) {
          if (!referenceId || !recipient) return
          try {
            var col = $app.findCollectionByNameOrId('email_sent_logs')
            var log = new Record(col)
            log.set('alert_key', 'operator_allocation_notify_supervisor')
            log.set('reference_id', String(referenceId).trim())
            log.set('recipient', String(recipient).trim().toLowerCase())
            log.set('sent_at', new Date().toISOString().replace('T', ' '))
            log.set('subject', subject || '')
            log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
            $app.save(log)
          } catch (errL) {
            console.warn(
              '[ALOC_SUP] falha ao salvar email_sent_logs: ' +
                (errL && errL.message ? errL.message : String(errL)),
            )
          }
        }

        function supBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
          var primaryColor = supCfg.getString('primary_color') || '#D97706'
          var headerTitle = supCfg.getString('header_title') || 'Lógos AITSM'
          return (
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
            '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
            '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
            '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
            primaryColor +
            '; text-align: left;">' +
            '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
            headerTitle +
            '</span>' +
            (headerSubtitle
              ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
                headerSubtitle +
                '</p>'
              : '') +
            '</td></tr>' +
            '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
            bodyContent +
            '</td></tr>' +
            '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
            footerText +
            '</td></tr></table></body></html>'
          )
        }

        for (var ei = 0; ei < supervisors.length; ei++) {
          var supMail = supervisors[ei]
          var supDisplayName = supMail.getString('name') || 'Supervisor'
          var supEmail = (supMail.getString('email') || '').trim().toLowerCase()
          if (!supEmail) {
            console.warn('[ALOC_SUP] supervisor sem e-mail — pulado: ' + supDisplayName)
            continue
          }

          var supTemplateData = {
            supervisor: supDisplayName,
            operador: operatorName,
            cliente: companyName || 'Cliente',
            unidade: unitName || '— (sede)',
            tipo_alocacao: typeLabel,
            recorrencia: recurrenceSummary,
            vigencia: vigencia,
            observacoes: notes,
          }

          var supSubjectTemplate =
            supCfg.getString('subject_template') ||
            supCfg.getString('default_subject_template') ||
            'Nova alocação de operador: {{operador}} alocado a {{cliente}}'
          var supBodyTemplate =
            supCfg.getString('body_template') || supCfg.getString('default_body_template') || ''
          var supSubject = supInterpolateTemplate(supSubjectTemplate, supTemplateData)
          var supBodyContent = supInterpolateTemplate(supBodyTemplate, supTemplateData)
          var supHtmlContent = supBuildEmailHtml(
            supBodyContent,
            supCfg.getString('header_subtitle') || 'Central de Alocação de Operadores',
            supCfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente',
          )
          var supTextFallback = supBodyContent
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          var supReferenceId = allocation.id + ':sup:' + todayPrefix

          if (supHasEmailAlreadyBeenSent(supReferenceId, supEmail)) {
            console.log(
              '[ALOC_SUP] e-mail já enviado hoje para ' +
                supDisplayName +
                ' — pulado (anti-duplicidade)',
            )
            continue
          }

          try {
            var supSenderAddress = 'noreply@mail.goskip.dev'
            var supSenderName = 'Lógos AITSM'
            try {
              var supSettings = $app.settings
              if (typeof supSettings === 'function') supSettings = supSettings()
              if (supSettings && supSettings.meta && supSettings.meta.senderAddress)
                supSenderAddress = supSettings.meta.senderAddress
              if (supSettings && supSettings.meta && supSettings.meta.senderName)
                supSenderName = supSettings.meta.senderName
            } catch (_) {}

            var supMessageMail = new MailerMessage({
              from: { address: supSenderAddress, name: supSenderName },
              to: [{ address: supEmail }],
              subject: supSubject,
              html: supHtmlContent,
              text: supTextFallback,
            })
            $app.newMailClient().send(supMessageMail)
            supRecordEmailSentLog(supReferenceId, supEmail, supSubject)
            console.log(
              '[ALOC_SUP] e-mail enviado via Skip Cloud | destinatário=' +
                supEmail +
                ' | assunto=' +
                supSubject,
            )
          } catch (errSupSend) {
            console.error(
              '[ALOC_SUP] FALHA no envio Skip Cloud | destinatário=' +
                supEmail +
                ' | motivo: ' +
                (errSupSend && errSupSend.message ? errSupSend.message : String(errSupSend)),
            )
          }
        }
      }
    }
  } catch (err) {
    console.error(
      '[ALOC_OPERATOR] FALHA inesperada (criação) | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'operator_allocations')

// ============================================================================
// AA1-TESTE-SUP-CRON — CRON DE TESTE EFÊMERO (VALIDAÇÃO v0.0.448) — EXCLUIR
// ============================================================================
cronAdd('aa1_test_sup_validate', '*/2 * * * *', function () {
  try {
    var runTag = 'AA1-SUP-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)

    // ---- Cenário A: vínculo ATIVO → gestor vinculado (y2zm8jbwe0o2jzr) recebe ----
    try {
      var linkCol = $app.findCollectionByNameOrId('supervisor_team_links')
      var link = $app.findFirstRecordByFilter('supervisor_team_links', 'id = "1utmkqu6hmsih1a"')
      if (!link) {
        link = new Record(linkCol)
      }
      link.set('supervisor', 'y2zm8jbwe0o2jzr')
      link.set('team', '63rmtcou2tswdml') // fila "Suporte N2" (users.team do operador teste)
      link.set('active', true)
      $app.save(link)
      console.log('[AA1_SUP_CRON] ' + runTag + ' vínculo ativo garantido (1utmkqu6hmsih1a)')

      // gestor vinculado precisa estar ativo e role=gestor
      var gVinc = $app.findRecordById('users', 'y2zm8jbwe0o2jzr')
      gVinc.set('active', true)
      gVinc.set('role', 'gestor')
      gVinc.set('team', 'Equipe Teste AA1')
      $app.save(gVinc)

      // reativa a alocação de teste (false→true dispara CALLBACK 2 do hook)
      var alloc = $app.findRecordById('operator_allocations', 'fgj14b1ajbbrw8d')
      alloc.set('active', false)
      $app.save(alloc)
      alloc.set('active', true)
      $app.save(alloc)
      console.log(
        '[AA1_SUP_CRON] ' + runTag + ' cenário A: vínculo ativo — alocação reativada (callback 2)',
      )
    } catch (errA) {
      console.error('[AA1_SUP_CRON] ' + runTag + ' erro cenário A: ' + String(errA))
    }

    // ---- Cenário B (roda só no minuto ímpar): vínculo INATIVO → fallback same-team ----
    var nowMin = new Date().getMinutes()
    if (nowMin % 2 === 1) {
      try {
        var link2 = $app.findFirstRecordByFilter('supervisor_team_links', 'id = "1utmkqu6hmsih1a"')
        link2.set('active', false)
        $app.save(link2)
        console.log('[AA1_SUP_CRON] ' + runTag + ' cenário B: vínculo DESATIVADO (fallback)')

        var alloc2 = $app.findRecordById('operator_allocations', 'fgj14b1ajbbrw8d')
        alloc2.set('active', false)
        $app.save(alloc2)
        alloc2.set('active', true)
        $app.save(alloc2)
        console.log('[AA1_SUP_CRON] ' + runTag + ' alocação reativada (callback 2, fallback)')
      } catch (errB) {
        console.error('[AA1_SUP_CRON] ' + runTag + ' erro cenário B: ' + String(errB))
      }
    }
  } catch (errG) {
    console.error('[AA1_SUP_CRON] erro geral: ' + String(errG))
  }
})
// ===== FIM AA1-TESTE-SUP-CRON =====

// ---------------------------------------------------------------------------
// CALLBACK 2: atualização — dispara SOMENTE na reativação (active false→true)
// (lógica 100% inline, idêntica ao callback 1, sem funções top-level)
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess(function (e) {
  var record = e.record
  if (!record) return e.next()

  var original = null
  try {
    original = record.original()
  } catch (_) {}
  if (!original) return e.next()

  var wasActive = original.getBool('active')
  var isActive = record.getBool('active')

  // Salvo sem mudança de estado (ou desativação) → nada a fazer (sem duplicidade)
  if (!(isActive && !wasActive)) return e.next()

  console.log('[ALOC_OPERATOR] reativação detectada (id=' + record.id + ') — notificando operador')

  try {
    var allocation = record
    var operatorId = allocation.getString('operator')
    var companyId = allocation.getString('company')
    var unitId = allocation.getString('unit') || ''

    if (!operatorId || !companyId) {
      console.warn('[ALOC_OPERATOR] alocação sem operador ou cliente — nada a fazer')
      return e.next()
    }

    var operatorName = ''
    var operatorEmail = ''
    var operatorTeam = ''
    try {
      var op = $app.findRecordById('users', operatorId)
      operatorName = op.getString('name') || 'Operador'
      operatorEmail = (op.getString('email') || '').trim()
      operatorTeam = (op.getString('team') || '').trim()
    } catch (_) {}

    var companyName = ''
    try {
      var comp = $app.findRecordById('companies', companyId)
      companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
    } catch (_) {}

    var unitName = ''
    if (unitId) {
      try {
        var unitRec = $app.findRecordById('company_units', unitId)
        unitName = unitRec.getString('name') || ''
      } catch (_) {}
    }

    var allocationType = allocation.getString('allocation_type') || 'permanente'
    var typeLabel =
      allocationType === 'permanente' ? 'Exclusiva / Permanente' : 'Por Período (recorrência)'

    var recurrenceSummary = 'Exclusiva — sempre'
    if (allocationType === 'periodo') {
      recurrenceSummary = 'Todo o período da vigência'
      try {
        var recJson = allocation.getString('recurrence_json') || ''
        if (recJson) {
          var rec = JSON.parse(recJson)
          var parts = []
          var weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          var monthNames = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
          ]
          if (rec.days_of_week && rec.days_of_week.length > 0) {
            var sortedDays = rec.days_of_week.slice().sort(function (a, b) {
              return a - b
            })
            var dayLabels = []
            for (var dIdx = 0; dIdx < sortedDays.length; dIdx++) {
              dayLabels.push(weekdayLabels[sortedDays[dIdx]] || String(sortedDays[dIdx]))
            }
            parts.push('Dias: ' + dayLabels.join(', '))
          }
          if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
            var sortedWeeks = rec.weeks_of_month.slice().sort(function (a, b) {
              return a - b
            })
            parts.push('Semana(s): ' + sortedWeeks.join(', '))
          }
          if (rec.months && rec.months.length > 0) {
            var sortedMonths = rec.months.slice().sort(function (a, b) {
              return a - b
            })
            var monthLabels = []
            for (var mIdx = 0; mIdx < sortedMonths.length; mIdx++) {
              monthLabels.push(monthNames[sortedMonths[mIdx] - 1] || String(sortedMonths[mIdx]))
            }
            parts.push('Meses: ' + monthLabels.join(', '))
          }
          if (parts.length > 0) recurrenceSummary = parts.join(' · ')
        }
      } catch (_) {}
    }

    function localFormatDate(raw) {
      if (!raw) return ''
      var d = new Date(raw)
      if (isNaN(d.getTime())) return String(raw)
      return (
        ('0' + d.getDate()).slice(-2) +
        '/' +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        '/' +
        d.getFullYear()
      )
    }

    var vigenciaParts = []
    var startDate = allocation.getString('start_date') || ''
    var endDate = allocation.getString('end_date') || ''
    if (startDate) vigenciaParts.push('Início: ' + localFormatDate(startDate))
    if (endDate) vigenciaParts.push('Fim: ' + localFormatDate(endDate))
    var vigencia = vigenciaParts.length > 0 ? vigenciaParts.join(' | ') : 'Sem prazo definido'

    var notes = (allocation.getString('notes') || '').trim() || '—'
    var todayPrefix = new Date().toISOString().slice(0, 10)
    var notifTitle = 'Nova alocação: ' + (companyName || 'Cliente')

    // ---- (a) notificação in-app (uma por operador/dia/título) ----
    var alreadyNotified = false
    try {
      var cleanOpId = String(operatorId).replace(/"/g, '\\"')
      var cleanTitle = notifTitle.replace(/"/g, '\\"')
      var dupNotif = $app.findFirstRecordByFilter(
        'notifications',
        'user = "' +
          cleanOpId +
          '" && title = "' +
          cleanTitle +
          '" && created >= "' +
          todayPrefix +
          ' 00:00:00.000Z"',
      )
      alreadyNotified = !!dupNotif
    } catch (_) {}

    if (alreadyNotified) {
      console.log('[ALOC_OPERATOR] notificação in-app já existe hoje para este operador — pulada')
    } else {
      try {
        var notifsCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifsCol)
        notif.set('user', operatorId)
        notif.set('title', notifTitle)
        notif.set(
          'message',
          'Você foi alocado ao cliente ' +
            (companyName || 'Cliente') +
            (unitName ? ' (' + unitName + ')' : '') +
            '. Tipo: ' +
            typeLabel +
            '. Recorrência: ' +
            recurrenceSummary +
            '. Vigência: ' +
            vigencia +
            '.',
        )
        notif.set('type', 'Atribuição')
        notif.set('read', false)
        $app.save(notif)
        console.log('[ALOC_OPERATOR] notificação in-app (reativação) criada para ' + operatorName)
      } catch (errN) {
        console.error(
          '[ALOC_OPERATOR] falha na notificação in-app (reativação): ' +
            (errN && errN.message ? errN.message : String(errN)),
        )
      }
    }

    // ---- (b) e-mail ao operador via Central de Alertas (só com o alerta LIGADO) ----
    do {
      if (!operatorEmail) {
        console.warn('[ALOC_OPERATOR] operador sem e-mail — envio pulado')
        break
      }

      var templateData = {
        operador: operatorName,
        cliente: companyName || 'Cliente',
        unidade: unitName || '— (sede)',
        tipo_alocacao: typeLabel,
        recorrencia: recurrenceSummary,
        vigencia: vigencia,
        observacoes: notes,
      }

      var cfg = null
      try {
        cfg = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "operator_allocation_notify"',
        )
      } catch (errCfg) {
        console.error(
          '[ALOC_OPERATOR] falha ao ler email_alert_settings: ' +
            (errCfg && errCfg.message ? errCfg.message : String(errCfg)),
        )
      }

      if (!cfg) {
        console.error(
          '[ALOC_OPERATOR] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify)',
        )
        break
      }
      if (!cfg.getBool('enabled')) {
        console.log(
          '[ALOC_OPERATOR] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify)',
        )
        break
      }

      function localInterpolateTemplate(template, data) {
        if (!template) return ''
        var result = template
        if (data && typeof data === 'object') {
          var keys = Object.keys(data)
          for (var i = 0; i < keys.length; i++) {
            var val = data[keys[i]] == null ? '' : String(data[keys[i]])
            result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
          }
        }
        return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
      }

      function localHasEmailAlreadyBeenSent(referenceId, recipient) {
        if (!referenceId || !recipient) return false
        try {
          var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
          var rec = $app.findFirstRecordByFilter(
            'email_sent_logs',
            'alert_key = "operator_allocation_notify" && reference_id = "' +
              String(referenceId).trim().replace(/"/g, '\\"') +
              '" && recipient = "' +
              cleanRecipient +
              '"',
          )
          return !!rec
        } catch (_) {
          return false
        }
      }

      function localRecordEmailSentLog(referenceId, recipient, subject) {
        if (!referenceId || !recipient) return
        try {
          var col = $app.findCollectionByNameOrId('email_sent_logs')
          var log = new Record(col)
          log.set('alert_key', 'operator_allocation_notify')
          log.set('reference_id', String(referenceId).trim())
          log.set('recipient', String(recipient).trim().toLowerCase())
          log.set('sent_at', new Date().toISOString().replace('T', ' '))
          log.set('subject', subject || '')
          log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
          $app.save(log)
        } catch (errL) {
          console.warn(
            '[ALOC_OPERATOR] falha ao salvar email_sent_logs: ' +
              (errL && errL.message ? errL.message : String(errL)),
          )
        }
      }

      function localBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
        var primaryColor = cfg.getString('primary_color') || '#D97706'
        var headerTitle = cfg.getString('header_title') || 'Lógos AITSM'
        return (
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
          '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
          '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
          '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
          primaryColor +
          '; text-align: left;">' +
          '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
          headerTitle +
          '</span>' +
          (headerSubtitle
            ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
              headerSubtitle +
              '</p>'
            : '') +
          '</td></tr>' +
          '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
          bodyContent +
          '</td></tr>' +
          '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
          footerText +
          '</td></tr></table></body></html>'
        )
      }

      var bodyTemplate =
        cfg.getString('body_template') || cfg.getString('default_body_template') || ''
      var subjectTemplate =
        cfg.getString('subject_template') ||
        cfg.getString('default_subject_template') ||
        'Nova alocação: {{cliente}}'
      var headerSubtitle = cfg.getString('header_subtitle') || 'Central de Alocação de Operadores'
      var footerText =
        cfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente'

      var subject = localInterpolateTemplate(subjectTemplate, templateData)
      var bodyContent = localInterpolateTemplate(bodyTemplate, templateData)
      var htmlContent = localBuildEmailHtml(bodyContent, headerSubtitle, footerText)
      var textFallback = bodyContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      var referenceId = allocation.id + ':' + todayPrefix
      var recipient = operatorEmail.trim().toLowerCase()

      if (localHasEmailAlreadyBeenSent(referenceId, recipient)) {
        console.log(
          '[ALOC_OPERATOR] e-mail já enviado hoje para este operador — pulado (anti-duplicidade)',
        )
        break
      }

      try {
        var senderAddress = 'noreply@mail.goskip.dev'
        var senderName = 'Lógos AITSM'
        try {
          var s = $app.settings
          if (typeof s === 'function') s = s()
          if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
          if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
        } catch (_) {}

        var message = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: recipient }],
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })
        $app.newMailClient().send(message)
        localRecordEmailSentLog(referenceId, recipient, subject)
        console.log(
          '[ALOC_OPERATOR] e-mail enviado via Skip Cloud | destinatário=' +
            recipient +
            ' | assunto=' +
            subject,
        )
      } catch (errSend) {
        console.error(
          '[ALOC_OPERATOR] FALHA no envio Skip Cloud | destinatário=' +
            recipient +
            ' | motivo: ' +
            (errSend && errSend.message ? errSend.message : String(errSend)),
        )
      }
    } while (false)

    // =======================================================================
    // (c) SUPERVISOR(ES) — idêntico ao callback 1, 100% inline
    // =======================================================================
    var supervisors = []
    var supervisorIds = {}
    var teamInfo = 'sem equipe'
    try {
      var opTeam = (operatorTeam || '').trim()
      if (opTeam) teamInfo = 'users.team=' + opTeam

      var opQueueIds = []
      try {
        var opQueues = $app.findRecordsByFilter(
          'queues',
          'members ?= "' + String(operatorId).replace(/"/g, '\\"') + '"',
          '',
          0,
          0,
        )
        for (var qi = 0; qi < opQueues.length; qi++) {
          opQueueIds.push(opQueues[qi].id)
          if (opQueues[qi].getString('name')) {
            teamInfo = 'queues("' + opQueues[qi].getString('name') + '")'
          }
        }
      } catch (errQ) {
        console.warn(
          '[ALOC_SUP] falha ao resolver filas do operador: ' +
            (errQ && errQ.message ? errQ.message : String(errQ)),
        )
      }
      if (opTeam) {
        try {
          var qByName = $app.findFirstRecordByFilter(
            'queues',
            'name = "' + opTeam.replace(/\"/g, '\\\"') + '"',
          )
          if (qByName && opQueueIds.indexOf(qByName.id) === -1) opQueueIds.push(qByName.id)
        } catch (_) {}
      }

      var stlConds = []
      for (var oi = 0; oi < opQueueIds.length; oi++) {
        stlConds.push('team = "' + String(opQueueIds[oi]).replace(/"/g, '\\"') + '"')
      }
      var stlLinks = []
      if (stlConds.length > 0) {
        try {
          stlLinks = $app.findRecordsByFilter(
            'supervisor_team_links',
            '(' + stlConds.join(' || ') + ') && active = true',
            '',
            0,
            0,
          )
        } catch (errStl) {
          console.error(
            '[ALOC_SUP] falha ao consultar supervisor_team_links: ' +
              (errStl && errStl.message ? errStl.message : String(errStl)),
          )
        }
      }
      console.log(
        '[ALOC_SUP] equipe(s) do operador: ' +
          teamInfo +
          ' | vínculos ativos encontrados: ' +
          stlLinks.length,
      )

      for (var li = 0; li < stlLinks.length; li++) {
        var supIdLink = stlLinks[li].getString('supervisor') || ''
        if (!supIdLink) continue
        try {
          var supRecLink = $app.findRecordById('users', supIdLink)
          var supActive = supRecLink.getBool('active')
          var supRole = (supRecLink.getString('role') || '').toLowerCase()
          if (supRole === 'gestor' && supActive) {
            supervisors.push(supRecLink)
            supervisorIds[supIdLink] = true
          }
        } catch (errLinkUser) {
          console.error(
            '[ALOC_SUP] vínculo de equipe aponta para usuário inexistente (' +
              supIdLink +
              '): ' +
              (errLinkUser && errLinkUser.message ? errLinkUser.message : String(errLinkUser)),
          )
        }
      }
      console.log('[ALOC_SUP] supervisores vinculados incluídos: ' + supervisors.length)

      var gestores = $app.findRecordsByFilter('users', 'role = "gestor" && active = true', '', 0, 0)
      var sameTeam = []
      for (var gi = 0; gi < gestores.length; gi++) {
        var gTeam = (gestores[gi].getString('team') || '').trim()
        if (opTeam && gTeam && gTeam === opTeam) sameTeam.push(gestores[gi])
      }
      console.log(
        '[ALOC_SUP] gestores ativos: ' +
          gestores.length +
          ' | gestores da mesma equipe: ' +
          sameTeam.length,
      )
      for (var st = 0; st < sameTeam.length; st++) {
        if (!supervisorIds[sameTeam[st].id]) {
          supervisorIds[sameTeam[st].id] = true
          supervisors.push(sameTeam[st])
        }
      }
      if (supervisors.length === 0) {
        // Fallback da casa (padrão change_approval_check): sem supervisores/gestores → admins ativos
        var admins = $app.findRecordsByFilter('users', 'role = "admin" && active = true', '', 0, 0)
        for (var ai = 0; ai < admins.length; ai++) {
          var aId = admins[ai].id
          if (aId === operatorId) continue
          if (!supervisorIds[aId]) {
            supervisorIds[aId] = true
            supervisors.push(admins[ai])
          }
        }
      }
    } catch (errSupRes) {
      console.error(
        '[ALOC_SUP] falha ao resolver supervisores: ' +
          (errSupRes && errSupRes.message ? errSupRes.message : String(errSupRes)),
      )
    }

    if (supervisors.length === 0) {
      console.log(
        '[ALOC_SUP] nenhum supervisor/gestor aplicável — notificação ao supervisor pulada',
      )
    } else {
      var supNotifTitle = 'Alocação do seu operador: ' + (operatorName || 'Operador')
      var supMessage =
        'Seu operador ' +
        (operatorName || 'Operador') +
        ' foi alocado ao cliente ' +
        (companyName || 'Cliente') +
        (unitName ? ' (' + unitName + ')' : '') +
        '. Tipo: ' +
        typeLabel +
        '. Recorrência: ' +
        recurrenceSummary +
        '. Vigência: ' +
        vigencia +
        '.'

      // ---- (c.1) notificação in-app ao supervisor (uma por supervisor/dia/título) ----
      for (var ni = 0; ni < supervisors.length; ni++) {
        var supRec = supervisors[ni]
        var supName = supRec.getString('name') || 'Supervisor'
        var supDup = false
        try {
          var cleanSupId = String(supRec.id).replace(/"/g, '\\"')
          var cleanSupTitle = supNotifTitle.replace(/"/g, '\\"')
          supDup = !!$app.findFirstRecordByFilter(
            'notifications',
            'user = "' +
              cleanSupId +
              '" && title = "' +
              cleanSupTitle +
              '" && created >= "' +
              todayPrefix +
              ' 00:00:00.000Z"',
          )
        } catch (_) {}
        if (supDup) {
          console.log('[ALOC_SUP] notificação in-app já existe hoje para ' + supName + ' — pulada')
          continue
        }
        try {
          var notifsColSup = $app.findCollectionByNameOrId('notifications')
          var notifSup = new Record(notifsColSup)
          notifSup.set('user', supRec.id)
          notifSup.set('title', supNotifTitle)
          notifSup.set('message', supMessage)
          notifSup.set('type', 'Atribuição')
          notifSup.set('read', false)
          $app.save(notifSup)
          console.log(
            '[ALOC_SUP] notificação in-app (reativação) criada para supervisor ' + supName,
          )
        } catch (errNSup) {
          console.error(
            '[ALOC_SUP] falha na notificação in-app (reativação, ' +
              supName +
              '): ' +
              (errNSup && errNSup.message ? errNSup.message : String(errNSup)),
          )
        }
      }

      // ---- (c.2) e-mail ao supervisor via Central de Alertas (só com o alerta LIGADO) ----
      var supCfg = null
      try {
        supCfg = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "operator_allocation_notify_supervisor"',
        )
      } catch (errSupCfg) {
        console.error(
          '[ALOC_SUP] falha ao ler email_alert_settings: ' +
            (errSupCfg && errSupCfg.message ? errSupCfg.message : String(errSupCfg)),
        )
      }
      if (!supCfg) {
        console.error(
          '[ALOC_SUP] e-mail ABORTADO — configuração do alerta não encontrada (alert_key=operator_allocation_notify_supervisor)',
        )
      } else if (!supCfg.getBool('enabled')) {
        console.log(
          '[ALOC_SUP] e-mail PULADO — alerta DESLIGADO na Central de Alertas (operator_allocation_notify_supervisor)',
        )
      } else {
        function supInterpolateTemplate(template, data) {
          if (!template) return ''
          var result = template
          if (data && typeof data === 'object') {
            var keys = Object.keys(data)
            for (var i = 0; i < keys.length; i++) {
              var val = data[keys[i]] == null ? '' : String(data[keys[i]])
              result = result.replace(new RegExp('\\{\\{\\s*' + keys[i] + '\\s*\\}\\}', 'gi'), val)
            }
          }
          return result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
        }

        function supHasEmailAlreadyBeenSent(referenceId, recipient) {
          if (!referenceId || !recipient) return false
          try {
            var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')
            var rec = $app.findFirstRecordByFilter(
              'email_sent_logs',
              'alert_key = "operator_allocation_notify_supervisor" && reference_id = "' +
                String(referenceId).trim().replace(/"/g, '\\"') +
                '" && recipient = "' +
                cleanRecipient +
                '"',
            )
            return !!rec
          } catch (_) {
            return false
          }
        }

        function supRecordEmailSentLog(referenceId, recipient, subject) {
          if (!referenceId || !recipient) return
          try {
            var col = $app.findCollectionByNameOrId('email_sent_logs')
            var log = new Record(col)
            log.set('alert_key', 'operator_allocation_notify_supervisor')
            log.set('reference_id', String(referenceId).trim())
            log.set('recipient', String(recipient).trim().toLowerCase())
            log.set('sent_at', new Date().toISOString().replace('T', ' '))
            log.set('subject', subject || '')
            log.set('meta', JSON.stringify({ transport: 'skip_cloud' }))
            $app.save(log)
          } catch (errL) {
            console.warn(
              '[ALOC_SUP] falha ao salvar email_sent_logs: ' +
                (errL && errL.message ? errL.message : String(errL)),
            )
          }
        }

        function supBuildEmailHtml(bodyContent, headerSubtitle, footerText) {
          var primaryColor = supCfg.getString('primary_color') || '#D97706'
          var headerTitle = supCfg.getString('header_title') || 'Lógos AITSM'
          return (
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
            '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
            '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
            '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #262930 100%); border-bottom: 3px solid ' +
            primaryColor +
            '; text-align: left;">' +
            '<span style="font-size: 20px; font-weight: 800; color: #FCD34D; letter-spacing: -0.5px;">' +
            headerTitle +
            '</span>' +
            (headerSubtitle
              ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
                headerSubtitle +
                '</p>'
              : '') +
            '</td></tr>' +
            '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
            bodyContent +
            '</td></tr>' +
            '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
            footerText +
            '</td></tr></table></body></html>'
          )
        }

        for (var ei = 0; ei < supervisors.length; ei++) {
          var supMail = supervisors[ei]
          var supDisplayName = supMail.getString('name') || 'Supervisor'
          var supEmail = (supMail.getString('email') || '').trim().toLowerCase()
          if (!supEmail) {
            console.warn('[ALOC_SUP] supervisor sem e-mail — pulado: ' + supDisplayName)
            continue
          }

          var supTemplateData = {
            supervisor: supDisplayName,
            operador: operatorName,
            cliente: companyName || 'Cliente',
            unidade: unitName || '— (sede)',
            tipo_alocacao: typeLabel,
            recorrencia: recurrenceSummary,
            vigencia: vigencia,
            observacoes: notes,
          }

          var supSubjectTemplate =
            supCfg.getString('subject_template') ||
            supCfg.getString('default_subject_template') ||
            'Nova alocação de operador: {{operador}} alocado a {{cliente}}'
          var supBodyTemplate =
            supCfg.getString('body_template') || supCfg.getString('default_body_template') || ''
          var supSubject = supInterpolateTemplate(supSubjectTemplate, supTemplateData)
          var supBodyContent = supInterpolateTemplate(supBodyTemplate, supTemplateData)
          var supHtmlContent = supBuildEmailHtml(
            supBodyContent,
            supCfg.getString('header_subtitle') || 'Central de Alocação de Operadores',
            supCfg.getString('footer_text') || 'Lógos AITSM • Central de Serviços Inteligente',
          )
          var supTextFallback = supBodyContent
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          var supReferenceId = allocation.id + ':sup:' + todayPrefix

          if (supHasEmailAlreadyBeenSent(supReferenceId, supEmail)) {
            console.log(
              '[ALOC_SUP] e-mail já enviado hoje para ' +
                supDisplayName +
                ' — pulado (anti-duplicidade)',
            )
            continue
          }

          try {
            var supSenderAddress = 'noreply@mail.goskip.dev'
            var supSenderName = 'Lógos AITSM'
            try {
              var supSettings = $app.settings
              if (typeof supSettings === 'function') supSettings = supSettings()
              if (supSettings && supSettings.meta && supSettings.meta.senderAddress)
                supSenderAddress = supSettings.meta.senderAddress
              if (supSettings && supSettings.meta && supSettings.meta.senderName)
                supSenderName = supSettings.meta.senderName
            } catch (_) {}

            var supMessageMail = new MailerMessage({
              from: { address: supSenderAddress, name: supSenderName },
              to: [{ address: supEmail }],
              subject: supSubject,
              html: supHtmlContent,
              text: supTextFallback,
            })
            $app.newMailClient().send(supMessageMail)
            supRecordEmailSentLog(supReferenceId, supEmail, supSubject)
            console.log(
              '[ALOC_SUP] e-mail enviado via Skip Cloud | destinatário=' +
                supEmail +
                ' | assunto=' +
                supSubject,
            )
          } catch (errSupSend) {
            console.error(
              '[ALOC_SUP] FALHA no envio Skip Cloud | destinatário=' +
                supEmail +
                ' | motivo: ' +
                (errSupSend && errSupSend.message ? errSupSend.message : String(errSupSend)),
            )
          }
        }
      }
    }
  } catch (err) {
    console.error(
      '[ALOC_OPERATOR] FALHA inesperada (reativação) | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'operator_allocations')
