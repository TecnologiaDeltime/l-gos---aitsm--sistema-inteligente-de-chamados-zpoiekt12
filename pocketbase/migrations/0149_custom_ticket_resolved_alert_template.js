/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0149: Configuração e ativação do template de e-mail para Chamado Resolvido (ticket_resolved)
 *
 * - Configura o alerta 'ticket_resolved' na coleção 'email_alert_settings' com layout 'corporate'
 * - Assunto: 'Chamado #{{chamado_numero}} resolvido - {{titulo}}'
 * - Corpo visualmente alinhado ao template corporativo da marca Lógos AITSM (bloco de destaque, dados do chamado, solução e botão Acompanhar no Portal)
 * - Define is_customized = true
 * - Ativa o alerta (enabled = true) para envio automático ao solicitante na conclusão do chamado
 * - Idempotente: se o registro já tiver sido customizado previamente, preserva a customização existente e apenas garante enabled = true
 * - Mantém os demais 8 alertas no estado original e preserva anti-duplicidade em email_sent_logs
 */
migrate(
  (app) => {
    var alertKey = 'ticket_resolved'
    var corporateSubject = 'Chamado #{{chamado_numero}} resolvido - {{titulo}}'
    var corporateBody =
      '<p>Olá <strong>{{cliente}}</strong>,</p>' +
      '<p>Informamos que o seu chamado foi <strong>resolvido</strong> com sucesso por nossa equipe técnica.</p>' +
      '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Solução Aplicada:</strong> {{solucao}}</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Conclusão:</strong> {{data_conclusao}}</p>' +
      '<p style="margin: 0;"><strong>Responsável:</strong> {{operador}}</p>' +
      '</div>' +
      '<p>Caso o problema persista ou necessite de suporte adicional, você pode acompanhar os detalhes e reabrir o chamado pelo Portal do Cliente.</p>'

    var corporateFooter =
      'Você pode acompanhar os detalhes e o histórico deste chamado pelo Portal do Cliente Lógos AITSM.'

    var corporateVariables = [
      { key: 'chamado_numero', desc: 'Número do chamado (ex: 2026-10482)' },
      { key: 'titulo', desc: 'Título ou assunto do chamado' },
      { key: 'solucao', desc: 'Descrição da solução técnica aplicada' },
      { key: 'cliente', desc: 'Nome do solicitante' },
      { key: 'operador', desc: 'Operador técnico que concluiu o atendimento' },
      { key: 'data_conclusao', desc: 'Data e hora da finalização do chamado' },
      { key: 'data_abertura', desc: 'Data e hora da abertura do chamado' },
      { key: 'empresa', desc: 'Nome da empresa cliente' },
      { key: 'prioridade', desc: 'Prioridade do chamado' },
      { key: 'tipo', desc: 'Tipo do chamado (Incidente, Requisição)' },
      { key: 'link', desc: 'Link de acompanhamento no Portal do Cliente' },
    ]

    try {
      var rec = app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + alertKey + '"',
      )

      if (rec) {
        var alreadyCustomized = rec.getBool('is_customized')

        // Ativa o alerta (espelho da migração 0148)
        rec.set('enabled', true)

        // Se ainda não estiver customizado pelo operador, grava o template corporativo oficial
        if (!alreadyCustomized) {
          rec.set('is_customized', true)
          rec.set('template_layout', 'corporate')
          rec.set('subject_template', corporateSubject)
          rec.set('body_template', corporateBody)
          rec.set('primary_color', '#D97706')
          rec.set('header_title', 'Lógos AITSM')
          rec.set('header_subtitle', 'Atendimento Concluído')
          rec.set('footer_text', corporateFooter)
          rec.set('show_button', true)
          rec.set('button_label', 'Acompanhar no Portal')
          rec.set('button_url_template', '{{link}}')
          rec.set('variables_hint', corporateVariables)

          if (!rec.getString('default_subject_template')) {
            rec.set('default_subject_template', corporateSubject)
          }
          if (!rec.getString('default_body_template')) {
            rec.set('default_body_template', corporateBody)
          }

          app
            .logger()
            .info('0149: template corporativo gravado e ativado para alerta ticket_resolved')
        } else {
          app
            .logger()
            .info(
              '0149: alerta ticket_resolved já possuía personalização; preservando conteúdo e garantindo enabled = true',
            )
        }

        app.save(rec)
      } else {
        // Se por ventura o registro não existir, cria com os parâmetros completos
        var col = app.findCollectionByNameOrId('email_alert_settings')
        var newRec = new Record(col)
        newRec.set('alert_key', alertKey)
        newRec.set('name', 'Chamado Fechado / Resolvido')
        newRec.set(
          'description',
          'Notifica o cliente sobre a conclusão do atendimento com resumo da solução e convite para acompanhamento no portal.',
        )
        newRec.set('category', 'tickets')
        newRec.set('enabled', true)
        newRec.set('recipient_types', 'cliente')
        newRec.set('template_layout', 'corporate')
        newRec.set('primary_color', '#D97706')
        newRec.set('subject_template', corporateSubject)
        newRec.set('default_subject_template', corporateSubject)
        newRec.set('header_title', 'Lógos AITSM')
        newRec.set('header_subtitle', 'Atendimento Concluído')
        newRec.set('body_template', corporateBody)
        newRec.set('default_body_template', corporateBody)
        newRec.set('footer_text', corporateFooter)
        newRec.set('show_button', true)
        newRec.set('button_label', 'Acompanhar no Portal')
        newRec.set('button_url_template', '{{link}}')
        newRec.set('variables_hint', corporateVariables)
        newRec.set('is_customized', true)

        app.save(newRec)
        app
          .logger()
          .info('0149: registro ticket_resolved criado e ativado com template corporativo')
      }
    } catch (err) {
      app
        .logger()
        .error('0149: erro ao aplicar migração do alerta ticket_resolved', 'error', err.message)
      throw err
    }
  },
  (app) => {
    try {
      var rec = app.findFirstRecordByFilter('email_alert_settings', 'alert_key = "ticket_resolved"')
      if (rec) {
        rec.set('enabled', false)
        rec.set('is_customized', false)
        app.save(rec)
      }
    } catch (_) {}
  },
)
