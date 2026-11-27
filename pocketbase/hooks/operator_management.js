// pocketbase/hooks/operator_management.js
// Criação e exclusão de operadores restritas exclusivamente ao perfil administrador,
// envio de e-mail de primeiro acesso e troca obrigatória de senha.
//
// IMPORTANTE (JSVM/PocketBase): toda a lógica vive 100% INLINE dentro dos callbacks
// das rotas. Helpers definidos fora do callback (escopo do IIFE ou globalThis) NÃO
// são visíveis quando o callback executa — ReferenceError em runtime (v0.0.566).

// Rota para criação de operador com envio de e-mail de primeiro acesso (Apenas Admin)
// POST /backend/v1/operators/create
routerAdd(
  'POST',
  '/backend/v1/operators/create',
  function (c) {
    var authUser = c.auth
    if (!authUser) {
      return c.json(401, { error: 'Não autenticado.' })
    }

    var role = authUser.getString('role')
    if (role !== 'admin') {
      return c.json(403, {
        error: 'Apenas administradores podem cadastrar novos operadores.',
      })
    }

    var body = c.requestInfo().body || {}
    var email = (body.email || '').toLowerCase().trim()
    var password = body.password || ''
    var passwordConfirm = body.passwordConfirm || ''
    var name = (body.name || '').trim()

    if (!name) {
      return c.json(400, { error: 'O nome do operador é obrigatório.' })
    }
    if (!email) {
      return c.json(400, { error: 'O e-mail do operador é obrigatório.' })
    }
    if (!password) {
      return c.json(400, { error: 'A senha provisória é obrigatória.' })
    }
    if (password.length < 8) {
      return c.json(400, {
        error: 'A senha deve conter no mínimo 8 caracteres.',
      })
    }
    if (password !== passwordConfirm) {
      return c.json(400, {
        error: 'A confirmação de senha não confere.',
      })
    }

    // Verificar se já existe usuário com este e-mail
    try {
      var existing = $app.findAuthRecordByEmail('_pb_users_auth_', email)
      if (existing) {
        return c.json(400, {
          error: 'Este endereço de e-mail já está cadastrado no sistema.',
        })
      }
    } catch (_) {}

    // Criar o registro na coleção users
    var usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    var newRecord = new Record(usersCol)

    newRecord.set('email', email)
    newRecord.set('password', password)
    newRecord.set('passwordConfirm', passwordConfirm)
    newRecord.set('name', name)
    newRecord.set('emailVisibility', false)
    newRecord.set('verified', true)
    newRecord.set('must_change_password', true) // marcação obrigatória

    // Campos adicionais opcionais
    var opRole = body.role || 'tecnico'
    newRecord.set('role', opRole)

    if (body.type) newRecord.set('type', body.type)
    if (body.position) newRecord.set('position', body.position)
    if (body.phone) newRecord.set('phone', body.phone)
    if (body.mobile) newRecord.set('mobile', body.mobile)
    if (body.extension) newRecord.set('extension', body.extension)
    if (body.company) newRecord.set('company', body.company)
    if (body.unit) newRecord.set('unit', body.unit)
    if (body.team) newRecord.set('team', body.team)
    if (body.profile_id) newRecord.set('profile_id', body.profile_id)
    if (body.active !== undefined) {
      newRecord.set('active', !!body.active)
    } else {
      newRecord.set('active', true)
    }

    try {
      $app.save(newRecord)
    } catch (saveErr) {
      $app.logger().error('operator_management: falha ao salvar usuario', 'err', saveErr.message)
      return c.json(400, {
        error:
          'Erro ao cadastrar operador: ' + (saveErr.message || 'Verifique os dados preenchidos.'),
      })
    }

    // Preparar envio de e-mail de primeiro acesso
    var emailSent = false
    var emailError = null

    try {
      if (typeof globalThis.sendSystemEmail === 'function') {
        var appUrl = ''
        try {
          var origin = c.request.header.get('origin') || c.request.header.get('referer') || ''
          if (origin) {
            var parts = origin.split('/')
            if (parts.length >= 3) {
              appUrl = parts[0] + '//' + parts[2]
            }
          }
        } catch (_) {}

        var loginUrl = appUrl ? appUrl + '/login' : 'o sistema'

        var subject = 'Acesso ao Sistema ITSM - Credenciais de Primeiro Acesso'
        var htmlBody =
          '<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">' +
          '<div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">' +
          '<h2 style="color: #0f172a; margin: 0; font-size: 20px;">Bem-vindo ao Lógos AITSM</h2>' +
          '<p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">Suas credenciais de primeiro acesso foram criadas</p>' +
          '</div>' +
          '<p style="font-size: 15px; line-height: 1.5;">Olá <strong>' +
          name +
          '</strong>,</p>' +
          '<p style="font-size: 14px; line-height: 1.5;">Um perfil de operador foi cadastrado para você na plataforma ITSM. Utilize os dados abaixo para o seu primeiro login:</p>' +
          '<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">' +
          '<p style="margin: 0 0 8px 0; font-size: 14px;"><strong>E-mail:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">' +
          email +
          '</code></p>' +
          '<p style="margin: 0; font-size: 14px;"><strong>Senha Provisória:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0284c7;">' +
          password +
          '</code></p>' +
          '</div>' +
          '<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0;">' +
          '<p style="margin: 0; font-size: 13px; color: #1e40af;"><strong>Atenção:</strong> Por motivos de segurança, você deverá cadastrar uma nova senha pessoal obrigatoriamente logo no primeiro acesso ao sistema.</p>' +
          '</div>' +
          (appUrl
            ? '<p style="text-align: center; margin: 30px 0;"><a href="' +
              loginUrl +
              '" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar o Sistema</a></p>'
            : '') +
          '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />' +
          '<p style="font-size: 12px; color: #94a3b8; margin: 0;">Este é um e-mail automático enviado pelo Lógos AITSM. Por favor, não responda a esta mensagem.</p>' +
          '</div>'

        var textBody =
          'Olá ' +
          name +
          ',\n\n' +
          'Um perfil de operador foi cadastrado para você no sistema ITSM.\n\n' +
          'Suas credenciais de primeiro acesso:\n' +
          'E-mail: ' +
          email +
          '\n' +
          'Senha provisória: ' +
          password +
          '\n\n' +
          'Atenção: Por motivos de segurança, você deverá definir uma nova senha no seu primeiro acesso.\n' +
          (appUrl ? '\nLink de acesso: ' + loginUrl + '\n' : '')

        globalThis.sendSystemEmail({
          to: email,
          subject: subject,
          html: htmlBody,
          text: textBody,
        })
        emailSent = true
      } else {
        emailError = 'Serviço de envio de e-mails indisponível no servidor.'
      }
    } catch (err) {
      $app
        .logger()
        .warn('operator_management: falha ao enviar email', 'to', email, 'err', err.message)
      emailError = err.message || 'Falha ao conectar ao servidor SMTP.'
    }

    return c.json(200, {
      success: true,
      record: {
        id: newRecord.id,
        email: newRecord.getString('email'),
        name: newRecord.getString('name'),
        role: newRecord.getString('role'),
        must_change_password: true,
      },
      email_sent: emailSent,
      email_error: emailError,
      message: emailSent
        ? 'Operador criado com sucesso e e-mail de primeiro acesso enviado!'
        : 'Operador criado com sucesso, mas o e-mail de primeiro acesso não pôde ser enviado (' +
          (emailError || 'erro SMTP') +
          '). Forneça a senha manualmente.',
    })
  },
  $apis.requireAuth(),
)

