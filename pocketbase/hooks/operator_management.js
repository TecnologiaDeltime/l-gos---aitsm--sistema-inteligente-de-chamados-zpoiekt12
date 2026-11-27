// pocketbase/hooks/operator_management.js
// Criação e exclusão de operadores restritas exclusivamente ao perfil administrador,
// envio de e-mail de primeiro acesso e troca obrigatória de senha
;(function () {
  // ---------------------------------------------------------------------------
  // Auxiliares de limpeza de referências (escopo local do hook — não usar globais)
  // ---------------------------------------------------------------------------

  // Apaga todos os registros de uma coleção que casem com o filtro (em lotes)
  var _delAll = function (col, filter) {
    try {
      for (var round = 0; round < 8; round++) {
        var rows = $app.findRecordsByFilter(col, filter, '', 250, 0)
        if (!rows || rows.length === 0) break
        var removed = 0
        for (var i = 0; i < rows.length; i++) {
          try {
            $app.delete(rows[i])
            removed++
          } catch (_) {}
        }
        if (removed === 0) break
      }
    } catch (_) {}
  }

  // Neutraliza a referência ao usuário em campos relation simples (define '')
  var _clearRefs = function (col, filter, fields) {
    try {
      for (var round = 0; round < 8; round++) {
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
          } catch (_) {}
        }
        if (changed === 0) break
      }
    } catch (_) {}
  }

  // Remove o id do usuário de campos relation multivalorados (listas)
  var _removeFromList = function (col, filter, field, userId) {
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
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Limpeza ampla: cobre TODAS as coleções que referenciam users.
  // Vínculos meramente atributivos/históricos (votos, movimentações, logs, notificações)
  // são neutralizados ou removidos; vínculos operacionais essenciais são bloqueados
  // antes (ver checagens na rota DELETE).
  var _cleanupOperatorRefs = function (id) {
    // Limpa as entradas de autenticação internas do PocketBase (login OAuth, MFA,
    // senhas de uso único e origens de sessão). Sem isso o DELETE do usuário falha
    // por constraint mesmo sem nenhum vínculo de aplicação.
    _delAll('_externalAuths', 'recordRef = "' + id + '"')
    _delAll('_mfas', 'recordRef = "' + id + '"')
    _delAll('_otps', 'recordRef = "' + id + '"')
    _delAll('_authOrigins', 'recordRef = "' + id + '"')

    // Listas multivaloradas: só remove o id do usuário
    _removeFromList('queues', 'members ~ "' + id + '"', 'members', id)
    _removeFromList('change_committee', 'members ~ "' + id + '"', 'members', id)
    _removeFromList('tickets', 'participants ~ "' + id + '"', 'participants', id)

    // Relations simples que podem ficar vazios: neutraliza a referência
    var clears = [
      // Chamados: quem encerrou / ciclo do operador (histórico do chamado permanece)
      ['tickets', 'closed_by = "' + id + '"', ['closed_by']],
      ['tickets', 'operator_cycle_user = "' + id + '"', ['operator_cycle_user']],
      // Visitas técnicas: responsáveis atributivos
      ['technical_visits', 'scheduling_responsible = "' + id + '"', ['scheduling_responsible']],
      ['technical_visits', 'cancellation_responsible = "' + id + '"', ['cancellation_responsible']],
      // Ordens de serviço geradas por visitas
      ['service_orders', 'technician = "' + id + '"', ['technician']],
      // Aprovações já decididas (pendentes são bloqueadas antes)
      ['approvals', 'approver = "' + id + '" && status != "Pendente"', ['approver']],
      ['approvals', 'requester = "' + id + '" && status != "Pendente"', ['requester']],
      // Chamados agendados não ativos
      ['scheduled_tickets', 'assigned_to = "' + id + '" && status != "agendado"', ['assigned_to']],
      // Base de conhecimento
      ['knowledge_articles', 'author = "' + id + '"', ['author']],
      ['kb_sources', 'uploaded_by = "' + id + '"', ['uploaded_by']],
      // Mudanças
      ['changes', 'implemented_by = "' + id + '"', ['implemented_by']],
      ['changes', 'created_by = "' + id + '"', ['created_by']],
      ['change_approvals', 'approver = "' + id + '"', ['approver']],
      // Despesas e deslocamentos
      ['expenses', 'technician = "' + id + '"', ['technician']],
      ['travel_entries', 'technician = "' + id + '"', ['technician']],
      ['time_entries', 'approved_by = "' + id + '"', ['approved_by']],
      // Cofre de credenciais
      ['vault_credentials', 'created_by = "' + id + '"', ['created_by']],
      ['vault_credentials', 'updated_by = "' + id + '"', ['updated_by']],
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
      // Atendimento (chat interno) — histórico do cliente permanece
      ['atendimento_mensagens', 'operador = "' + id + '"', ['operador']],
      ['atendimento_conversas', 'operador = "' + id + '"', ['operador']],
      ['atendimento_dossies', 'operator = "' + id + '"', ['operator']],
      // Inventário de aparelhos: aparelho em uso pelo operador volta a ficar disponível
      ['inventory_devices', 'assigned_to = "' + id + '"', ['assigned_to']],
      ['inventory_devices', 'created_by = "' + id + '"', ['created_by']],
      // Laudos fotográficos: autor atributivo (technician é bloqueado antes)
      ['laudos', 'created_by = "' + id + '"', ['created_by']],
      // Checklists de visita e campos personalizados
      ['visit_checklists', 'completed_by = "' + id + '"', ['completed_by']],
      ['custom_field_defs', 'created_by = "' + id + '"', ['created_by']],
      // Contatos de cliente vinculados a login
      ['client_contacts', 'user = "' + id + '"', ['user']],
    ]
    for (var ci = 0; ci < clears.length; ci++) {
      _clearRefs(clears[ci][0], clears[ci][1], clears[ci][2])
    }

    // Registros auxiliares/atributivos do próprio usuário: apaga
    var dels = [
      // 2FA e notificações
      ['user_totp', 'user = "' + id + '"'],
      ['notifications', 'user = "' + id + '"'],
      // Votos em sugestões (author das sugestões é tratado nas checagens de bloqueio)
      ['suggestion_votes', 'voter = "' + id + '"'],
      // Movimentações de inventário registradas pelo operador
      ['inventory_movements', 'performed_by = "' + id + '"'],
      // Rascunhos de conhecimento revisados
      ['knowledge_drafts', 'reviewed_by = "' + id + '"'],
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
      // Mensagens de chat entre operadores (sender e recipient são required)
      ['operator_chat_messages', 'sender = "' + id + '"'],
      ['operator_chat_messages', 'recipient = "' + id + '"'],
      // Logs de auditoria e histórico de chamados do usuário
      // (attributivos: o chamado preserva seus dados; apenas o registro "quem fez" é removido)
      ['audit_logs', 'user = "' + id + '"'],
      ['ticket_history', 'user = "' + id + '"'],
      // Logs de automação de ativos (operador é attributivo)
      ['asset_automation_logs', 'operator = "' + id + '"'],
    ]
    for (var di = 0; di < dels.length; di++) {
      _delAll(dels[di][0], dels[di][1])
    }
  }

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
            '<p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Suas credenciais de primeiro acesso foram criadas</p>' +
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
  routerAdd(
    'DELETE',
    '/backend/v1/operators/{id}',
    function (c) {
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

      // Verificação detalhada de vínculos operacionais para preservar a integridade dos dados históricos
      var blockingReasons = []

      // 1. Chamados atribuídos
      try {
        var tktAssigned = $app.findRecordsByFilter(
          'tickets',
          'assigned_to = "' + id + '"',
          '',
          10,
          0,
        )
        if (tktAssigned && tktAssigned.length > 0) {
          blockingReasons.push(
            'possui chamados atribuídos como responsável (' +
              tktAssigned.length +
              ' ou mais chamados)',
          )
        }
      } catch (_) {}

      // 2. Apontamentos de horas / interações em chamados
      try {
        var interactions = $app.findRecordsByFilter(
          'ticket_interactions',
          'author = "' + id + '"',
          '',
          10,
          0,
        )
        if (interactions && interactions.length > 0) {
          blockingReasons.push('possui interações ou apontamentos de horas registrados em chamados')
        }
      } catch (_) {}

      // 3. Anexos postados
      try {
        var attachments = $app.findRecordsByFilter(
          'ticket_attachments',
          'uploaded_by = "' + id + '"',
          '',
          10,
          0,
        )
        if (attachments && attachments.length > 0) {
          blockingReasons.push('possui anexos de chamados enviados')
        }
      } catch (_) {}

      // 4. Visitas técnicas atribuídas
      try {
        var visits = $app.findRecordsByFilter(
          'technical_visits',
          'technician = "' + id + '"',
          '',
          10,
          0,
        )
        if (visits && visits.length > 0) {
          blockingReasons.push(
            'possui visitas técnicas atribuídas (' + visits.length + ' ou mais visitas)',
          )
        }
      } catch (_) {}

      // 5. Apontamentos avulsos de tempo (time_entries)
      try {
        var timeEntries = $app.findRecordsByFilter(
          'time_entries',
          'technician = "' + id + '"',
          '',
          10,
          0,
        )
        if (timeEntries && timeEntries.length > 0) {
          blockingReasons.push('possui lançamentos de horas de atendimento registrados')
        }
      } catch (_) {}

      // 6. Apontamentos de tempo de visitas técnicas
      try {
        var vEntries = $app.findRecordsByFilter(
          'visit_time_entries',
          'technician = "' + id + '"',
          '',
          10,
          0,
        )
        if (vEntries && vEntries.length > 0) {
          blockingReasons.push('possui registros de tempo de visitas técnicas')
        }
      } catch (_) {}

      // 7. Aprovações pendentes (como aprovador ou solicitante — vínculo obrigatório)
      try {
        var pendingApprovals = $app.findRecordsByFilter(
          'approvals',
          '(approver = "' + id + '" || requester = "' + id + '") && status = "Pendente"',
          '',
          10,
          0,
        )
        if (pendingApprovals && pendingApprovals.length > 0) {
          blockingReasons.push(
            'possui aprovações pendentes aguardando decisão ou solicitação (' +
              pendingApprovals.length +
              ' ou mais)',
          )
        }
      } catch (_) {}

      // 8. Chamados agendados ativos
      try {
        var schedTkts = $app.findRecordsByFilter(
          'scheduled_tickets',
          'assigned_to = "' + id + '" && status = "agendado"',
          '',
          10,
          0,
        )
        if (schedTkts && schedTkts.length > 0) {
          blockingReasons.push('possui chamados agendados recorrentes atribuídos')
        }
      } catch (_) {}

      // 9. Laudos fotográficos como técnico responsável
      try {
        var laudosTec = $app.findRecordsByFilter('laudos', 'technician = "' + id + '"', '', 10, 0)
        if (laudosTec && laudosTec.length > 0) {
          blockingReasons.push(
            'possui laudos fotográficos como técnico responsável (' +
              laudosTec.length +
              ' ou mais laudos)',
          )
        }
      } catch (_) {}

      // 10. Pesquisas de satisfação respondidas
      try {
        var surveys = $app.findRecordsByFilter(
          'satisfaction_surveys',
          'respondent = "' + id + '"',
          '',
          10,
          0,
        )
        if (surveys && surveys.length > 0) {
          blockingReasons.push('possui pesquisas de satisfação respondidas')
        }
      } catch (_) {}

      // 11. Sugestões próprias (author é vínculo obrigatório e significativo)
      try {
        var sugestoes = $app.findRecordsByFilter('suggestions', 'author = "' + id + '"', '', 10, 0)
        if (sugestoes && sugestoes.length > 0) {
          blockingReasons.push(
            'possui sugestões registradas (' + sugestoes.length + ' ou mais sugestões)',
          )
        }
      } catch (_) {}

      if (blockingReasons.length > 0) {
        var msg =
          'Não é possível excluir este operador porque ele possui registros operacionais vinculados: ' +
          blockingReasons.join('; ') +
          '. Para revogar o acesso sem comprometer o histórico, desative a conta do operador ou reatribua seus chamados pendentes.'
        return c.json(400, { error: msg })
      }

      // Se não há vínculos impeditivos, limpar/neutralizar TODAS as referências restantes
      // (auxiliares, atributivas e de log) para que a exclusão não falhe por FK.
      _cleanupOperatorRefs(id)

      // Tentar a exclusão do registro do usuário
      try {
        $app.delete(targetRecord)
        return c.json(200, {
          success: true,
          message: 'Operador excluído com sucesso.',
        })
      } catch (delErr) {
        // Nunca expor o texto cru do constraint do banco ao usuário.
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
})()
