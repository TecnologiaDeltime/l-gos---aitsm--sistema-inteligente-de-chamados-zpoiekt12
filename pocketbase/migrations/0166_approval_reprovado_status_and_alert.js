/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Migração 0166 — Fluxo de aprovação: status "Reprovado" + alerta de reprovação
// ----------------------------------------------------------------------------
// 1) tickets.status ganha o valor "Reprovado" (chamado encerrado por reprovação,
//    em vez de Encerrado/Cancelado).
// 2) Central de Alertas ganha o alerta ticket_approval_rejected_notify
//    (e-mail de reprovação ao solicitante) — nasce DESLIGADO, padrão do catálogo.
// sla_pauses.reason já possui "Aguardando Aprovação" — a pausa de SLA não exige
// mudança de schema.
// ============================================================================

migrate(
  (app) => {
    // --- 1) status "Reprovado" em tickets ---
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      const statusField = tickets.fields.getByName('status')
      if (statusField && statusField.values.indexOf('Reprovado') < 0) {
        statusField.values.push('Reprovado')
        app.save(tickets)
        console.log('[MIG 0166] tickets.status: valor "Reprovado" adicionado')
      }
    } catch (err) {
      console.error('[MIG 0166] falha ao ajustar tickets.status: ' + err.message)
      throw err
    }

    // --- 2) alerta ticket_approval_rejected_notify (nasce desligado) ---
    let existing = null
    try {
      existing = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "ticket_approval_rejected_notify"',
      )
    } catch (_) {}
    if (!existing) {
      try {
        const col = app.findCollectionByNameOrId('email_alert_settings')
        const rec = new Record(col)
        function safeSet(recRef, field, value) {
          try {
            recRef.set(field, value)
          } catch (_) {}
        }
        safeSet(rec, 'alert_key', 'ticket_approval_rejected_notify')
        safeSet(rec, 'name', 'Aprovação rejeitada - Notificação ao solicitante')
        safeSet(
          rec,
          'description',
          'E-mail informando ao solicitante que seu chamado foi reprovado pelo aprovador',
        )
        safeSet(rec, 'category', 'tickets')
        safeSet(rec, 'enabled', false)
        safeSet(rec, 'is_customized', false)
        safeSet(rec, 'template_layout', 'modern')
        safeSet(rec, 'primary_color', '#D97706')
        safeSet(
          rec,
          'default_subject_template',
          'Chamado #{{chamado_numero}} reprovado pelo aprovador',
        )
        safeSet(
          rec,
          'default_body_template',
          '<p>Olá, <strong>{{solicitante}}</strong>,</p>' +
            '<p>O chamado <strong>#{{chamado_numero}} — {{titulo}}</strong> foi <strong style="color:#dc2626;">reprovado</strong> pelo aprovador.</p>' +
            '<p><strong>Motivo da reprovação:</strong> {{motivo}}</p>' +
            '<p>O chamado foi encerrado por reprovação. Em caso de dúvida, fale com o ponto focal da sua empresa.</p>',
        )
        safeSet(rec, 'subject_template', '')
        safeSet(rec, 'body_template', '')
        safeSet(rec, 'header_title', 'Lógos AITSM')
        safeSet(rec, 'header_subtitle', 'Sistema Inteligente de Gestão de Serviços de TI')
        safeSet(rec, 'footer_text', 'Lógos AITSM • Central de Serviços Inteligente')
        safeSet(rec, 'show_button', true)
        safeSet(rec, 'button_label', 'Acessar o Portal')
        safeSet(rec, 'button_url_template', '{{link}}')
        app.save(rec)
        console.log('[MIG 0166] alerta ticket_approval_rejected_notify criado (desligado)')
      } catch (err) {
        console.error(
          '[MIG 0166] falha ao criar alerta ticket_approval_rejected_notify: ' + err.message,
        )
        throw err
      }
    }
  },
  (app) => {
    // Rollback: remove o alerta e o valor de status (dados de aprovação são mantidos)
    try {
      const rec = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "ticket_approval_rejected_notify"',
      )
      if (rec) app.delete(rec)
    } catch (_) {}
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      const statusField = tickets.fields.getByName('status')
      if (statusField) {
        const idx = statusField.values.indexOf('Reprovado')
        if (idx >= 0) {
          statusField.values.splice(idx, 1)
          app.save(tickets)
        }
      }
    } catch (_) {}
  },
)
