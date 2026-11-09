/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0148: Ativar por padrão o alerta de e-mail de abertura de chamado ("Chamado aberto")
 *
 * Contexto:
 * - O usuário determinou que todo colaborador cadastrado com e-mail deve receber notificação
 *   ao abrir um chamado e que a notificação de abertura de chamado DEVE sair sempre via e-mail
 *   transacional do Skip.
 * - As migrações 0146/0147 criaram os 9 tipos de alerta desligados por padrão.
 * - Esta migração ativa explicitamente o alerta 'ticket_created' (enabled = true), mantendo
 *   os demais 8 alertas inalterados/desligados por padrão.
 * - Idempotente: atualiza o registro caso já exista ou cria se ausente.
 */

migrate(
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('email_alert_settings')
      if (!col) return

      var defaultSubject = 'Chamado #{{chamado_numero}} aberto com sucesso: {{titulo}}'
      var defaultBody =
        '<p>Olá, <strong>{{cliente}}</strong>,</p>' +
        '<p>Confirmamos o recebimento da sua solicitação. Seu chamado foi registrado com sucesso e <strong>já está na fila de atendimento</strong> da nossa equipe técnica.</p>' +
        '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">' +
        '<p style="margin: 0 0 8px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
        '<p style="margin: 0 0 8px 0;"><strong>Problema:</strong> {{titulo}}</p>' +
        '<p style="margin: 0 0 8px 0;"><strong>Descrição:</strong> {{descricao}}</p>' +
        '<p style="margin: 0 0 8px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
        '<p style="margin: 0 0 8px 0;"><strong>Tipo:</strong> {{tipo}}</p>' +
        '<p style="margin: 0;"><strong>Data de Abertura:</strong> {{data_abertura}}</p>' +
        '</div>' +
        '<p>Nossa equipe técnica entrará em contato em breve para dar início ao suporte.</p>'

      try {
        var rec = app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "ticket_created"',
        )
        if (rec) {
          rec.set('enabled', true)
          // Se não tiver templates de assunto ou corpo definidos, preenche com os padrões
          if (!rec.getString('default_subject_template')) {
            rec.set('default_subject_template', defaultSubject)
          }
          if (!rec.getString('default_body_template')) {
            rec.set('default_body_template', defaultBody)
          }
          app.save(rec)
          app.logger().info('Migração 0148: Alerta ticket_created ATIVADO com sucesso.')
          return
        }
      } catch (_) {
        // registro não encontrado, criaremos abaixo
      }

      var newRec = new Record(col)
      newRec.set('alert_key', 'ticket_created')
      newRec.set('name', 'Chamado aberto')
      newRec.set(
        'description',
        'Notificação enviada ao cliente e colaboradores quando um novo chamado é registrado',
      )
      newRec.set('category', 'tickets')
      newRec.set('enabled', true)
      newRec.set('template_layout', 'modern')
      newRec.set('primary_color', '#0284c7')
      newRec.set('header_title', 'Lógos AITSM')
      newRec.set('header_subtitle', 'Notificações do Sistema ITSM')
      newRec.set('footer_text', 'Lógos AITSM • Sistema de Gestão de Serviços de TI')
      newRec.set('default_subject_template', defaultSubject)
      newRec.set('default_body_template', defaultBody)
      newRec.set('button_label_template', 'Acompanhar Chamado')
      newRec.set('button_url_template', '{{link}}')
      app.save(newRec)
      app.logger().info('Migração 0148: Registro do alerta ticket_created CRIADO e ATIVADO.')
    } catch (err) {
      app.logger().error('Migração 0148 falhou ao ativar ticket_created: ' + err.message)
    }
  },
  (app) => {
    // Reversão opcional (desliga ticket_created)
    try {
      var rec = app.findFirstRecordByFilter('email_alert_settings', 'alert_key = "ticket_created"')
      if (rec) {
        rec.set('enabled', false)
        app.save(rec)
      }
    } catch (_) {}
  },
)
