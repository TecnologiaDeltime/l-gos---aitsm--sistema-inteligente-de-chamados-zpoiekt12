migrate(
  (app) => {
    // 1. Atualizar email_audit_logs para incluir 'resposta_automatica' em test_type
    try {
      var auditCol = app.findCollectionByNameOrId('email_audit_logs')
      var testTypeField = auditCol.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = [
          'connection_test',
          'dry_run_simulation',
          'teste-envio',
          'teste-smtp',
          'retencao',
          'abertura_chamado',
          'resolucao_chamado',
          'alerta_sla',
          'aprovacao_chamado',
          'resposta_automatica',
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (err) {
      console.log('Migration 0095: erro ao atualizar test_type em email_audit_logs:', err)
    }

    // 2. Criar coleção email_auto_replies (ou recuperar se já existir)
    if (app.hasTable('email_auto_replies')) {
      return
    }

    const defaultReceiptSubject = 'Recebemos sua solicitação - Chamado #{{numero}}: {{assunto}}'
    const defaultReceiptBody =
      'Olá, {{solicitante}}!\n\n' +
      'Confirmamos o recebimento do seu e-mail. Um novo chamado foi registrado em nosso sistema de atendimento com os dados abaixo:\n\n' +
      '• Número do Chamado: #{{numero}}\n' +
      '• Assunto: {{assunto}}\n' +
      '• Solicitante: {{solicitante}}\n' +
      '• Empresa: {{empresa}}\n' +
      '• Data e Hora de Abertura: {{data}}\n\n' +
      'Nossa equipe técnica já foi notificada e dará início ao atendimento conforme a prioridade e os prazos de SLA acordados.\n\n' +
      'Para enviar informações adicionais sobre esta solicitação, basta responder a este e-mail mantendo o número #{{numero}} no assunto.\n\n' +
      'Atenciosamente,\n' +
      'Equipe de Suporte e Atendimento'

    const defaultOutOfOfficeSubject =
      'Recebemos seu e-mail [Fora do Expediente] - Chamado #{{numero}}'
    const defaultOutOfOfficeBody =
      'Olá, {{solicitante}}!\n\n' +
      'Recebemos seu e-mail e registramos o chamado #{{numero}} em nossa fila.\n\n' +
      'Informamos que no momento nossa equipe está fora do horário regular de expediente comercial ou em período de recesso/feriado.\n\n' +
      '• Número do Chamado: #{{numero}}\n' +
      '• Assunto: {{assunto}}\n' +
      '• Abertura registrada em: {{data}}\n\n' +
      'Sua solicitação está preservada e será atendida assim que nosso expediente for retomado pelo próximo analista disponível.\n\n' +
      'Caso se trate de uma emergência crítica contratual coberta por plantão, os canais de sobreaviso já foram alertados.\n\n' +
      'Atenciosamente,\n' +
      'Equipe de Suporte e Atendimento'

    const col = new Collection({
      name: 'email_auto_replies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'scope',
          type: 'select',
          required: true,
          values: ['global'],
          maxSelect: 1,
        },
        // Resposta de Recebimento
        { name: 'receipt_enabled', type: 'bool', required: false },
        { name: 'receipt_subject', type: 'text', required: false },
        { name: 'receipt_body', type: 'text', required: false },

        // Resposta de Ausência (Fora do Expediente)
        { name: 'out_of_office_enabled', type: 'bool', required: false },
        { name: 'out_of_office_subject', type: 'text', required: false },
        { name: 'out_of_office_body', type: 'text', required: false },

        // Controle e Auditoria
        { name: 'anti_loop_enabled', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_auto_reply_scope ON email_auto_replies (scope)'],
    })
    app.save(col)

    // 3. Seed inicial do registro global
    try {
      app.findFirstRecordByData('email_auto_replies', 'scope', 'global')
    } catch (_) {
      const rec = new Record(col)
      rec.set('scope', 'global')
      rec.set('receipt_enabled', true)
      rec.set('receipt_subject', defaultReceiptSubject)
      rec.set('receipt_body', defaultReceiptBody)
      rec.set('out_of_office_enabled', false)
      rec.set('out_of_office_subject', defaultOutOfOfficeSubject)
      rec.set('out_of_office_body', defaultOutOfOfficeBody)
      rec.set('anti_loop_enabled', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('email_auto_replies')
      app.delete(col)
    } catch (_) {}

    try {
      var auditCol = app.findCollectionByNameOrId('email_audit_logs')
      var testTypeField = auditCol.fields.getByName('test_type')
      if (testTypeField) {
        testTypeField.values = [
          'connection_test',
          'dry_run_simulation',
          'teste-envio',
          'teste-smtp',
          'retencao',
          'abertura_chamado',
          'resolucao_chamado',
          'alerta_sla',
          'aprovacao_chamado',
        ]
        testTypeField.maxSelect = 1
        app.save(auditCol)
      }
    } catch (_) {}
  },
)
