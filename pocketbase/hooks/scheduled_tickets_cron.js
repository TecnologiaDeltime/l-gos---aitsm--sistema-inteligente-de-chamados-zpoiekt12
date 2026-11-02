// Cron: processa agendamentos de tickets (abertura programada, recorrência e aviso prévio)
// Executa a cada 5 minutos.
cronAdd('scheduled_tickets_cron', '*/5 * * * *', function () {
  var computePriorityFromMatrix = function (impact, urgency) {
    var matrix = {
      'Alto|Alta': 'Crítica',
      'Alto|Média': 'Alta',
      'Alto|Baixa': 'Média',
      'Médio|Alta': 'Alta',
      'Médio|Média': 'Média',
      'Médio|Baixa': 'Baixa',
      'Baixo|Alta': 'Média',
      'Baixo|Média': 'Baixa',
      'Baixo|Baixa': 'Baixa',
    }
    return matrix[(impact || 'Médio') + '|' + (urgency || 'Média')] || 'Média'
  }
  var now = new Date()
  var nowIso = now.toISOString()
  var nowMs = now.getTime()

  // =========================================================================
  // PARTE 1: AVISO PRÉVIO
  // Notificar responsável e criador pouco antes da abertura programada
  // =========================================================================
  try {
    var pendingNotice = $app.findRecordsByFilter(
      'scheduled_tickets',
      'status = "agendado" && notice_sent = false && advance_notice_minutes > 0 && scheduled_date > "' +
        nowIso +
        '"',
      'scheduled_date',
      100,
      0,
    )

    var notifCol = $app.findCollectionByNameOrId('notifications')

    for (var i = 0; i < pendingNotice.length; i++) {
      var item = pendingNotice[i]
      var schedDateStr = item.getString('scheduled_date')
      if (!schedDateStr) continue

      var schedDate = new Date(schedDateStr)
      var schedMs = schedDate.getTime()
      var noticeMin = item.getInt('advance_notice_minutes') || 0
      var noticeThresholdMs = schedMs - noticeMin * 60000

      // Se o momento atual já passou do threshold de aviso, dispara
      if (nowMs >= noticeThresholdMs) {
        var minutesRemaining = Math.max(1, Math.round((schedMs - nowMs) / 60000))
        var schedTitle = item.getString('title')
        var companyName = 'N/A'
        var companyId = item.getString('company')
        if (companyId) {
          try {
            var comp = $app.findRecordById('companies', companyId)
            companyName =
              comp.getString('trade_name') ||
              comp.getString('legal_name') ||
              comp.getString('name') ||
              'N/A'
          } catch (_) {}
        }

        // Destinatários: Criador do agendamento + Responsável atribuído
        var recipientUserIds = []
        var creatorId = item.getString('created_by')
        var assignedId = item.getString('assigned_to')

        if (creatorId && recipientUserIds.indexOf(creatorId) === -1) {
          recipientUserIds.push(creatorId)
        }
        if (assignedId && recipientUserIds.indexOf(assignedId) === -1) {
          recipientUserIds.push(assignedId)
        }

        // Formatação amigável da data programada
        var schedFormatted = schedDateStr.replace('T', ' ').substring(0, 16)

        // Enviar notificações in-app e e-mails para cada destinatário
        for (var u = 0; u < recipientUserIds.length; u++) {
          var uId = recipientUserIds[u]
          var userEmail = ''
          var userName = ''
          try {
            var uRec = $app.findRecordById('users', uId)
            userEmail = uRec.getString('email') || ''
            userName = uRec.getString('name') || uRec.getString('email') || 'Usuário'
          } catch (_) {}

          // 1. Notificação In-App (coleção `notifications`, type 'Alerta')
          try {
            var notif = new Record(notifCol)
            notif.set('user', uId)
            notif.set('title', '⏰ Chamado Programado em breve: ' + schedTitle)
            notif.set(
              'message',
              'O chamado programado "' +
                schedTitle +
                '" (Empresa: ' +
                companyName +
                ') está previsto para ser aberto em ~' +
                minutesRemaining +
                ' minutos (' +
                schedFormatted +
                ').',
            )
            notif.set('type', 'Alerta')
            notif.set('read', false)
            $app.save(notif)
          } catch (notifErr) {
            $app
              .logger()
              .error('scheduled_tickets_cron: in-app notice failed', 'error', notifErr.message)
          }

          // 2. E-mail via $app.newMailClient()
          if (userEmail) {
            try {
              var emailSubj = '⏰ Aviso Prévio: Abertura de Chamado Programado - ' + schedTitle
              var emailBody =
                'Olá ' +
                userName +
                ',\n\n' +
                'Este é um aviso prévio de que o seguinte chamado programado será aberto em breve:\n\n' +
                '• Título: ' +
                schedTitle +
                '\n' +
                '• Empresa: ' +
                companyName +
                '\n' +
                '• Data/Hora Programada: ' +
                schedFormatted +
                '\n' +
                '• Tempo restante estimado: ' +
                minutesRemaining +
                ' minuto(s)\n\n' +
                'O chamado será gerado automaticamente pelo sistema de Tickets Programados.\n\n' +
                'Atenciosamente,\n' +
                'Lógos ITSM'

              var mailMsg = new MailerMessage()
              mailMsg.from = { address: 'noreply@logositsm.com.br', name: 'Lógos ITSM' }
              mailMsg.to = [{ address: userEmail }]
              mailMsg.subject = emailSubj
              mailMsg.text = emailBody
              if (globalThis.sendSystemMailMessage) {
                globalThis.sendSystemMailMessage(mailMsg)
              } else {
                var mailer = $app.newMailClient()
                mailer.send(mailMsg)
              }
            } catch (mailErr) {
              $app
                .logger()
                .error('scheduled_tickets_cron: email notice failed', 'error', mailErr.message)
            }
          }
        }

        // Marcar aviso como enviado neste ciclo
        item.set('notice_sent', true)
        item.set('notice_sent_at', nowIso)
        $app.save(item)
      }
    }
  } catch (errPart1) {
    $app
      .logger()
      .error('scheduled_tickets_cron: error in part 1 (notices)', 'error', errPart1.message)
  }

  // =========================================================================
  // PARTE 2: ABERTURA DO TICKET PROGRAMADO E RECORRÊNCIA
  // Buscar agendamentos com status "agendado" e scheduled_date <= nowIso
  // =========================================================================
  try {
    var dueTickets = $app.findRecordsByFilter(
      'scheduled_tickets',
      'status = "agendado" && scheduled_date <= "' + nowIso + '"',
      'scheduled_date',
      100,
      0,
    )

    var ticketsCol = $app.findCollectionByNameOrId('tickets')
    var interactionsCol = $app.findCollectionByNameOrId('ticket_interactions')

    for (var j = 0; j < dueTickets.length; j++) {
      var sched = dueTickets[j]

      try {
        // Criar o ticket oficial
        var newTicket = new Record(ticketsCol)
        newTicket.set('title', sched.getString('title'))
        newTicket.set('description', sched.getString('description'))
        newTicket.set('company', sched.getString('company'))
        if (sched.getString('unit')) newTicket.set('unit', sched.getString('unit'))
        if (sched.getString('department'))
          newTicket.set('department', sched.getString('department'))
        if (sched.getString('contract')) newTicket.set('contract', sched.getString('contract'))
        newTicket.set('requester_name', sched.getString('requester_name'))
        if (sched.getString('requester_email'))
          newTicket.set('requester_email', sched.getString('requester_email'))
        if (sched.getString('requester_phone'))
          newTicket.set('requester_phone', sched.getString('requester_phone'))
        newTicket.set('type', sched.getString('type') || 'Incidente')
        if (sched.getString('category')) newTicket.set('category', sched.getString('category'))
        if (sched.getString('subcategory'))
          newTicket.set('subcategory', sched.getString('subcategory'))
        if (sched.getString('equipment')) newTicket.set('equipment', sched.getString('equipment'))
        if (sched.getString('queue')) newTicket.set('queue', sched.getString('queue'))
        if (sched.getString('assigned_to'))
          newTicket.set('assigned_to', sched.getString('assigned_to'))

        // Prioridade, urgência e impacto derivados da subcategoria (atividade) ou do agendamento
        var subCatId = sched.getString('subcategory')
        var finalImpact = sched.getString('impact') || 'Médio'
        var finalUrgency = sched.getString('urgency') || 'Média'
        var finalPriority = sched.getString('priority') || 'Média'

        if (subCatId) {
          try {
            var subCatRec = $app.findRecordById('tkt_categories', subCatId)
            var catImpact = subCatRec.getString('impact')
            var catUrgency = subCatRec.getString('urgency')
            var catPriority = subCatRec.getString('priority')
            if (catImpact) finalImpact = catImpact
            if (catUrgency) finalUrgency = catUrgency
            if (catPriority) {
              finalPriority = catPriority
            } else if (catImpact || catUrgency) {
              finalPriority = computePriorityFromMatrix(finalImpact, finalUrgency)
            }
          } catch (_) {}
        }

        newTicket.set('priority', finalPriority)
        newTicket.set('impact', finalImpact)
        newTicket.set('urgency', finalUrgency)
        newTicket.set('status', 'Novo')
        newTicket.set('source', 'Programado')

        $app.save(newTicket)

        // Registrar comentário interno automático de rastreabilidade
        try {
          var sysUserId = sched.getString('created_by') || sched.getString('assigned_to')
          if (!sysUserId) {
            try {
              var adminUser = $app.findFirstRecordByFilter(
                'users',
                'role = "admin"',
                'created',
                0,
                0,
              )
              if (adminUser) sysUserId = adminUser.id
            } catch (_) {}
          }

          var schedTypeDesc = 'Sem recorrência'
          var rType = sched.getString('recurrence_type') || 'none'
          if (rType === 'daily') schedTypeDesc = 'Recorrente diário'
          else if (rType === 'weekly') schedTypeDesc = 'Recorrente semanal'
          else if (rType === 'monthly') schedTypeDesc = 'Recorrente mensal'

          var inter = new Record(interactionsCol)
          inter.set('ticket', newTicket.id)
          if (sysUserId) inter.set('author', sysUserId)
          inter.set('type', 'Interno')
          inter.set('origin', 'Automático')
          inter.set(
            'content',
            '🤖 Chamado aberto automaticamente via Agendamento Programado (ID: ' +
              sched.id +
              ', Modo: ' +
              schedTypeDesc +
              ', Data programada: ' +
              sched.getString('scheduled_date') +
              ').',
          )
          $app.save(inter)
        } catch (interErr) {
          $app
            .logger()
            .error('scheduled_tickets_cron: trace interaction failed', 'error', interErr.message)
        }

        // Atualizar rastreio no registro de agendamento
        sched.set('last_executed_at', nowIso)
        sched.set('last_ticket_created', newTicket.id)
        sched.set('error_message', '')

        // =====================================================================
        // RECORRÊNCIA: calcular próxima ocorrência ou finalizar como processado
        // =====================================================================
        var recType = sched.getString('recurrence_type') || 'none'
        var recEndDateStr = sched.getString('recurrence_end_date')
        var recEndDate = recEndDateStr ? new Date(recEndDateStr) : null

        if (recType === 'none') {
          // Sem recorrência: finaliza o agendamento
          sched.set('status', 'processado')
        } else {
          // Base da próxima data: a partir da data que estava programada (para não derivar no horário de execução)
          var currentSchedDate = new Date(sched.getString('scheduled_date'))
          var nextDate = null

          if (recType === 'daily') {
            // Avança dia a dia até ser estritamente maior que agora
            var d = new Date(currentSchedDate.getTime())
            while (d.getTime() <= nowMs) {
              d.setDate(d.getDate() + 1)
            }
            nextDate = d
          } else if (recType === 'weekly') {
            // Dias permitidos (array de 0 a 6, ou 1 a 7). Suportar números [1,2,3,4,5] (seg a sex)
            // Convenção padrão JS: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
            var allowedDays = []
            try {
              var rawDays = sched.get('recurrence_days_of_week')
              if (rawDays && Array.isArray(rawDays)) {
                for (var k = 0; k < rawDays.length; k++) {
                  allowedDays.push(parseInt(rawDays[k], 10))
                }
              }
            } catch (_) {}

            if (allowedDays.length === 0) {
              // Se não configurou nenhum dia, avança 7 dias por default
              var w = new Date(currentSchedDate.getTime())
              while (w.getTime() <= nowMs) {
                w.setDate(w.getDate() + 7)
              }
              nextDate = w
            } else {
              var wIter = new Date(currentSchedDate.getTime())
              wIter.setDate(wIter.getDate() + 1) // Avança pelo menos 1 dia
              var maxLoops = 365
              while (maxLoops > 0) {
                maxLoops--
                var dayOfWeek = wIter.getDay() // 0=dom, 1=seg...
                if (allowedDays.indexOf(dayOfWeek) !== -1 && wIter.getTime() > nowMs) {
                  nextDate = wIter
                  break
                }
                wIter.setDate(wIter.getDate() + 1)
              }
            }
          } else if (recType === 'monthly') {
            // Recorrência mensal: dia do mês especificado (1 a 31), respeitando dias menores
            var targetDay = sched.getInt('recurrence_day_of_month') || currentSchedDate.getDate()
            var mYear = currentSchedDate.getFullYear()
            var mMonth = currentSchedDate.getMonth()
            var mHours = currentSchedDate.getHours()
            var mMinutes = currentSchedDate.getMinutes()
            var mSeconds = currentSchedDate.getSeconds()

            var mIter = null
            var mLoop = 0
            while (mLoop < 60) {
              mLoop++
              mMonth++ // Próximo mês
              if (mMonth > 11) {
                mMonth = 0
                mYear++
              }

              // Descobrir quantos dias tem o mês de destino
              // new Date(ano, mes + 1, 0).getDate() retorna o último dia do mês
              var daysInTargetMonth = new Date(mYear, mMonth + 1, 0).getDate()
              var actualDay = Math.min(targetDay, daysInTargetMonth)

              var candidate = new Date(mYear, mMonth, actualDay, mHours, mMinutes, mSeconds)
              if (candidate.getTime() > nowMs) {
                mIter = candidate
                break
              }
            }
            nextDate = mIter
          }

          // Verificar se a próxima data ultrapassou a data limite (se houver)
          if (nextDate && recEndDate && nextDate.getTime() > recEndDate.getTime()) {
            // Passou da data limite: finaliza o agendamento
            sched.set('status', 'processado')
          } else if (nextDate) {
            // Continua agendado para o próximo ciclo
            sched.set('scheduled_date', nextDate.toISOString())
            sched.set('status', 'agendado')
            // CRÍTICO: Resetar o flag de aviso prévio para o novo ciclo!
            sched.set('notice_sent', false)
            sched.set('notice_sent_at', '')
          } else {
            sched.set('status', 'processado')
          }
        }

        $app.save(sched)
        $app
          .logger()
          .info(
            'scheduled_tickets_cron: created ticket ' +
              newTicket.getString('number') +
              ' from schedule ' +
              sched.id,
          )
      } catch (ticketErr) {
        $app
          .logger()
          .error(
            'scheduled_tickets_cron: error executing schedule ' + sched.id,
            'error',
            ticketErr.message,
          )
        try {
          sched.set('status', 'erro')
          sched.set('error_message', ticketErr.message || 'Erro ao criar ticket')
          $app.save(sched)
        } catch (_) {}
      }
    }
  } catch (errPart2) {
    $app
      .logger()
      .error('scheduled_tickets_cron: error in part 2 (execution)', 'error', errPart2.message)
  }
})