// Rota para exclusão segura de operador (Apenas Admin)
// DELETE /backend/v1/operators/{id}
// TODA a lógica (auxiliares incluídos) vive inline neste callback — requisito do JSVM.
routerAdd(
  'DELETE',
  '/backend/v1/operators/{id}',
  function (c) {
    // ---- Auxiliares (declarações de função: hoisted, sempre disponíveis) ----

    // Conta registros de uma coleção pelo filtro (0 em caso de coleção/campo inexistente).
    // Passo 1: consulta barata (limit 1) só para saber se existe algo;
    // Passo 2: contagem exata (até 10000) apenas quando há vínculo — evita
    // carregar a tabela inteira no caso comum de operador sem vínculos.
    function countRecords(col, filter) {
      try {
        var probe = $app.findRecordsByFilter(col, filter, '', 1, 0)
        if (!probe || probe.length === 0) return 0
      } catch (e) {
        return 0
      }
      try {
        var rows = $app.findRecordsByFilter(col, filter, '', 10000, 0)
        return rows ? rows.length : 0
      } catch (e2) {
        return 1
      }
    }

    // Apaga registros que casem com o filtro (em lotes). Uso: registros efêmeros
    // e tabelas internas de autenticação do PocketBase.
    function delAll(col, filter) {
      try {
        for (var round = 0; round < 10; round++) {
          var rows = $app.findRecordsByFilter(col, filter, '', 250, 0)
          if (!rows || rows.length === 0) break
          var removed = 0
          for (var i = 0; i < rows.length; i++) {
            try {
              $app.delete(rows[i])
              removed++
            } catch (e2) {}
          }
          if (removed === 0) break
        }
      } catch (e) {
        $app.logger().warn('operator_delete: delAll falhou', 'col', col, 'err', e.message)
      }
    }

    // Neutraliza a referência ao usuário em campos relation simples (define ''),
    // preservando o registro histórico. Se o campo for obrigatório e a gravação
    // falhar, remove o registro (efeito atributivo, sem quebrar o DELETE final).
    function clearRefs(col, filter, fields) {
      try {
        for (var round = 0; round < 10; round++) {
          var rows = $app.findRecordsByFilter(col, filter, '', 250, 0)
          if (!rows || rows.length === 0) break
          var changed = 0
          for (var i = 0; i < rows.length; i++) {
            try {
              var rec = rows[i]
              for (var f = 0; f < fields.length; f++) {
                rec.set(fields[f], '')
              }
              $app.save(rec)
              changed++
            } catch (e2) {
              // campo obrigatório: remove o registro atributivo
              try {
                $app.delete(rows[i])
                changed++
              } catch (e3) {}
            }
          }
          if (changed === 0) break
        }
      } catch (e) {
        $app.logger().warn('operator_delete: clearRefs falhou', 'col', col, 'err', e.message)
      }
    }

    // Remove o id do usuário de campos relation multivalorados (listas)
    function removeFromList(col, filter, field, userId) {
      try {
        var rows = $app.findRecordsByFilter(col, filter, '', 500, 0)
        for (var i = 0; i < rows.length; i++) {
          try {
            var rec = rows[i]
            var cur = rec.getStringSlice(field) || []
            var next = []
            for (var j = 0; j < cur.length; j++) {
              if (cur[j] !== userId) next.push(cur[j])
            }
            rec.set(field, next)
            $app.save(rec)
          } catch (e2) {}
        }
      } catch (e) {
        $app.logger().warn('operator_delete: removeFromList falhou', 'col', col, 'err', e.message)
      }
    }

    // ---- Autenticação e permissão ----
    var authUser = c.auth
    if (!authUser) {
      return c.json(401, { error: 'Não autenticado.' })
    }

    var role = authUser.getString('role')
    if (role !== 'admin') {
      return c.json(403, {
        error: 'Apenas administradores podem excluir operadores.',
      })
    }

    var id = c.request.pathValue('id')
    if (!id) {
      return c.json(400, { error: 'ID do operador não fornecido.' })
    }

    if (id === authUser.id) {
      return c.json(400, { error: 'Você não pode excluir sua própria conta de administrador.' })
    }

    var targetRecord
    try {
      targetRecord = $app.findRecordById('_pb_users_auth_', id)
    } catch (err) {
      return c.json(404, { error: 'Operador não encontrado.' })
    }

    console.log('operator_delete: inicio', id)

    // ---- Verificação de vínculos OPERACIONAIS (bloqueiam a exclusão) ----
    var blockingReasons = []

    // 1. Chamados atribuídos
    var nAssigned = countRecords('tickets', 'assigned_to = "' + id + '"')
    if (nAssigned > 0) {
      blockingReasons.push(nAssigned + ' chamado(s) atribuído(s) a ele como responsável')
    }

    // 2. Interações / apontamentos de horas em chamados
    var nInter = countRecords('ticket_interactions', 'author = "' + id + '"')
    if (nInter > 0) {
      blockingReasons.push(nInter + ' interação(ões) ou apontamento(s) de horas registrados')
    }

    // 3. Anexos postados
    var nAtt = countRecords('ticket_attachments', 'uploaded_by = "' + id + '"')
    if (nAtt > 0) {
      blockingReasons.push(nAtt + ' anexo(s) de chamados enviados')
    }

    // 4. Visitas técnicas atribuídas
    var nVisits = countRecords('technical_visits', 'technician = "' + id + '"')
    if (nVisits > 0) {
      blockingReasons.push(nVisits + ' visita(s) técnica(s) atribuída(s)')
    }

    // 5. Apontamentos avulsos de tempo
    var nTime = countRecords('time_entries', 'technician = "' + id + '"')
    if (nTime > 0) {
      blockingReasons.push(nTime + ' lançamento(s) de horas de atendimento')
    }

    // 6. Apontamentos de tempo de visitas técnicas
    var nVTime = countRecords('visit_time_entries', 'technician = "' + id + '"')
    if (nVTime > 0) {
      blockingReasons.push(nVTime + ' registro(s) de tempo de visitas técnicas')
    }

    // 7. Aprovações pendentes (como aprovador ou solicitante — vínculo obrigatório)
    var nPend = countRecords(
      'approvals',
      '(approver = "' + id + '" || requester = "' + id + '") && status = "Pendente"',
    )
    if (nPend > 0) {
      blockingReasons.push(nPend + ' aprovação(ões) pendente(s) aguardando decisão ou solicitação')
    }

    // 8. Chamados agendados ativos
    var nSched = countRecords(
      'scheduled_tickets',
      'assigned_to = "' + id + '" && status = "agendado"',
    )
    if (nSched > 0) {
      blockingReasons.push(nSched + ' chamado(s) agendado(s) recorrente(s) atribuído(s)')
    }

    // 9. Laudos fotográficos como técnico responsável (campo obrigatório)
    var nLaudos = countRecords('laudos', 'technician = "' + id + '"')
    if (nLaudos > 0) {
      blockingReasons.push(nLaudos + ' laudo(s) fotográfico(s) como técnico responsável')
    }

    // 10. Pesquisas de satisfação respondidas
    var nSurv = countRecords('satisfaction_surveys', 'respondent = "' + id + '"')
    if (nSurv > 0) {
      blockingReasons.push(nSurv + ' pesquisa(s) de satisfação respondida(s)')
    }

    // 11. Sugestões próprias (author é vínculo obrigatório e significativo)
    var nSug = countRecords('suggestions', 'author = "' + id + '"')
    if (nSug > 0) {
      blockingReasons.push(nSug + ' sugestão(ões) registrada(s) como autor')
    }

    if (blockingReasons.length > 0) {
      var msg =
        'Não é possível excluir este operador porque ele possui registros operacionais vinculados: ' +
        blockingReasons.join('; ') +
        '. Para revogar o acesso sem comprometer o histórico, desative a conta do operador ou reatribua seus chamados pendentes.'
      console.log('operator_delete: bloqueado por vínculos', id, blockingReasons.join('; '))
      return c.json(400, { error: msg })
    }

    console.log('operator_delete: sem vínculos bloqueantes, iniciando limpeza', id)

    // ---- Limpeza de autenticação interna do PocketBase ----
    delAll('_externalAuths', 'recordRef = "' + id + '"')
    delAll('_mfas', 'recordRef = "' + id + '"')
    delAll('_otps', 'recordRef = "' + id + '"')
    delAll('_authOrigins', 'recordRef = "' + id + '"')

    console.log('operator_delete: auth interna limpa', id)

    // ---- Listas multivaloradas: só remove o id do usuário ----
    removeFromList('queues', 'members ~ "' + id + '"', 'members', id)
    removeFromList('change_committee', 'members ~ "' + id + '"', 'members', id)
    removeFromList('tickets', 'participants ~ "' + id + '"', 'participants', id)
    removeFromList('changes', 'participants ~ "' + id + '"', 'participants', id)
    removeFromList(
      'approval_configs',
      'internal_approvers ~ "' + id + '"',
      'internal_approvers',
      id,
    )
    removeFromList(
      'approval_configs',
      'internal_approvers_all ~ "' + id + '"',
      'internal_approvers_all',
      id,
    )
    removeFromList('ticket_interactions', 'mentioned_users ~ "' + id + '"', 'mentioned_users', id)

    console.log('operator_delete: listas limpas', id)

    // ---- Relations simples: neutraliza a referência (histórico preservado) ----
    var clears = [
      // Chamados (assigned_to é bloqueado antes)
      ['tickets', 'closed_by = "' + id + '"', ['closed_by']],
      ['tickets', 'operator_cycle_user = "' + id + '"', ['operator_cycle_user']],
      // Interações e anexos (author/uploaded_by bloqueados antes)
      ['ticket_interactions', 'approved_by = "' + id + '"', ['approved_by']],
      // Histórico de chamados e auditoria
      ['ticket_history', 'user = "' + id + '"', ['user']],
      ['audit_logs', 'user = "' + id + '"', ['user']],
      // Pausas de SLA
      ['sla_pauses', 'paused_by = "' + id + '"', ['paused_by']],
      ['sla_pauses', 'resumed_by = "' + id + '"', ['resumed_by']],
      // Horas aprovadas
      ['time_entries', 'approved_by = "' + id + '"', ['approved_by']],
      // Visitas técnicas: responsáveis atributivos
      ['technical_visits', 'scheduling_responsible = "' + id + '"', ['scheduling_responsible']],
      ['technical_visits', 'cancellation_responsible = "' + id + '"', ['cancellation_responsible']],
      // Ordens de serviço e despesas
      ['service_orders', 'technician = "' + id + '"', ['technician']],
      ['expenses', 'technician = "' + id + '"', ['technician']],
      ['expenses', 'approver = "' + id + '"', ['approver']],
      ['travel_entries', 'technician = "' + id + '"', ['technician']],
      ['reimbursements', 'technician = "' + id + '"', ['technician']],
      ['reimbursements', 'approver = "' + id + '"', ['approver']],
      ['reimbursements', 'finance_approver = "' + id + '"', ['finance_approver']],
      // Regulagens de visita
      ['km_rates', 'technician = "' + id + '"', ['technician']],
      ['recurring_visit_templates', 'technician = "' + id + '"', ['technician']],
      // Aprovações já decididas (pendentes são bloqueadas antes)
      ['approvals', 'approver = "' + id + '" && status != "Pendente"', ['approver']],
      ['approvals', 'requester = "' + id + '" && status != "Pendente"', ['requester']],
      // Configurações de aprovação
      ['approval_configs', 'approver_user = "' + id + '"', ['approver_user']],
      // Chamados agendados não ativos (agendados são bloqueados antes)
      ['scheduled_tickets', 'assigned_to = "' + id + '" && status != "agendado"', ['assigned_to']],
      ['scheduled_tickets', 'created_by = "' + id + '"', ['created_by']],
      // Base de conhecimento
      ['knowledge_articles', 'author = "' + id + '"', ['author']],
      ['knowledge_drafts', 'reviewed_by = "' + id + '"', ['reviewed_by']],
      ['knowledge_curations', 'action_by = "' + id + '"', ['action_by']],
      ['kb_sources', 'uploaded_by = "' + id + '"', ['uploaded_by']],
      // Mudanças (changes: requester/responsible/approved_by — implemented_by/created_by NÃO existem)
      ['changes', 'requester = "' + id + '"', ['requester']],
      ['changes', 'responsible = "' + id + '"', ['responsible']],
      ['changes', 'assigned_to = "' + id + '"', ['assigned_to']],
      ['changes', 'approved_by = "' + id + '"', ['approved_by']],
      ['change_approvals', 'approver = "' + id + '"', ['approver']],
      ['change_committee', 'chairperson = "' + id + '"', ['chairperson']],
      ['change_audit_logs', 'user = "' + id + '"', ['user']],
      // Problemas
      ['problems', 'requester = "' + id + '"', ['requester']],
      ['problems', 'responsible = "' + id + '"', ['responsible']],
      ['problems', 'investigation_responsible = "' + id + '"', ['investigation_responsible']],
      ['problems', 'root_cause_responsible = "' + id + '"', ['root_cause_responsible']],
      ['problem_audit_logs', 'user = "' + id + '"', ['user']],
      ['problem_workarounds', 'responsible = "' + id + '"', ['responsible']],
      ['problem_effectiveness_evaluations', 'evaluated_by = "' + id + '"', ['evaluated_by']],
      ['problem_definitive_solutions', 'responsible = "' + id + '"', ['responsible']],
      ['problem_extensions', 'responsible = "' + id + '"', ['responsible']],
      ['known_errors', 'responsible = "' + id + '"', ['responsible']],
      ['problem_timeline', 'responsible = "' + id + '"', ['responsible']],
      // Projetos
      ['projects', 'manager = "' + id + '"', ['manager']],
      ['project_tasks', 'assigned_to = "' + id + '"', ['assigned_to']],
      ['project_work_logs', 'user = "' + id + '"', ['user']],
      // Workflows
      ['automations', 'responsible = "' + id + '"', ['responsible']],
      ['workflow_versions', 'published_by = "' + id + '"', ['published_by']],
      ['workflow_tasks', 'responsible = "' + id + '"', ['responsible']],
      ['workflow_audit_logs', 'user = "' + id + '"', ['user']],
      // Bloqueios de cliente
      ['blocking_records', 'responsible = "' + id + '"', ['responsible']],
      ['blocking_records', 'approver = "' + id + '"', ['approver']],
      ['blocking_records', 'unblocked_by = "' + id + '"', ['unblocked_by']],
      // Cofre de credenciais
      ['vault_credentials', 'created_by = "' + id + '"', ['created_by']],
      ['vault_credentials', 'updated_by = "' + id + '"', ['updated_by']],
      ['vault_audit_logs', 'operator = "' + id + '"', ['operator']],
      // Auditoria de e-mails
      ['email_audit_logs', 'executed_by = "' + id + '"', ['executed_by']],
      // Relatórios mensais
      ['client_monthly_reports', 'generated_by = "' + id + '"', ['generated_by']],
      ['client_monthly_reports', 'released_by = "' + id + '"', ['released_by']],
      [
        'client_monthly_reports',
        'satisfaction_responded_by = "' + id + '"',
        ['satisfaction_responded_by'],
      ],
      ['monthly_report_schedules', 'created_by = "' + id + '"', ['created_by']],
      // Chamados retidos revisados
      ['retained_tickets', 'reviewed_by = "' + id + '"', ['reviewed_by']],
      // Atendimento (chat interno): operador_atribuido/agente_sugerido/aceito_por — campo "operator" NÃO existe
      ['atendimento_conversas', 'operador_atribuido = "' + id + '"', ['operador_atribuido']],
      ['atendimento_mensagens', 'operador = "' + id + '"', ['operador']],
      ['atendimento_dossies', 'agente_sugerido = "' + id + '"', ['agente_sugerido']],
      ['atendimento_dossies', 'aceito_por = "' + id + '"', ['aceito_por']],
      // Inventário de aparelhos
      ['inventory_devices', 'assigned_to = "' + id + '"', ['assigned_to']],
      ['inventory_devices', 'created_by = "' + id + '"', ['created_by']],
      ['inventory_movements', 'previous_owner = "' + id + '"', ['previous_owner']],
      ['inventory_movements', 'new_owner = "' + id + '"', ['new_owner']],
      ['inventory_movements', 'performed_by = "' + id + '"', ['performed_by']],
      // Laudos: sem created_by; technician é bloqueado antes
      // Checklists, templates e campos personalizados
      ['checklist_templates', 'created_by = "' + id + '"', ['created_by']],
      ['custom_field_defs', 'created_by = "' + id + '"', ['created_by']],
      ['custom_field_values', 'created_by = "' + id + '"', ['created_by']],
      ['ticket_templates', 'created_by = "' + id + '"', ['created_by']],
      // Contatos de cliente vinculados a login
      ['client_contacts', 'user = "' + id + '"', ['user']],
      // Alertas de auditoria e logs de automação
      ['alert_audit_logs', 'operator = "' + id + '"', ['operator']],
      ['asset_automation_logs', 'operator = "' + id + '"', ['operator']],
    ]
    for (var ci = 0; ci < clears.length; ci++) {
      clearRefs(clears[ci][0], clears[ci][1], clears[ci][2])
    }

    console.log('operator_delete: relations neutralizadas', id)

    // ---- Registros efêmeros do próprio usuário: apaga ----
    var dels = [
      // 2FA e notificações
      ['user_totp', 'user = "' + id + '"'],
      ['notifications', 'user = "' + id + '"'],
      // Votos em sugestões (sugestões de autoria do operador são bloqueadas antes)
      ['suggestion_votes', 'voter = "' + id + '"'],
      // Ciclo de trabalho, alocações e disponibilidade
      ['operator_work_cycle_pauses', 'operator = "' + id + '"'],
      ['operator_allocations', 'operator = "' + id + '"'],
      ['supervisor_team_links', 'supervisor = "' + id + '"'],
      ['technician_availability', 'technician = "' + id + '"'],
      ['technician_locations', 'technician = "' + id + '"'],
      // Metas e snapshots diários
      ['technician_goals', 'technician = "' + id + '"'],
      ['sla_goals', 'technician = "' + id + '"'],
      ['operator_daily_snapshots', 'operator = "' + id + '"'],
      // Visualizações de chamados
      ['ticket_views', 'user = "' + id + '"'],
      // Mensagens de chat entre operadores (sender e recipient são obrigatórios)
      ['operator_chat_messages', 'sender = "' + id + '"'],
      ['operator_chat_messages', 'recipient = "' + id + '"'],
      ['operator_chat_messages', 'sender ~ "' + id + '"'],
      ['operator_chat_messages', 'recipient ~ "' + id + '"'],
    ]
    for (var di = 0; di < dels.length; di++) {
      delAll(dels[di][0], dels[di][1])
    }

    console.log('operator_delete: registros efêmeros removidos, executando DELETE final', id)

    // Tentar a exclusão do registro do usuário
    try {
      $app.delete(targetRecord)
      console.log('operator_delete: sucesso', id)
      return c.json(200, {
        success: true,
        message: 'Operador excluído com sucesso.',
      })
    } catch (delErr) {
      // Nunca expor o texto cru do constraint do banco ao usuário.
      console.log('operator_delete: DELETE final falhou', id, delErr.message)
      $app
        .logger()
        .error('operator_management: erro ao deletar usuario', 'id', id, 'err', delErr.message)
      return c.json(400, {
        error:
          'Não foi possível excluir este operador porque ainda existem registros vinculados a ele no sistema. ' +
          'Revise os vínculos do operador (chamados, interações, visitas, laudos e aprovações) ou, ' +
          'para revogar o acesso mantendo o histórico, desative a conta na tela de Operadores.',
      })
    }
  },
  $apis.requireAuth(),
)

