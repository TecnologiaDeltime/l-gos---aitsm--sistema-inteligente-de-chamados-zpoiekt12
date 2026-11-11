// pocketbase/migrations/0161_approval_flow_lock.js
// Lógos AITSM - Fluxo de aprovação de chamados (v0.0.418)
//
// 1. Campo 'approval_hold' (bool) na coleção 'tickets': quando verdadeiro,
//    o chamado fica travado na fila — a equipe não pode iniciar atendimento
//    até que o aprovador do portal aprove.
// 2. Catálogo de permissões: item 'portal_approvals_flow' (módulo portal) para
//    controlar quem decide aprovações no portal; concedido a perfis admin.
// 3. Alertas da Central de Alertas por E-mail:
//    - ticket_approval_hold: e-mail ao solicitante/contato informando que o
//      chamado necessita de aprovação antes da análise e execução.
//    - ticket_approval_request_internal: e-mail ao aprovador (ponto focal ou
//      interno) para entrar no portal e aprovar.

migrate(
  (app) => {
    // 1. Campo approval_hold em tickets
    try {
      var ticketsCol = app.findCollectionByNameOrId('tickets')
      var hasField = false
      for (var f = 0; f < ticketsCol.fields.length; f++) {
        if (ticketsCol.fields[f].name === 'approval_hold') {
          hasField = true
          break
        }
      }
      if (!hasField) {
        ticketsCol.fields.add(
          new Field({
            name: 'approval_hold',
            type: 'bool',
          }),
        )
        app.save(ticketsCol)
      }
    } catch (e) {
      app.logger().warn('0161: erro ao adicionar approval_hold em tickets', 'error', e.message)
    }

    // 2. Permissão portal_approvals_flow para perfis administrativos
    try {
      var profPermsCol = app.findCollectionByNameOrId('profile_permissions')
      var profiles = app.findRecordsByFilter(
        'profiles',
        'name = "Administrador" || name = "Gestor" || is_admin = true',
        '',
        50,
        0,
      )
      for (var p = 0; p < profiles.length; p++) {
        var prof = profiles[p]
        var existingPerm = null
        try {
          existingPerm = app.findFirstRecordByFilter(
            'profile_permissions',
            'profile = "' +
              prof.id +
              '" && module_key = "portal" && item_key = "portal_approvals_flow"',
          )
        } catch (_) {}
        if (!existingPerm) {
          var pRec = new Record(profPermsCol)
          pRec.set('profile', prof.id)
          pRec.set('module_key', 'portal')
          pRec.set('item_key', 'portal_approvals_flow')
          pRec.set('granted', true)
          app.save(pRec)
        }
      }
    } catch (permErr) {
      app
        .logger()
        .warn('0161: erro ao atribuir permissão portal_approvals_flow', 'error', permErr.message)
    }

    // 3. Alertas de aprovação (desligados por padrão, como todo o catálogo)
    var alertSettingsCol = app.findCollectionByNameOrId('email_alert_settings')

    var defaultAlerts = [
      {
        alert_key: 'ticket_approval_hold',
        name: 'Chamado Aguardando Aprovação (Solicitante)',
        description:
          'Enviado ao solicitante/contato quando o chamado aberto necessita de aprovação antes da análise e execução.',
        category: 'tickets',
        enabled: false,
        recipient_types: 'cliente',
        template_layout: 'modern',
        primary_color: '#D97706',
        subject_template: 'Chamado #{{chamado_numero}} aguardando aprovação - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Portal de Serviços - Aprovação Necessária',
        body_template:
          '<p>Olá <strong>{{solicitante}}</strong>,</p>' +
          '<p>Seu chamado <strong>#{{chamado_numero}}</strong> foi registrado com sucesso, porém necessita de <strong>aprovação</strong> antes da análise e execução pela equipe técnica.</p>' +
          '<div style="background-color: #fffbeb; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Abertura:</strong> {{data_abertura}}</p>' +
          '<p style="margin: 0;"><strong>Motivo:</strong> {{justificativa}}</p>' +
          '</div>' +
          '<p>O ponto focal responsável pela atividade foi notificado para avaliar a solicitação. Enquanto aguarda aprovação, o chamado permanece na fila de atendimento, porém travado para atuação da equipe.</p>',
        footer_text: 'Lógos AITSM - Fluxo de Aprovação de Chamados (Portal do Cliente)',
        show_button: true,
        button_label: 'Acompanhar no Portal',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'solicitante', desc: 'Nome do solicitante' },
          { key: 'empresa', desc: 'Nome da empresa cliente' },
          { key: 'prioridade', desc: 'Prioridade do chamado' },
          { key: 'data_abertura', desc: 'Data e hora de abertura' },
          { key: 'justificativa', desc: 'Justificativa/atividade que motivou a aprovação' },
          { key: 'link', desc: 'Link do chamado no portal' },
        ],
      },
      {
        alert_key: 'ticket_approval_request_internal',
        name: 'Solicitação de Aprovação de Chamado (Aprovador)',
        description:
          'Enviado ao aprovador (ponto focal do cliente ou aprovador interno) quando existe um chamado no portal aguardando sua aprovação.',
        category: 'portal',
        enabled: false,
        recipient_types: 'aprovador_portal',
        template_layout: 'modern',
        primary_color: '#D97706',
        subject_template: 'Aprovação pendente: Chamado #{{chamado_numero}} - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Central de Aprovações - Ação Necessária',
        body_template:
          '<p>Olá <strong>{{aprovador}}</strong>,</p>' +
          '<p>Existe um chamado no portal aguardando a sua aprovação para liberar o atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{solicitante}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Empresa:</strong> {{empresa}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
          '<p style="margin: 0;"><strong>Atividade:</strong> {{justificativa}}</p>' +
          '</div>' +
          '<p>Acesse o Portal do Cliente na aba de Aprovações para aprovar ou reprovar com o motivo da decisão.</p>',
        footer_text: 'Lógos AITSM - Central de Aprovações do Portal do Cliente',
        show_button: true,
        button_label: 'Aprovar no Portal',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'aprovador', desc: 'Nome do aprovador' },
          { key: 'solicitante', desc: 'Quem solicitou o chamado' },
          { key: 'empresa', desc: 'Nome da empresa cliente' },
          { key: 'prioridade', desc: 'Prioridade' },
          { key: 'justificativa', desc: 'Atividade/justificativa' },
          { key: 'link', desc: 'Link das aprovações no portal' },
        ],
      },
    ]

    for (var i = 0; i < defaultAlerts.length; i++) {
      var item = defaultAlerts[i]
      var existing = null
      try {
        existing = app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "' + item.alert_key + '"',
        )
      } catch (_) {}
      if (!existing && alertSettingsCol) {
        var rec = new Record(alertSettingsCol)
        rec.set('alert_key', item.alert_key)
        rec.set('name', item.name)
        rec.set('description', item.description)
        rec.set('category', item.category)
        rec.set('enabled', false)
        rec.set('recipient_types', item.recipient_types)
        rec.set('template_layout', item.template_layout)
        rec.set('primary_color', item.primary_color)
        rec.set('subject_template', item.subject_template)
        rec.set('header_title', item.header_title)
        rec.set('header_subtitle', item.header_subtitle)
        rec.set('body_template', item.body_template)
        rec.set('footer_text', item.footer_text)
        rec.set('show_button', item.show_button)
        rec.set('button_label', item.button_label)
        rec.set('button_url_template', item.button_url_template)
        rec.set('variables_hint', item.variables_hint)
        app.save(rec)
      }
    }
  },
  (app) => {
    // Reversão: remove os alertas criados (o campo approval_hold é mantido
    // para não perder dados em caso de rollback).
    try {
      var keys = ['ticket_approval_hold', 'ticket_approval_request_internal']
      for (var k = 0; k < keys.length; k++) {
        var rec = app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "' + keys[k] + '"',
        )
        if (rec) app.delete(rec)
      }
    } catch (_) {}
  },
)
