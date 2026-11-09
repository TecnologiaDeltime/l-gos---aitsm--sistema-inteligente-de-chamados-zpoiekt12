/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0146: Central de Alertas por E-mail (Lógos AITSM)
 *
 * 1. Cria coleção 'email_alert_settings' para persistir controle individual
 *    por tipo de alerta (ligado/desligado, todos desligados por padrão) e
 *    configurações visuais de templates customizáveis com a marca Lógos AITSM.
 * 2. Cria coleção 'email_sent_logs' para anti-duplicidade estrita por
 *    (alert_key + reference_id + recipient).
 * 3. Adiciona campo 'voting_deadline_notified_at' na coleção 'changes' e
 *    executa backfill na Mudança #MUD-2026-94268 para cessar imediatamente
 *    o reenvio de alertas expirados.
 * 4. Popula o catálogo de tipos de alerta com switches DESLIGADOS por padrão.
 * 5. Concede permissão 'settings_email_alerts' para perfis de Admin e Gestor.
 */

migrate(
  (app) => {
    // 1. Coleção email_alert_settings
    var alertSettingsCol = null
    try {
      alertSettingsCol = app.findCollectionByNameOrId('email_alert_settings')
    } catch (_) {}

    if (!alertSettingsCol) {
      alertSettingsCol = new Collection({
        name: 'email_alert_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'alert_key',
            type: 'text',
            required: true,
          },
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'category',
            type: 'text',
          },
          {
            name: 'enabled',
            type: 'bool',
          },
          {
            name: 'recipient_types',
            type: 'text',
          },
          {
            name: 'template_layout',
            type: 'text',
          },
          {
            name: 'primary_color',
            type: 'text',
          },
          {
            name: 'subject_template',
            type: 'text',
          },
          {
            name: 'header_title',
            type: 'text',
          },
          {
            name: 'header_subtitle',
            type: 'text',
          },
          {
            name: 'body_template',
            type: 'text',
          },
          {
            name: 'footer_text',
            type: 'text',
          },
          {
            name: 'show_button',
            type: 'bool',
          },
          {
            name: 'button_label',
            type: 'text',
          },
          {
            name: 'button_url_template',
            type: 'text',
          },
          {
            name: 'variables_hint',
            type: 'json',
          },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_email_alert_key ON email_alert_settings (alert_key)'],
      })
      app.save(alertSettingsCol)
    }

    // 2. Coleção email_sent_logs (anti-duplicidade de envios)
    var sentLogsCol = null
    try {
      sentLogsCol = app.findCollectionByNameOrId('email_sent_logs')
    } catch (_) {}

    if (!sentLogsCol) {
      sentLogsCol = new Collection({
        name: 'email_sent_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'alert_key',
            type: 'text',
            required: true,
          },
          {
            name: 'reference_id',
            type: 'text',
            required: true,
          },
          {
            name: 'recipient',
            type: 'text',
            required: true,
          },
          {
            name: 'sent_at',
            type: 'date',
            required: true,
          },
          {
            name: 'subject',
            type: 'text',
          },
          {
            name: 'meta',
            type: 'json',
          },
        ],
        indexes: [
          'CREATE INDEX idx_email_sent_lookup ON email_sent_logs (alert_key, reference_id, recipient)',
        ],
      })
      app.save(sentLogsCol)
    }

    // 3. Adicionar campo 'voting_deadline_notified_at' em 'changes' se ainda não existir
    try {
      var changesCol = app.findCollectionByNameOrId('changes')
      var hasNotifiedField = false
      var fields = changesCol.fields
      for (var f = 0; f < fields.length; f++) {
        if (fields[f].name === 'voting_deadline_notified_at') {
          hasNotifiedField = true
          break
        }
      }
      if (!hasNotifiedField) {
        changesCol.fields.add(
          new Field({
            name: 'voting_deadline_notified_at',
            type: 'date',
          }),
        )
        app.save(changesCol)
      }
    } catch (e) {
      app
        .logger()
        .warn(
          '0146: erro ao adicionar campo voting_deadline_notified_at em changes',
          'error',
          e.message,
        )
    }

    // 3.1 Backfill imediato para Mudança #MUD-2026-94268 parar de enviar a cada 15 min
    try {
      var nowIso = new Date().toISOString()
      var targetChanges = app.findRecordsByFilter('changes', 'number = "MUD-2026-94268"', '', 5, 0)
      for (var c = 0; c < targetChanges.length; c++) {
        var chg = targetChanges[c]
        chg.set('voting_deadline_notified_at', nowIso)
        // Limpar voting_deadline_at para que crons legados também cessem imediatamente
        chg.set('voting_deadline_at', '')
        app.save(chg)
        app
          .logger()
          .info(
            '0146: MUD-2026-94268 marcada como notificada e voting_deadline_at limpo com sucesso.',
          )
      }
    } catch (e) {
      app.logger().warn('0146: falha ao aplicar backfill em MUD-2026-94268', 'error', e.message)
    }

    // 4. Catálogo padrão de alertas - TODOS DESLIGADOS POR PADRÃO (enabled: false)
    var defaultAlerts = [
      {
        alert_key: 'ticket_created',
        name: 'Aviso de Chamado Aberto',
        description:
          'Enviado ao cliente quando um novo chamado é registrado no portal ou pelo sistema.',
        category: 'tickets',
        enabled: false,
        recipient_types: 'cliente',
        template_layout: 'modern',
        primary_color: '#D97706',
        subject_template: 'Chamado #{{chamado_numero}} registrado com sucesso - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atendimento & Central de Serviços',
        body_template:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Seu chamado foi registrado com sucesso em nossa central e já se encontra na fila de atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Abertura:</strong> {{data_abertura}}</p>' +
          '<p style="margin: 0;"><strong>Descrição:</strong> {{descricao}}</p>' +
          '</div>' +
          '<p>Nossa equipe técnica já foi acionada e iniciará o atendimento em breve.</p>',
        footer_text:
          'Você pode acompanhar o andamento ou responder este chamado pelo Portal do Cliente Lógos AITSM.',
        show_button: true,
        button_label: 'Acompanhar no Portal',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado (ex: 2026-0814)' },
          { key: 'titulo', desc: 'Título / assunto do chamado' },
          { key: 'descricao', desc: 'Descrição do problema informado' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'prioridade', desc: 'Prioridade do chamado' },
          { key: 'data_abertura', desc: 'Data e hora formatada de abertura' },
          { key: 'empresa', desc: 'Nome da empresa cliente' },
          { key: 'link', desc: 'Link direto para o chamado no portal' },
        ],
      },
      {
        alert_key: 'ticket_status_changed',
        name: 'Modificação de Status do Chamado',
        description:
          'Notifica o solicitante quando houver evolução de status no chamado (Em Atendimento, Aguardando Cliente, etc.).',
        category: 'tickets',
        enabled: false,
        recipient_types: 'cliente',
        template_layout: 'modern',
        primary_color: '#2563EB',
        subject_template:
          'Atualização no Chamado #{{chamado_numero}}: status alterado para {{status}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atualização de Chamado',
        body_template:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Houve uma atualização no status do seu chamado <strong>#{{chamado_numero}}</strong>.</p>' +
          '<div style="background-color: #f0fdf4; border-left: 4px solid #2563EB; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Novo Status:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: bold;">{{status}}</span></p>' +
          '<p style="margin: 0;"><strong>Responsável Técnico:</strong> {{responsavel}}</p>' +
          '</div>' +
          '<p>Acesse o portal para conferir notas de andamento ou interagir com a equipe.</p>',
        footer_text: 'Lógos AITSM - Gestão Inteligente de Serviços de TI',
        show_button: true,
        button_label: 'Ver Detalhes do Chamado',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'status', desc: 'Novo status do chamado' },
          { key: 'status_anterior', desc: 'Status anterior' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'responsavel', desc: 'Operador responsável' },
          { key: 'link', desc: 'Link de acesso ao chamado' },
        ],
      },
      {
        alert_key: 'ticket_resolved',
        name: 'Chamado Fechado / Resolvido',
        description:
          'Notifica o cliente sobre a conclusão do atendimento com resumo da solução e convite para avaliação.',
        category: 'tickets',
        enabled: false,
        recipient_types: 'cliente',
        template_layout: 'modern',
        primary_color: '#059669',
        subject_template: 'Chamado #{{chamado_numero}} foi Concluído - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atendimento Concluído',
        body_template:
          '<p>Olá <strong>{{cliente}}</strong>,</p>' +
          '<p>Seu chamado <strong>#{{chamado_numero}}</strong> foi finalizado por nossa equipe técnica.</p>' +
          '<div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solução Aplicada:</strong> {{solucao}}</p>' +
          '<p style="margin: 0;"><strong>Data de Conclusão:</strong> {{data_conclusao}}</p>' +
          '</div>' +
          '<p>Sua opinião é fundamental para melhorarmos continuamente nossos serviços.</p>',
        footer_text:
          'Caso o problema persista, você poderá reabrir este chamado pelo portal dentro do prazo estipulado.',
        show_button: true,
        button_label: 'Avaliar Atendimento',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'solucao', desc: 'Texto da solução aplicada' },
          { key: 'cliente', desc: 'Nome do cliente' },
          { key: 'data_conclusao', desc: 'Data e hora da finalização' },
          { key: 'link', desc: 'Link para avaliação / pesquisa de satisfação' },
        ],
      },
      {
        alert_key: 'ticket_delegated',
        name: 'Chamado Atribuído / Delegado',
        description:
          'Notifica o operador técnico quando um chamado for atribuído diretamente a ele ou à sua equipe.',
        category: 'tickets',
        enabled: false,
        recipient_types: 'operador',
        template_layout: 'modern',
        primary_color: '#D97706',
        subject_template: '[Atribuição] Chamado #{{chamado_numero}} atribuído a você - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atribuição de Tarefa',
        body_template:
          '<p>Olá <strong>{{operador}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> foi atribuído para o seu atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Cliente:</strong> {{cliente}} ({{empresa}})</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Prioridade:</strong> {{prioridade}}</p>' +
          '<p style="margin: 0;"><strong>Prazo SLA Resposta:</strong> {{prazo_sla}}</p>' +
          '</div>' +
          '<p>Por favor, inicie o atendimento e registre a primeira resposta dentro do SLA acordado.</p>',
        footer_text: 'Lógos AITSM - Central Técnica de Atendimento',
        show_button: true,
        button_label: 'Abrir Chamado no Painel',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'operador', desc: 'Nome do operador atribuído' },
          { key: 'cliente', desc: 'Nome do cliente' },
          { key: 'empresa', desc: 'Empresa do cliente' },
          { key: 'prioridade', desc: 'Prioridade' },
          { key: 'prazo_sla', desc: 'Prazo limite do SLA' },
          { key: 'link', desc: 'Link direto do painel' },
        ],
      },
      {
        alert_key: 'sla_response_alert',
        name: 'Alertas de SLA para Operadores',
        description:
          'Disparado aos técnicos e gestores quando o prazo de primeira resposta ou resolução do chamado estiver próximo do vencimento.',
        category: 'sla',
        enabled: false,
        recipient_types: 'operador,gestor',
        template_layout: 'modern',
        primary_color: '#DC2626',
        subject_template:
          '⚠️ SLA Crítico: Chamado #{{chamado_numero}} vence em {{tempo_restante}} min',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Monitoramento de SLA',
        body_template:
          '<p>Atenção <strong>{{destinatario}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> está com prazo de SLA em iminência de estouro.</p>' +
          '<div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Cliente / Empresa:</strong> {{cliente}} ({{empresa}})</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Tempo Restante:</strong> <span style="color: #DC2626; font-weight: bold; font-size: 16px;">{{tempo_restante}} minutos</span></p>' +
          '<p style="margin: 0;"><strong>Limite SLA:</strong> {{prazo_limite}}</p>' +
          '</div>' +
          '<p>Aja imediatamente para evitar violação do acordo de nível de serviço com o cliente.</p>',
        footer_text: 'Lógos AITSM - Alerta Automatizado de SLA',
        show_button: true,
        button_label: 'Atender Chamado Imediatamente',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'destinatario', desc: 'Nome do operador ou gestor' },
          { key: 'cliente', desc: 'Nome do solicitante' },
          { key: 'empresa', desc: 'Nome da empresa' },
          { key: 'tempo_restante', desc: 'Minutos restantes para o estouro' },
          { key: 'prazo_limite', desc: 'Data e hora limite do SLA' },
          { key: 'link', desc: 'Link de acesso rápido ao chamado' },
        ],
      },
      {
        alert_key: 'change_approval_request',
        name: 'Solicitação de Aprovação de Mudança (RDM)',
        description:
          'Notifica os membros do comitê de mudanças e gestores sobre nova RDM aguardando avaliação e voto.',
        category: 'changes',
        enabled: false,
        recipient_types: 'gestor,comite',
        template_layout: 'corporate',
        primary_color: '#D97706',
        subject_template: '[RDM] Aprovação Pendente - Mudança #{{mudanca_numero}} ({{titulo}})',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Comitê de Gestão de Mudanças',
        body_template:
          '<p>Prezado(a) <strong>{{aprovador}}</strong>,</p>' +
          '<p>Uma nova Requisição de Mudança (RDM) requer sua avaliação e voto no Comitê <strong>{{comite_tipo}}</strong>.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Número da RDM:</strong> #{{mudanca_numero}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Título:</strong> {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Tipo / Risco:</strong> {{tipo}} | Risco: {{risco}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{solicitante}}</p>' +
          '<p style="margin: 0;"><strong>Prazo Limite para Voto:</strong> {{prazo_votacao}}</p>' +
          '</div>' +
          '<p>Por favor, acesse o sistema para analisar o plano de execução, plano de rollback e registrar seu parecer.</p>',
        footer_text: 'Lógos AITSM - Gestão de Mudanças e Liberações (ITIL v4)',
        show_button: true,
        button_label: 'Avaliar e Votar na RDM',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'mudanca_numero', desc: 'Número da RDM (ex: MUD-2026-94268)' },
          { key: 'titulo', desc: 'Título da mudança' },
          { key: 'comite_tipo', desc: 'Tipo do comitê (Padrão ou Emergencial)' },
          { key: 'tipo', desc: 'Tipo de mudança' },
          { key: 'risco', desc: 'Grau de risco' },
          { key: 'solicitante', desc: 'Nome do solicitante' },
          { key: 'prazo_votacao', desc: 'Data limite para votação' },
          { key: 'aprovador', desc: 'Nome do membro do comitê' },
          { key: 'link', desc: 'Link direto para a RDM' },
        ],
      },
      {
        alert_key: 'change_voting_deadline',
        name: 'Prazo Expirado de Mudança (RDM)',
        description:
          'Notifica comitê e gestores quando o prazo de votação de uma RDM expirou e a decisão foi finalizada ou escalonada.',
        category: 'changes',
        enabled: false,
        recipient_types: 'gestor,comite',
        template_layout: 'corporate',
        primary_color: '#4B5563',
        subject_template: '[Comitê {{comite_tipo}}] Prazo Expirado - Mudança #{{mudanca_numero}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Comitê de Mudanças - Notificação de Prazo',
        body_template:
          '<p>Olá,</p>' +
          '<p>O prazo de votação da Mudança <strong>#{{mudanca_numero}} - {{titulo}}</strong> expirou em {{data_expiracao}}.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #4B5563; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Comitê:</strong> {{comite_tipo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Resultado:</strong> {{resultado_escalonamento}}</p>' +
          '<p style="margin: 0;"><strong>Resumo de Votos:</strong> {{resumo_votos}}</p>' +
          '</div>' +
          '<p>A decisão foi registrada no histórico de auditoria do sistema.</p>',
        footer_text: 'Lógos AITSM - Sistema de Gestão de Mudanças',
        show_button: true,
        button_label: 'Consultar RDM',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'mudanca_numero', desc: 'Número da RDM' },
          { key: 'titulo', desc: 'Título da mudança' },
          { key: 'comite_tipo', desc: 'Tipo do comitê' },
          { key: 'data_expiracao', desc: 'Data e hora da expiração' },
          { key: 'resultado_escalonamento', desc: 'Resumo da decisão ou escalonamento' },
          { key: 'resumo_votos', desc: 'Total de votos aprovados, recusados e revisões' },
          { key: 'link', desc: 'Link da mudança' },
        ],
      },
      {
        alert_key: 'project_deadline',
        name: 'Avisos de Prazo de Projetos',
        description:
          'Notifica gerentes e responsáveis quando projetos ou atividades estiverem próximos da data limite ou vencidos.',
        category: 'projects',
        enabled: false,
        recipient_types: 'gerente,responsavel',
        template_layout: 'minimal',
        primary_color: '#7C3AED',
        subject_template: '[Projetos] Alerta de Prazo: {{projeto_nome}} - {{tipo_aviso}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Gestão de Projetos & Prazos',
        body_template:
          '<p>Olá <strong>{{responsavel}}</strong>,</p>' +
          '<p>Este é um aviso sobre o prazo de entrega do projeto ou atividade.</p>' +
          '<div style="background-color: #faf5ff; border-left: 4px solid #7C3AED; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Projeto / Atividade:</strong> {{projeto_nome}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Situação do Prazo:</strong> {{tipo_aviso}}</p>' +
          '<p style="margin: 0;"><strong>Data Prevista:</strong> {{data_limite}}</p>' +
          '</div>' +
          '<p>Acesse o painel do projeto para conferir as tarefas pendentes e manter os prazos alinhados.</p>',
        footer_text: 'Lógos AITSM - Módulo de Projetos',
        show_button: true,
        button_label: 'Acessar Projeto',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'projeto_nome', desc: 'Nome do projeto ou da atividade' },
          { key: 'tipo_aviso', desc: 'Próximo do prazo, Vence hoje ou Vencido' },
          { key: 'responsavel', desc: 'Nome do responsável designado' },
          { key: 'data_limite', desc: 'Data limite de entrega' },
          { key: 'link', desc: 'Link do projeto' },
        ],
      },
      {
        alert_key: 'portal_approval_request',
        name: 'Solicitação de Aprovação no Portal',
        description:
          'Disparado aos pontos focais e aprovadores do cliente quando um chamado necessita de validação/autorização.',
        category: 'portal',
        enabled: false,
        recipient_types: 'aprovador_portal',
        template_layout: 'modern',
        primary_color: '#D97706',
        subject_template: 'Solicitação de Aprovação: Chamado #{{chamado_numero}} - {{titulo}}',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Portal de Serviços - Aprovação Pendente',
        body_template:
          '<p>Olá <strong>{{aprovador}}</strong>,</p>' +
          '<p>O chamado <strong>#{{chamado_numero}}</strong> requer sua aprovação para prosseguir com o atendimento.</p>' +
          '<div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">' +
          '<p style="margin: 0 0 6px 0;"><strong>Chamado:</strong> #{{chamado_numero}} - {{titulo}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Solicitante:</strong> {{solicitante}}</p>' +
          '<p style="margin: 0 0 6px 0;"><strong>Tipo / Justificativa:</strong> {{justificativa}}</p>' +
          '<p style="margin: 0;"><strong>Prazo de Resposta:</strong> {{prazo_aprovacao}}</p>' +
          '</div>' +
          '<p>Você pode aprovar ou reprovar diretamente com um clique no botão abaixo.</p>',
        footer_text: 'Lógos AITSM - Central de Aprovações do Portal do Cliente',
        show_button: true,
        button_label: 'Analisar e Decidir Aprovação',
        button_url_template: '{{link}}',
        variables_hint: [
          { key: 'chamado_numero', desc: 'Número do chamado' },
          { key: 'titulo', desc: 'Título do chamado' },
          { key: 'aprovador', desc: 'Nome do aprovador' },
          { key: 'solicitante', desc: 'Quem solicitou o chamado' },
          { key: 'justificativa', desc: 'Justificativa da necessidade' },
          { key: 'prazo_aprovacao', desc: 'Prazo estipulado para aprovação' },
          { key: 'link', desc: 'Link de aprovação pública ou no portal' },
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

      if (!existing) {
        var rec = new Record(alertSettingsCol)
        rec.set('alert_key', item.alert_key)
        rec.set('name', item.name)
        rec.set('description', item.description)
        rec.set('category', item.category)
        rec.set('enabled', false) // GARANTIDO DESLIGADO POR PADRÃO
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

    // 5. Conceder permissão settings_email_alerts para perfis de Admin e Gestor
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
              '" && module_key = "settings" && item_key = "settings_email_alerts"',
          )
        } catch (_) {}

        if (!existingPerm) {
          var pRec = new Record(profPermsCol)
          pRec.set('profile', prof.id)
          pRec.set('module_key', 'settings')
          pRec.set('item_key', 'settings_email_alerts')
          pRec.set('granted', true)
          app.save(pRec)
        }
      }
    } catch (permErr) {
      app
        .logger()
        .warn('0146: erro ao atribuir permissão settings_email_alerts', 'error', permErr.message)
    }
  },
  (app) => {
    // Reversão
    try {
      var s = app.findCollectionByNameOrId('email_alert_settings')
      if (s) app.delete(s)
    } catch (_) {}
    try {
      var l = app.findCollectionByNameOrId('email_sent_logs')
      if (l) app.delete(l)
    } catch (_) {}
  },
)