// Rota para troca de senha obrigatória no primeiro acesso
// POST /backend/v1/auth/change-first-password
routerAdd(
  'POST',
  '/backend/v1/auth/change-first-password',
  function (c) {
    var authUser = c.auth
    if (!authUser) {
      return c.json(401, { error: 'Não autenticado.' })
    }

    var body = c.requestInfo().body || {}
    var currentPassword = body.currentPassword || ''
    var newPassword = body.newPassword || ''
    var newPasswordConfirm = body.newPasswordConfirm || ''

    if (!newPassword) {
      return c.json(400, { error: 'A nova senha é obrigatória.' })
    }
    if (newPassword.length < 8) {
      return c.json(400, { error: 'A nova senha deve ter no mínimo 8 caracteres.' })
    }
    if (newPassword !== newPasswordConfirm) {
      return c.json(400, {
        error: 'A confirmação da nova senha não confere.',
      })
    }

    // Validar senha atual se fornecida
    if (currentPassword && !authUser.validatePassword(currentPassword)) {
      return c.json(400, { error: 'A senha provisória informada está incorreta.' })
    }

    try {
      authUser.set('password', newPassword)
      authUser.set('passwordConfirm', newPasswordConfirm)
      authUser.set('must_change_password', false) // remove a exigência
      $app.save(authUser)

      return c.json(200, {
        success: true,
        message: 'Senha alterada com sucesso! Você já pode utilizar o sistema normalmente.',
      })
    } catch (err) {
      return c.json(500, {
        error: 'Falha ao atualizar a senha: ' + (err.message || 'Erro desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
