// Migração 0162 — Fluxo de Aprovação: terceiro alerta de abertura
// ----------------------------------------------------------------------------
// Insere em email_alert_settings a alert_key 'ticket_approval_created_notify'
// (notificação in-app ao aprovador quando um chamado entra em Aguardando
// Aprovação). As outras duas alert_keys do fluxo (ticket_approval_hold — e-mail
// ao solicitante — e ticket_approval_request_internal — e-mail ao aprovador)
// já foram criadas pela migração 0161.
// Idempotente: só cria se a alert_key não existir.

migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('email_alert_settings')

    var existing = null
    try {
      existing = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "ticket_approval_created_notify"',
      )
    } catch (_) {}

    if (existing) {
      app.logger().info('0162: alert_key ticket_approval_created_notify já existe — nada a fazer')
      return
    }

    var rec = new Record(col)
    rec.set('alert_key', 'ticket_approval_created_notify')
    rec.set('name', 'Notificação In-App de Aprovação Pendente (Aprovador)')
    rec.set(
      'description',
      'Notificação in-app enviada ao aprovador (e gestores, para visibilidade) quando um chamado entra em "Aguardando Aprovação". Desligue para suprimir apenas a notificação interna, mantendo os e-mails do fluxo.',
    )
    rec.set('category', 'portal')
    rec.set('enabled', false)
    rec.set('recipient_types', 'aprovador_portal')
    rec.set('template_layout', 'modern')
    rec.set('primary_color', '#D97706')
    rec.set('subject_template', 'Nova aprovação pendente: Chamado #{{chamado_numero}} - {{titulo}}')
    rec.set('header_title', 'Lógos AITSM')
    rec.set('header_subtitle', 'Central de Aprovações - Notificação Interna')
    rec.set(
      'body_template',
      '<p>Olá <strong>{{aprovador}}</strong>,</p>' +
        '<p>Existe um chamado aguardando a sua aprovação para liberar o atendimento.</p>' +
        '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
        '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{solicitante}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Empresa:</strong> {{empresa}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
        '<p style="margin: 0;"><strong>Atividade:</strong> {{justificativa}}</p>' +
        '</div>' +
        '<p>Acesse o Portal do Cliente na aba de Aprovações para aprovar ou reprovar com o motivo da decisão.</p>',
    )
    rec.set('footer_text', 'Lógos AITSM - Central de Aprovações do Portal do Cliente')
    rec.set('show_button', true)
    rec.set('button_label', 'Aprovar no Portal')
    rec.set('button_url_template', '{{link}}')
    rec.set('variables_hint', [
      { key: 'chamado_numero', desc: 'Número do chamado' },
      { key: 'titulo', desc: 'Título do chamado' },
      { key: 'aprovador', desc: 'Nome do aprovador' },
      { key: 'solicitante', desc: 'Quem solicitou o chamado' },
      { key: 'empresa', desc: 'Nome da empresa cliente' },
      { key: 'prioridade', desc: 'Prioridade' },
      { key: 'justificativa', desc: 'Atividade/justificativa' },
      { key: 'link', desc: 'Link das aprovações no portal' },
    ])
    app.save(rec)
    app.logger().info('0162: alert_key ticket_approval_created_notify criada')
  },
  (app) => {
    // Reversão: remove a alert_key criada
    try {
      var rec = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "ticket_approval_created_notify"',
      )
      if (rec) app.delete(rec)
    } catch (_) {}
  },
)
