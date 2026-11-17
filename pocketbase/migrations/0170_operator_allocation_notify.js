// Migração 0170 — Notificação de Nova Alocação de Operador
// ----------------------------------------------------------------------------
// Insere em email_alert_settings a alert_key 'operator_allocation_notify'
// (e-mail ao operador quando ele é alocado a um cliente, disparado pelo hook
// operator_allocation_notify.js ao criar/reativar um registro em
// operator_allocations). A notificação in-app não depende deste interruptor.
// Nasce DESLIGADO por padrão (mesmo padrão de 0161/0162).
// Idempotente: só cria se a alert_key não existir.

migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('email_alert_settings')

    var existing = null
    try {
      existing = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "operator_allocation_notify"',
      )
    } catch (_) {}

    if (existing) {
      app.logger().info('0170: alert_key operator_allocation_notify já existe — nada a fazer')
      return
    }

    var rec = new Record(col)
    rec.set('alert_key', 'operator_allocation_notify')
    rec.set('name', 'Nova Alocação de Operador (Operador)')
    rec.set(
      'description',
      'E-mail enviado ao operador quando ele é alocado a um cliente (Alocação de Operadores: criação ou reativação de alocação ativa). A notificação in-app independe deste interruptor — desligue aqui para suprimir apenas o e-mail.',
    )
    rec.set('category', 'tickets')
    rec.set('enabled', false)
    rec.set('recipient_types', 'operador_alocado')
    rec.set('template_layout', 'modern')
    rec.set('primary_color', '#D97706')
    rec.set('subject_template', 'Nova alocação: {{operador}} alocado a {{cliente}}')
    rec.set('header_title', 'Lógos AITSM')
    rec.set('header_subtitle', 'Central de Alocação de Operadores')
    rec.set(
      'body_template',
      '<p>Olá <strong>{{operador}}</strong>,</p>' +
        '<p>Você foi alocado a um cliente para trabalhos presenciais. Confira os dados da alocação:</p>' +
        '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
        '<p style="margin: 0 0 6px 0;"><strong>Cliente:</strong> {{cliente}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Unidade:</strong> {{unidade}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Tipo de alocação:</strong> {{tipo_alocacao}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Recorrência:</strong> {{recorrencia}}</p>' +
        '<p style="margin: 0 0 6px 0;"><strong>Vigência:</strong> {{vigencia}}</p>' +
        '<p style="margin: 0;"><strong>Observações:</strong> {{observacoes}}</p>' +
        '</div>' +
        '<p>Em caso de divergência, procure a gestão de atendimento antes do início da vigência.</p>',
    )
    rec.set('footer_text', 'Lógos AITSM - Alocação de Operadores')
    rec.set('show_button', false)
    rec.set('button_label', 'Acessar')
    rec.set('button_url_template', '')
    rec.set('variables_hint', [
      { key: 'operador', desc: 'Nome do operador alocado' },
      { key: 'cliente', desc: 'Nome do cliente (empresa)' },
      { key: 'unidade', desc: 'Unidade/filial do cliente (quando informada)' },
      { key: 'tipo_alocacao', desc: 'Exclusiva / Permanente ou Por Período' },
      { key: 'recorrencia', desc: 'Resumo da recorrência (dias/semanas/meses)' },
      { key: 'vigencia', desc: 'Datas de início e fim da vigência' },
      { key: 'observacoes', desc: 'Observações da alocação' },
    ])
    app.save(rec)
    app.logger().info('0170: alert_key operator_allocation_notify criada (desligada por padrão)')
  },
  (app) => {
    // Reversão: remove a alert_key criada
    try {
      var rec = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "operator_allocation_notify"',
      )
      if (rec) app.delete(rec)
    } catch (_) {}
  },
)
