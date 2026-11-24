/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Notificação de NOVA SUGESTÃO à gestão (Central de Alertas)
// ----------------------------------------------------------------------------
// Gatilho: onRecordCreate da coleção "suggestions" (Área de Sugestões, v0.0.541).
//
// PÚBLICO (requisito): todos os usuários ATIVOS com poder de gerenciar
// sugestões, EXCETO o próprio autor:
//   - role "admin" ou "gestor" (poder inerente, mesmo sem perfil/permissões);
//   - usuários de QUALQUER papel com o item granular suggestions_gerenciar
//     concedido no perfil (coleção profile_permissions), nível view/edit/configure;
//   - autor (por id e por e-mail) sempre excluído.
//
// NOTIFICAÇÃO IN-APP (sino): registro em "notifications" (type "Sistema"),
// sem depender de toggle — o sino é para quem gerencia, nasce junto.
//
// E-MAIL TRANSACIONAL: via Central de Alertas — helper sendSystemAlertEmail
// (A0_email_alert_helpers.js), alert_key "suggestion_created_notify", que só
// envia quando o alerta está LIGADO (toggle na Central de Alertas). O seed da
// configuração é a migração 0556 (nascendo DESLIGADO, convenção da casa).
//
// LIÇÕES DO PROJETO APLICADAS:
//   - JSVM: helpers usados dentro deste callback são declarados AQUI dentro do
//     escopo dele (nada de globalThis/_g — callbacks têm escopo próprio).
//   - Sem dígitos no slug do hook.
// ============================================================================

