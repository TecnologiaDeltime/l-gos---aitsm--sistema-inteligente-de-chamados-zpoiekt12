/// <reference path="../pb_data/types.d.ts" />

/**
 * Cron job: Notificações de Prazo de Projetos (Lógos AITSM)
 *
 * Verifica em intervalo configurável (project_deadline_settings.check_interval_minutes):
 * - Projetos com target_date: aviso "próximo" (advance_days antes), aviso "no dia", aviso "vencido"
 * - Atividades (project_tasks) com due_date: os mesmos três tipos de aviso
 *
 * Destinatários:
 * - Projeto: manager do projeto + gestores/admins (configurável em notify_manager/notify_gestors)
 * - Atividade: responsável designado (assigned_to) + manager do projeto (notify_task_assignee)
 *
 * Anti-duplicidade: campo JSON 'deadline_alerts' em projects/project_tasks marca o aviso
 * enviado por tipo (proximo/dia/vencido) com a data de referência do prazo — se o prazo
 * mudar, as marcas são resetadas e os avisos reemitidos para a nova data.
 *
 * Permissão: só recebe notificação quem pertence a um perfil com a permissão
 * profile_permissions (projects / projects_list) concedida.
 */
cronAdd('project_deadline_notifications', '*/30 * * * *', function () {
  var cronTag = 'project_deadline_notifications'

  // ---------- Configurações ----------
  var settings = null
  try {
    settings = $app.findFirstRecordByFilter('project_deadline_settings', 'id != ""')
  } catch (_) {
    settings = null
  }
  if (!settings) {
    // Primeiro uso: cria o registro padrão
    try {
      var sCol = $app.findCollectionByNameOrId('project_deadline_settings')
      settings = new Record(sCol)
      settings.set('enabled', true)
      settings.set('check_interval_minutes', 60)
      settings.set('advance_days', 3)
      settings.set('notify_manager', true)
      settings.set('notify_gestors', true)
      settings.set('notify_task_assignee', true)
      settings.set('last_check_epoch_min', 0)
      $app.save(settings)
    } catch (err) {
      $app.logger().error(cronTag + ': failed to create default settings', 'error', err.message)
      return
    }
  }

  if (!settings.getBool('enabled')) return

  // ---------- Janela de execução (roda no máximo 1x por intervalo configurado) ----------
  var intervalMin = Math.max(5, Math.min(1440, settings.getInt('check_interval_minutes') || 60))
  var now = new Date()
  var nowEpochMin = Math.floor(now.getTime() / 60000)
  var lastCheck = settings.getInt('last_check_epoch_min') || 0
  if (nowEpochMin - lastCheck < intervalMin - 2) return

  try {
    settings.set('last_check_epoch_min', nowEpochMin)
    $app.save(settings)
  } catch (err) {
    $app.logger().error(cronTag + ': failed to save last_check', 'error', err.message)
    return
  }

  var advanceDays = Math.max(0, settings.getInt('advance_days') || 3)
  var notifyManager = settings.getBool('notify_manager')
  var notifyGestors = settings.getBool('notify_gestors')
  var notifyTaskAssignee = settings.getBool('notify_task_assignee')

  var notifCol = $app.findCollectionByNameOrId('notifications')

  // ---------- Cache de permissão (userId -> pode ver projetos?) ----------
  var permCache = {}
  function userCanSeeProjects(userId) {
    if (!userId) return false
    if (permCache[userId] !== undefined) return permCache[userId]
    var allowed = false
    try {
      var user = $app.findRecordById('users', userId)
      var profileId = user.getString('profile_id')
      if (profileId) {
        var perms = $app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "projects" && item_key = "projects_list" && granted = true',
          '',
          1,
          0,
        )
        allowed = perms.length > 0
      }
    } catch (_) {
      allowed = false
    }
    permCache[userId] = allowed
    return allowed
  }

  // ---------- Gestores/admins (candidatos a destinatários de projeto) ----------
  var gestorUsers = []
  try {
    gestorUsers = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', '', 0, 0)
  } catch (err) {
    $app.logger().error(cronTag + ': gestores query failed', 'error', err.message)
  }

  // ---------- Helpers ----------
  function startOfDayMs(d) {
    var dt = new Date(d)
    dt.setUTCHours(0, 0, 0, 0)
    return dt.getTime()
  }

  function getAlertMarks(record) {
    var raw = record.get('deadline_alerts')
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw !== '') {
      try {
        var parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      } catch (_) {}
    }
    return {}
  }

  function saveAlertMarks(record, marks, currentDeadlineIso) {
    record.set('deadline_alerts', {
      proximo: marks.proximo || '',
      dia: marks.dia || '',
      vencido: marks.vencido || '',
      deadline_ref: currentDeadlineIso || '',
    })
    try {
      $app.save(record)
    } catch (err) {
      $app
        .logger()
        .error(cronTag + ': failed to save alert marks', 'target', record.id, 'error', err.message)
    }
  }

  function pushNotification(userId, title, message) {
    try {
      var n = new Record(notifCol)
      n.set('user', userId)
      n.set('title', title)
      n.set('message', message)
      n.set('type', 'Sistema')
      n.set('read', false)
      $app.save(n)
    } catch (err) {
      $app
        .logger()
        .error(cronTag + ': failed to save notification', 'user', userId, 'error', err.message)
    }
  }

  /**
   * Processa um alvo (projeto ou atividade).
   * ctx: { id, kind ('projeto'|'atividade'), title, deadlineMs, deadlineIso,
   *        isActive, record, recipientsFn }
   */
  function processTarget(ctx) {
    if (!ctx.isActive) {
      // Alvo concluído/cancelado: limpa marcas (se voltar a ficar ativo, re-notifica)
      var marks0 = getAlertMarks(ctx.record)
      if (marks0.proximo || marks0.dia || marks0.vencido) {
        saveAlertMarks(ctx.record, {}, ctx.deadlineIso)
      }
      return
    }
    if (!ctx.deadlineMs || isNaN(ctx.deadlineMs)) return

    var marks = getAlertMarks(ctx.record)
    // Reset das marcas se o prazo mudou desde o último aviso
    var refRaw = marks.deadline_ref || ''
    if (refRaw && ctx.deadlineIso && refRaw !== ctx.deadlineIso) {
      marks = {}
    }

    var todayMs = startOfDayMs(now)
    var deadlineDayMs = startOfDayMs(ctx.deadlineMs)
    var diffDays = Math.round((deadlineDayMs - todayMs) / 86400000) // negativo = vencido

    var toSend = []
    if (diffDays < 0) {
      toSend.push('vencido')
    } else if (diffDays === 0) {
      toSend.push('dia')
    } else if (diffDays <= advanceDays) {
      toSend.push('proximo')
    }

    for (var k = 0; k < toSend.length; k++) {
      var alertType = toSend[k]
      if (marks[alertType] === ctx.deadlineIso) continue // já enviado nesta janela

      var recipients = ctx.recipientsFn()
      var dueLabel = new Date(ctx.deadlineDayMs || ctx.deadlineMs).toLocaleDateString('pt-BR')
      var sentTo = 0
      for (var r = 0; r < recipients.length; r++) {
        var rc = recipients[r]
        if (!rc || !rc.id) continue
        if (!userCanSeeProjects(rc.id)) continue // regra de permissão do módulo

        var title = ''
        var message = ''
        var entLabel = ctx.kind === 'projeto' ? 'Projeto' : 'Atividade'
        var entField = ctx.kind === 'projeto' ? 'prazo de conclusão' : 'prazo'
        if (alertType === 'proximo') {
          title = entLabel + ' próximo do prazo: ' + ctx.title
          message =
            'A ' +
            ctx.kind +
            ' "' +
            ctx.title +
            '" tem ' +
            entField +
            ' em ' +
            dueLabel +
            ' (faltam ' +
            diffDays +
            ' dia(s)).'
        } else if (alertType === 'dia') {
          title = entLabel + ' vence hoje: ' + ctx.title
          message =
            'A ' + ctx.kind + ' "' + ctx.title + '" tem ' + entField + ' HOJE (' + dueLabel + ').'
        } else {
          title = entLabel + ' com prazo vencido: ' + ctx.title
          message =
            'O ' +
            entField +
            ' da ' +
            ctx.kind +
            ' "' +
            ctx.title +
            '" venceu em ' +
            dueLabel +
            ' (' +
            Math.abs(diffDays) +
            ' dia(s) em atraso).'
        }
        pushNotification(rc.id, title, message)
        sentTo++
      }

      // Marca como enviado nesta janela (mesmo sem destinatários, evita reprocessar)
      marks[alertType] = ctx.deadlineIso
      if (sentTo > 0) {
        $app
          .logger()
          .info(
            cronTag + ': notification sent',
            'kind',
            ctx.kind,
            'target',
            ctx.id,
            'alert',
            alertType,
            'recipients',
            sentTo,
          )
      }
    }

    saveAlertMarks(ctx.record, marks, ctx.deadlineIso)
  }

  // ---------- 1. Projetos com prazo ----------
  var projects = []
  try {
    projects = $app.findRecordsByFilter('projects', 'target_date != ""', '', 0, 0)
  } catch (err) {
    $app.logger().error(cronTag + ': projects query failed', 'error', err.message)
  }

  for (var p = 0; p < projects.length; p++) {
    var proj = projects[p]
    var targetDateStr = proj.getString('target_date')
    if (!targetDateStr) continue
    var targetMs = new Date(targetDateStr).getTime()
    if (isNaN(targetMs)) continue

    var projStatus = proj.getString('status')
    var projManagerId = proj.getString('manager') || ''

    processTarget({
      id: proj.id,
      kind: 'projeto',
      title: proj.getString('name'),
      deadlineMs: targetMs,
      deadlineIso: targetDateStr,
      isActive: projStatus === 'active' || projStatus === 'planning',
      record: proj,
      recipientsFn: function () {
        var list = []
        var seen = {}
        if (notifyManager && projManagerId) {
          seen[projManagerId] = true
          list.push({ id: projManagerId })
        }
        if (notifyGestors) {
          for (var g = 0; g < gestorUsers.length; g++) {
            var gid = gestorUsers[g].id
            if (!seen[gid]) {
              seen[gid] = true
              list.push({ id: gid })
            }
          }
        }
        return list
      },
    })
  }

  // ---------- 2. Atividades com prazo ----------
  var tasks = []
  try {
    tasks = $app.findRecordsByFilter('project_tasks', 'due_date != ""', '', 0, 0)
  } catch (err) {
    $app.logger().error(cronTag + ': tasks query failed', 'error', err.message)
  }

  for (var t = 0; t < tasks.length; t++) {
    var task = tasks[t]
    var dueStr = task.getString('due_date')
    if (!dueStr) continue
    var dueMs = new Date(dueStr).getTime()
    if (isNaN(dueMs)) continue

    var taskStatus = task.getString('status')
    var assigneeId = task.getString('assigned_to') || ''
    var taskProjectId = task.getString('project') || ''
    var taskProjectManager = ''
    if (taskProjectId) {
      try {
        var tp = $app.findRecordById('projects', taskProjectId)
        taskProjectManager = tp.getString('manager') || ''
      } catch (_) {}
    }

    processTarget({
      id: task.id,
      kind: 'atividade',
      title: task.getString('title'),
      deadlineMs: dueMs,
      deadlineIso: dueStr,
      isActive: taskStatus !== 'done' && taskStatus !== 'cancelled',
      record: task,
      recipientsFn: function () {
        var list = []
        var seen = {}
        if (notifyTaskAssignee && assigneeId) {
          seen[assigneeId] = true
          list.push({ id: assigneeId })
        }
        if (taskProjectManager && !seen[taskProjectManager]) {
          seen[taskProjectManager] = true
          list.push({ id: taskProjectManager })
        }
        return list
      },
    })
  }
})
