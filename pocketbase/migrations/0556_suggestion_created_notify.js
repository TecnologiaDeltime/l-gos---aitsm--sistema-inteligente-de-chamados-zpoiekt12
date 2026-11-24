/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// 0556 — Alerta "Nova sugestão" na Central de Alertas (suggestion_created_notify)
// ----------------------------------------------------------------------------
// - Semeia a configuração do alerta em email_alert_settings nascendo DESLIGADO
//   (convenção do projeto: novos alertas nascem off; gestão liga quando quiser).
// - Idempotente: se o alert_key já existir, não faz nada.
// - A notificação in-app (sino) do hook suggestion_created_notify NÃO depende
//   deste toggle — o toggle governa apenas o e-mail transacional.
// ============================================================================

migrate(
  (app) => {
    let existing = null
    try {
      existing = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "suggestion_created_notify"',
      )
    } catch (_) {
      existing = null
    }
    if (existing) return // já semeado — nada a fazer

    const col = app.findCollectionByNameOrId('email_alert_settings')
    const rec = new Record(col)

    rec.set('alert_key', 'suggestion_created_notify')
    rec.set('name', 'Nova sugestão de operador')
    rec.set(
      'description',
      'Notifica a gestão quando um operador cria uma nova sugestão na Área de Sugestões. Destinatários: usuários com poder de gerenciar sugestões (admin, gestor e perfis com suggestions_gerenciar), exceto o próprio autor.',
    )
    rec.set('enabled', false)
    rec.set('template_layout', 'modern')
    rec.set('primary_color', '#D97706')
    rec.set('header_title', 'Lógos AITSM')
    rec.set('header_subtitle', 'Central de Alertas • Área de Sugestões')
    rec.set('footer_text', 'Lógos AITSM • Central de Serviços Inteligente')
    rec.set('category', 'tickets')
    rec.set(
      'recipient_types',
      'gestao_sugestoes (admin, gestor e perfis com suggestions_gerenciar) — exceto o autor',
    )
    rec.set(
      'variables_hint',
      JSON.stringify([
        { key: 'titulo', desc: 'Título da sugestão' },
        { key: 'categoria', desc: 'Categoria da sugestão' },
        { key: 'autor', desc: 'Nome do operador autor da sugestão' },
        { key: 'descricao', desc: 'Prévia da descrição da sugestão' },
        { key: 'data', desc: 'Data e hora da criação' },
        { key: 'link', desc: 'Link para a fila de gestão de sugestões (/suggestions)' },
      ]),
    )
    rec.set('subject_template', 'Nova sugestão: {{titulo}}')
    rec.set('default_subject_template', 'Nova sugestão: {{titulo}}')
    var bodyHtml =
      '<p>Olá,</p>' +
        '<p>O operador <strong>{{autor}}</strong> registrou uma nova sugestão na Área de Sugestões:</p>' +
        '<div style="margin: 18px 0; padding: 14px 18px; background-color: #f8fafc; border-left: 3px solid #D97706; border-radius: 6px;">' +
        '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Categoria:</strong> {{categoria}}</p>' +
        '<p style="margin: 0;"><strong>Data:</strong> {{data}}</p>' +
        '</div>' +
        '<p>Acesse a fila de gestão de sugestões para analisar, aceitar ou negar esta sugestão.</p>',
    )
    rec.set('show_button', true)
    rec.set('button_label', 'Abrir fila de sugestões')
    rec.set('button_url_template', '{{link}}')
    rec.set('is_customized', false)

    app.save(rec)
  },
  (app) => {
    // Down: remove a configuração semeada (e-mail nunca enviado fica registrado
    // em email_sent_logs apenas se chegou a ser enviado — reversão é limpa).
    try {
      const seeded = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "suggestion_created_notify"',
      )
      if (seeded) app.delete(seeded)
    } catch (_) {}
  },
)