onRecordAfterCreateSuccess(function (e) {
  let record = null
  try {
    record = e.record
  } catch (_) {
    record = null
  }
  if (!record) return e.next()

  try {
    const collectionName = record.collection().name
    if (collectionName !== 'suggestions') return e.next()
  } catch (errCol) {
    console.error('[SUGGEST_NOTIFY] falha ao resolver coleção do registro: ' + String(errCol))
    return e.next()
  }

  const suggestionId = record.id

  // ---- Dados da sugestão -------------------------------------------------
  const title = (record.getString('title') || 'Sem título').trim()
  const category = (record.getString('category') || 'Sem categoria').trim()
  const rawDescription = (record.getString('description') || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const shortDescription =
    rawDescription.length > 300 ? rawDescription.slice(0, 297) + '...' : rawDescription
  const authorId = record.getString('author') || ''

  let authorName = 'Operador'
  let authorEmail = ''
  try {
    if (authorId) {
      const authorRec = $app.findRecordById('users', authorId)
      authorName = authorRec.getString('name') || 'Operador'
      authorEmail = (authorRec.getString('email') || '').trim().toLowerCase()
    }
  } catch (_) {
    // autor pode não existir mais — segue sem bloquear a notificação
  }

  console.log('[SUGGEST_NOTIFY] nova sugestão id=' + suggestionId + ' | autor=' + authorName)

  // ---- Resolvedor: quem gerencia sugestões -------------------------------
  function suggestResolveManagers() {
    const managers = []
    const seen = {}
    const add = (rec) => {
      if (!rec || seen[rec.id]) return
      if (!rec.getBool('active')) return
      if (rec.id === authorId) return // o autor nunca se notifica
      const email = (rec.getString('email') || '').trim().toLowerCase()
      if (rec.id === authorId || (authorEmail && email === authorEmail)) return
      seen[rec.id] = true
      managers.push(rec)
    }

    // (1) admin e gestor: poder inerente de gerenciar sugestões (uso atual do
    //     item suggestions_gerenciar na Área de Sugestões).
    try {
      const core = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', '', 0, 0)
      for (let i = 0; i < core.length; i++) add(core[i])
    } catch (errCore) {
      console.error(
        '[SUGGEST_NOTIFY] falha ao resolver admin/gestor: ' +
          (errCore && errCore.message ? errCore.message : String(errCore)),
      )
    }

    // (2) qualquer papel com o item granular concedido no perfil — cobre o
    //     perfil "qualidade" citado no requisito, sem hardcode.
    try {
      const grants = $app.findRecordsByFilter(
        'profile_permissions',
        'item_key = "suggestions_gerenciar" && granted = true',
        '',
        0,
        0,
      )
      const grantedProfileIds = {}
      for (let g = 0; g < grants.length; g++) {
        const pid = grants[g].getString('profile') || ''
        if (pid) grantedProfileIds[pid] = true
      }
      const profileIds = Object.keys(grantedProfileIds)
      if (profileIds.length > 0) {
        let filter = ''
        for (let p = 0; p < profileIds.length; p++) {
          const clean = profileIds[p].replace(/"/g, '\\"')
          filter = filter + (filter ? ' || ' : '') + 'profile_id = "' + clean + '"'
        }
        const withProfile = $app.findRecordsByFilter('users', filter, '', 0, 0)
        for (let w = 0; w < withProfile.length; w++) add(withProfile[w])
      }
    } catch (errGranular) {
      console.error(
        '[SUGGEST_NOTIFY] falha ao resolver sugestões_gerenciar (pode não existir ainda): ' +
          (errGranular && errGranular.message ? errGranular.message : String(errGranular)),
      )
    }

    return managers
  }

  const managers = suggestResolveManagers()
  console.log('[SUGGEST_NOTIFY] gestores elegíveis para notificação: ' + managers.length)

  if (managers.length === 0) {
    console.log('[SUGGEST_NOTIFY] nenhum destinatário elegível — notificação pulada')
    return e.next()
  }

  // ---- Título/mensagem da notificação in-app (sino) ----------------------
  const bellTitle = 'Nova sugestão: ' + title
  const bellMessage =
    'O operador ' + authorName + ' registrou a sugestão "' + title + '" (' + category + ').'

  // ---- (1) notificação in-app (sino) para cada gestor -------------------
  for (let ni = 0; ni < managers.length; ni++) {
    try {
      const notifCol = $app.findCollectionByNameOrId('notifications')
      const notif = new Record(notifCol)
      notif.set('user', managers[ni].id)
      notif.set('title', bellTitle)
      notif.set('message', bellMessage)
      notif.set('type', 'Sistema')
      notif.set('read', false)
      $app.save(notif)
    } catch (errNotif) {
      console.error(
        '[SUGGEST_NOTIFY] falha na notificação in-app para ' +
          (managers[ni].getString('name') || managers[ni].id) +
          ': ' +
          (errNotif && errNotif.message ? errNotif.message : String(errNotif)),
      )
    }
  }

  // ---- (2) e-mail transacional via Central de Alertas -------------------
  try {
    const baseUrl = getTicketBaseUrl()
    const templateData = {
      titulo: title,
      categoria: category,
      autor: authorName,
      descricao: shortDescription,
      data: formatTicketDate(new Date()),
      link: baseUrl ? baseUrl + '/suggestions' : '',
    }

    const recipients = []
    for (let mi = 0; mi < managers.length; mi++) {
      const email = (managers[mi].getString('email') || '').trim().toLowerCase()
      if (email) recipients.push(email)
    }

    if (recipients.length === 0) {
      console.warn('[SUGGEST_NOTIFY] nenhum gestor elegível tem e-mail — e-mail pulado')
    } else {
      const result = sendSystemAlertEmail({
        alert_key: 'suggestion_created_notify',
        reference_id: suggestionId,
        recipients: recipients,
        subject: 'Nova sugestão: ' + title,
        data: templateData,
      })
      console.log('[SUGGEST_NOTIFY] resultado do e-mail: ' + JSON.stringify(result))
    }
  } catch (errEmail) {
    console.error(
      '[SUGGEST_NOTIFY] falha no disparo de e-mail: ' +
        (errEmail && errEmail.message ? errEmail.message : String(errEmail)),
    )
  }

  return e.next()
}, 'suggestions')
