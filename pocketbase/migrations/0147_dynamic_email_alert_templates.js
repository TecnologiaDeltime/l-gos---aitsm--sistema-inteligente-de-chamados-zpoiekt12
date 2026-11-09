/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0147: Templates de Alerta Dinâmicos para a Central de Alertas por E-mail (Lógos AITSM)
 * - Adiciona campos de suporte a customização: is_customized (bool), default_subject_template (text), default_body_template (text)
 * - Atualiza os 9 alertas de e-mail com templates dinâmicos completos e biblioteca de variáveis expandida
 * - Concede permissão settings_email_alert_templates para perfis de administração e gestão
 */

migrate(
  (app) => {
    // 1. Enriquecer coleção email_alert_settings com campos de template dinâmico
    try {
      var col = app.findCollectionByNameOrId('email_alert_settings')
      var existingFields = {}
      var fieldsList = col.fields
      for (var f = 0; f < fieldsList.length; f++) {
        existingFields[fieldsList[f].name] = true
      }

      if (!existingFields['is_customized']) {
        col.fields.add(
          new Field({
            name: 'is_customized',
            type: 'bool',
          }),
        )
      }
      if (!existingFields['default_subject_template']) {
        col.fields.add(
          new Field({
            name: 'default_subject_template',
            type: 'text',
          }),
        )
      }
      if (!existingFields['default_body_template']) {
        col.fields.add(
          new Field({
            name: 'default_body_template',
            type: 'text',
          }),
        )
      }

      app.save(col)
      app.logger().info('0147: campos de templates dinâmicos adicionados em email_alert_settings')
    } catch (err) {
      app
        .logger()
        .warn('0147: falha ao atualizar campos de email_alert_settings', 'error', err.message)
    }

    // 2. Templates padrão enriquecidos com biblioteca ampla de variáveis dinâmicas
    var enhancedTemplates = {
      ticket_created: {
        subject: 'Chamado #{{chamado_numero}} registrado com sucesso - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atendimento & Central de Serviços',
        body:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Seu chamado foi registrado com sucesso em nossa central e já se encontra na fila de atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Tipo / Prioridade:</strong> {{tipo}} • {{prioridade}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Data e Hora:</strong> {{data_hora}}</p>' +
          '<p style="margin: 0;"><strong>Descrição:</strong> {{descricao}}</p>' +
          '</div>' +
          '<p>Nossa equipe técnica já foi acionada e iniciará o suporte dentro do prazo acordado.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado (ex: 2026-10482)' },
          { key: 'titulo', desc: 'Título ou assunto do chamado' },
          { key: 'descricao', desc: 'Descrição do problema informado' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'empresa', desc: 'Nome da empresa cliente' },
          { key: 'prioridade', desc: 'Prioridade (Baixa, Média, Alta, Crítica)' },
          { key: 'tipo', desc: 'Tipo (Incidente, Requisição, Dúvida)' },
          { key: 'fila', desc: 'Fila de atendimento inicial' },
          { key: 'data_hora', desc: 'Data e hora formatadas de abertura' },
          { key: 'data_abertura', desc: 'Alias para data de abertura' },
          { key: 'link', desc: 'Link de acompanhamento no Portal do Cliente' },
        ],
      },
      ticket_status_changed: {
        subject: 'Atualização no Chamado #{{chamado_numero}}: status alterado para {{status}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atualização de Chamado',
        body:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Houve uma atualização no andamento do seu chamado <strong>#{{chamado_numero}}</strong>.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #2563EB; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Novo Status:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: bold;">{{status}}</span></p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Status Anterior:</strong> {{status_anterior}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Responsável Técnico:</strong> {{responsavel}}</p>' +
          '<p style="margin: 0;"><strong>Data e Hora:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Você pode acompanhar notas de andamento ou enviar mais informações pelo Portal.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'status', desc: 'Novo status do chamado' },
          { key: 'status_anterior', desc: 'Status anterior do chamado' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'responsavel', desc: 'Operador técnico responsável' },
          { key: 'fila', desc: 'Fila técnica atribuída' },
          { key: 'data_hora', desc: 'Data e hora da alteração' },
          { key: 'link', desc: 'Link de acesso ao chamado' },
        ],
      },
      ticket_resolved: {
        subject: 'Chamado #{{chamado_numero}} foi Concluído - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atendimento Concluído',
        body:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Seu chamado <strong>#{{chamado_numero}}</strong> foi finalizado por nossa equipe técnica.</p>' +
          '<div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Responsável:</strong> {{responsavel}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Data de Conclusão:</strong> {{data_hora}}</p>' +
          '<p style="margin: 0;"><strong>Solução Aplicada:</strong> {{solucao}}</p>' +
          '</div>' +
          '<p>Caso precise de suporte complementar, basta responder este e-mail ou reabrir pelo portal.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'solucao', desc: 'Descrição da solução aplicada' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'responsavel', desc: 'Operador técnico que concluiu' },
          { key: 'data_hora', desc: 'Data e hora da finalização' },
          { key: 'data_conclusao', desc: 'Alias para data de conclusão' },
          { key: 'link', desc: 'Link de avaliação / satisfação' },
        ],
      },
      ticket_delegated: {
        subject: '[Atribuição] Chamado #{{chamado_numero}} atribuído a você - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atribuição de Tarefa',
        body:
          '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> foi atribuído para o seu atendimento técnico.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Cliente:</strong> {{cliente}} ({{empresa}})</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prazo SLA:</strong> {{prazo_sla}}</p>' +
          '<p style="margin: 0;"><strong>Atribuído em:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Por favor, acesse o painel técnico e registre o primeiro contato dentro do prazo estipulado.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'responsavel', desc: 'Nome do operador atribuído' },
          { key: 'operador', desc: 'Alias para operador responsável' },
          { key: 'cliente', desc: 'Nome do cliente solicitante' },
          { key: 'empresa', desc: 'Empresa do cliente' },
          { key: 'prioridade', desc: 'Prioridade do chamado' },
          { key: 'fila', desc: 'Fila técnica designada' },
          { key: 'prazo_sla', desc: 'Prazo limite do SLA de resposta' },
          { key: 'data_hora', desc: 'Data e hora da delegação' },
          { key: 'link', desc: 'Link direto no painel do operador' },
        ],
      },
      sla_response_alert: {
        subject: '⚠️ Alerta de SLA: Chamado #{{chamado_numero}} vence em {{prazo_sla}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Monitoramento de SLA',
        body:
          '<p>Atenção <strong>{{responsavel}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> está próximo do limite ou em risco de estouro de SLA.</p>' +
          '<div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Cliente / Empresa:</strong> {{cliente}} ({{empresa}})</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prazo Limite / Restante:</strong> <span style="color: #DC2626; font-weight: bold;">{{prazo_sla}}</span></p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Fila:</strong> {{fila}}</p>' +
          '<p style="margin: 0;"><strong>Alerta gerado em:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Aja prontamente no chamado para preservar o cumprimento dos acordos contratuais.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'responsavel', desc: 'Nome do operador ou gestor alertado' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'empresa', desc: 'Empresa cliente' },
          { key: 'prazo_sla', desc: 'Prazo limite ou tempo restante do SLA' },
          { key: 'tempo_restante', desc: 'Minutos restantes para o estouro' },
          { key: 'prioridade', desc: 'Prioridade do chamado' },
          { key: 'fila', desc: 'Fila técnica' },
          { key: 'data_hora', desc: 'Data e hora da emissão do alerta' },
          { key: 'link', desc: 'Link de acesso rápido ao chamado' },
        ],
      },
      change_approval_request: {
        subject: '[RDM] Aprovação Pendente - Mudança #{{mudanca_numero}} ({{titulo}})',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Comitê de Gestão de Mudanças',
        body:
          '<p>Prezado(a) <strong>{{responsavel}}</strong>,</p>' +
          '<p>Uma nova Requisição de Mudança (RDM) requer sua avaliação e voto no Comitê <strong>{{comite_tipo}}</strong>.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Número da RDM:</strong> #{{mudanca_numero}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{cliente}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Tipo / Risco:</strong> {{tipo}} | Risco: {{prioridade}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prazo Limite para Voto:</strong> {{prazo_sla}}</p>' +
          '<p style="margin: 0;"><strong>Data de Submissão:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Por favor, acesse a plataforma para analisar o plano de execução, rollback e registrar seu voto.</p>',
        variables: [
          { key: 'mudanca_numero', desc: 'Número da RDM (ex: MUD-2026-94268)' },
          { key: 'titulo', desc: 'Título da mudança' },
          { key: 'responsavel', desc: 'Nome do aprovador ou membro do comitê' },
          { key: 'aprovador', desc: 'Alias para aprovador' },
          { key: 'cliente', desc: 'Nome do solicitante da mudança' },
          { key: 'solicitante', desc: 'Alias para solicitante' },
          { key: 'comite_tipo', desc: 'Tipo do comitê (Padrão, Normal, Emergencial)' },
          { key: 'tipo', desc: 'Tipo de mudança' },
          { key: 'prioridade', desc: 'Risco / Prioridade da mudança' },
          { key: 'prazo_sla', desc: 'Prazo limite para votação' },
          { key: 'prazo_votacao', desc: 'Alias para prazo de votação' },
          { key: 'data_hora', desc: 'Data e hora da submissão' },
          { key: 'link', desc: 'Link direto para votação na RDM' },
        ],
      },
      change_voting_deadline: {
        subject: '[Comitê {{comite_tipo}}] Prazo Expirado - Mudança #{{mudanca_numero}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Comitê de Mudanças - Notificação de Prazo',
        body:
          '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
          '<p>O prazo de votação da Mudança <strong>#{{mudanca_numero}} - {{titulo}}</strong> expirou em {{data_hora}}.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #4B5563; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Comitê:</strong> {{comite_tipo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Resultado:</strong> {{status}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Resumo de Votos:</strong> {{descricao}}</p>' +
          '<p style="margin: 0;"><strong>Data de Registro:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>A decisão final foi consolidada e registrada no histórico de auditoria do sistema.</p>',
        variables: [
          { key: 'mudanca_numero', desc: 'Número da RDM' },
          { key: 'titulo', desc: 'Título da mudança' },
          { key: 'comite_tipo', desc: 'Tipo do comitê' },
          { key: 'status', desc: 'Status ou resultado do escalonamento' },
          { key: 'responsavel', desc: 'Nome do destinatário' },
          { key: 'descricao', desc: 'Resumo dos votos e justificativas' },
          { key: 'data_hora', desc: 'Data e hora da expiração' },
          { key: 'link', desc: 'Link de consulta da RDM' },
        ],
      },
      project_deadline: {
        subject: '[Projetos] Alerta de Prazo: {{titulo}} - {{status}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Gestão de Projetos & Prazos',
        body:
          '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
          '<p>Este é um aviso automático referente ao prazo de entrega do projeto ou atividade.</p>' +
          '<div style="background-color: #faf5ff; border-left: 4px solid #7C3AED; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Projeto / Atividade:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Situação:</strong> {{status}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Data Prevista:</strong> {{prazo_sla}}</p>' +
          '<p style="margin: 0;"><strong>Notificado em:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Acesse o painel do projeto para conferir as tarefas pendentes e manter as entregas no prazo.</p>',
        variables: [
          { key: 'titulo', desc: 'Nome do projeto ou da tarefa' },
          { key: 'projeto_nome', desc: 'Alias para nome do projeto' },
          { key: 'status', desc: 'Situação do prazo (Vence hoje, Próximo, Vencido)' },
          { key: 'responsavel', desc: 'Nome do responsável pela atividade' },
          { key: 'prazo_sla', desc: 'Data limite de entrega' },
          { key: 'data_limite', desc: 'Alias para data limite' },
          { key: 'data_hora', desc: 'Data e hora do disparo do alerta' },
          { key: 'link', desc: 'Link direto do projeto no painel' },
        ],
      },
      portal_approval_request: {
        subject: 'Solicitação de Aprovação: Chamado #{{chamado_numero}} - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Portal de Serviços - Aprovação Pendente',
        body:
          '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> requer sua aprovação para prosseguir com o atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{cliente}} ({{empresa}})</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Justificativa / Tipo:</strong> {{descricao}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prazo de Aprovação:</strong> {{prazo_sla}}</p>' +
          '<p style="margin: 0;"><strong>Data da Solicitação:</strong> {{data_hora}}</p>' +
          '</div>' +
          '<p>Você pode analisar e aprovar ou reprovar diretamente clicando no botão abaixo.</p>',
        variables: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'responsavel', desc: 'Nome do aprovador no portal' },
          { key: 'aprovador', desc: 'Alias para aprovador' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'solicitante', desc: 'Alias para solicitante' },
          { key: 'empresa', desc: 'Empresa do cliente' },
          { key: 'descricao', desc: 'Justificativa ou descrição do pedido' },
          { key: 'justificativa', desc: 'Alias para justificativa' },
          { key: 'prazo_sla', desc: 'Prazo estipulado para aprovação' },
          { key: 'data_hora', desc: 'Data e hora da solicitação' },
          { key: 'link', desc: 'Link de aprovação pública ou no portal' },
        ],
      },
    }

    // 3. Atualizar cada registro de alerta existente com os templates padrões e variáveis ampliadas
    var keys = Object.keys(enhancedTemplates)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var tpl = enhancedTemplates[k]
      try {
        var rec = app.findFirstRecordByFilter('email_alert_settings', 'alert_key = "' + k + '"')
        if (rec) {
          rec.set('default_subject_template', tpl.subject)
          rec.set('default_body_template', tpl.body)
          rec.set('variables_hint', tpl.variables)
          // Se o assunto ou corpo estiverem vazios, inicializa com o padrão
          if (!rec.getString('subject_template')) {
            rec.set('subject_template', tpl.subject)
          }
          if (!rec.getString('body_template')) {
            rec.set('body_template', tpl.body)
          }
          app.save(rec)
        }
      } catch (e) {
        app.logger().warn('0147: erro ao atualizar template para ' + k, 'error', e.message)
      }
    }

    // 4. Conceder permissão settings_email_alert_templates para perfis Admin e Gestor
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
              '" && module_key = "settings" && item_key = "settings_email_alert_templates"',
          )
        } catch (_) {}

        if (!existingPerm) {
          var pRec = new Record(profPermsCol)
          pRec.set('profile', prof.id)
          pRec.set('module_key', 'settings')
          pRec.set('item_key', 'settings_email_alert_templates')
          pRec.set('granted', true)
          app.save(pRec)
        }
      }
      app.logger().info('0147: permissões de templates concedidas com sucesso.')
    } catch (permErr) {
      app
        .logger()
        .warn(
          '0147: erro ao atribuir permissão settings_email_alert_templates',
          'error',
          permErr.message,
        )
    }
  },
  (app) => {
    // Reversão limpa
  },
)
