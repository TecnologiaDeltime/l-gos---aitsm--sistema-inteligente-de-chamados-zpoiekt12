// pocketbase/hooks/operator_management.js
// Criação e exclusão de operadores restritas exclusivamente ao perfil administrador,
// envio de e-mail de primeiro acesso e troca obrigatória de senha
;(function () {
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
            '<h2 style="color: #0f172a; margin: 0; font-size: 20px;">Bem-vindo ao Lógos AITILSM</h2>' +
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
            '<p style="font-size: 12px; color: #94a3b8; margin: 0;">Este é um e-mail automático enviado pelo Lógos AITILSM. Por favor, não responda a esta mensagem.</p>' +
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

      // 6. Aprovações atribuídas como aprovador pendente
      try {
        var pendingApprovals = $app.findRecordsByFilter(
          'approvals',
          'approver = "' + id + '" && status = "Pendente"',
          '',
          10,
          0,
        )
        if (pendingApprovals && pendingApprovals.length > 0) {
          blockingReasons.push('possui aprovações pendentes atribuídas aguardando decisão')
        }
      } catch (_) {}

      // 7. Chamados agendados
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

      if (blockingReasons.length > 0) {
        var msg =
          'Não é possível excluir este operador porque ele possui registros operacionais vinculados: ' +
          blockingReasons.join('; ') +
          '. Para revogar o acesso sem comprometer o histórico, desative a conta do operador ou reatribua seus chamados pendentes.'
        return c.json(400, { error: msg })
      }

      // Se não há vínculos impeditivos (ou após limpeza das referências transitórias):
      // Remover de filas de atendimento (members relation)
      try {
        var queues = $app.findRecordsByFilter('queues', 'members ~ "' + id + '"', '', 100, 0)
        for (var q = 0; q < queues.length; q++) {
          try {
            var queueRec = queues[q]
            var currentMembers = queueRec.getStringSlice('members') || []
            var newMembers = []
            for (var m = 0; m < currentMembers.length; m++) {
              if (currentMembers[m] !== id) {
                newMembers.push(currentMembers[m])
              }
            }
            queueRec.set('members', newMembers)
            $app.save(queueRec)
          } catch (_) {}
        }
      } catch (_) {}

      // Remover comitê de mudanças se membro
      try {
        var committees = $app.findRecordsByFilter(
          'change_committee',
          'members ~ "' + id + '"',
          '',
          100,
          0,
        )
        for (var cm = 0; cm < committees.length; cm++) {
          try {
            var cRec = committees[cm]
            var cmMembers = cRec.getStringSlice('members') || []
            var newCmMembers = []
            for (var cmi = 0; cmi < cmMembers.length; cmi++) {
              if (cmMembers[cmi] !== id) {
                newCmMembers.push(cmMembers[cmi])
              }
            }
            cRec.set('members', newCmMembers)
            $app.save(cRec)
          } catch (_) {}
        }
      } catch (_) {}

      // Remover registros auxiliares não essenciais do operador (totp, snapshots diários, metas, notificações)
      try {
        var totpRecords = $app.findRecordsByFilter('user_totp', 'user = "' + id + '"', '', 10, 0)
        for (var t = 0; t < totpRecords.length; t++) {
          try {
            $app.delete(totpRecords[t])
          } catch (_) {}
        }
      } catch (_) {}

      try {
        var notifs = $app.findRecordsByFilter('notifications', 'user = "' + id + '"', '', 500, 0)
        for (var n = 0; n < notifs.length; n++) {
          try {
            $app.delete(notifs[n])
          } catch (_) {}
        }
      } catch (_) {}

      try {
        var snapshots = $app.findRecordsByFilter(
          'operator_daily_snapshots',
          'operator = "' + id + '"',
          '',
          100,
          0,
        )
        for (var s = 0; s < snapshots.length; s++) {
          try {
            $app.delete(snapshots[s])
          } catch (_) {}
        }
      } catch (_) {}

      try {
        var goals = $app.findRecordsByFilter(
          'technician_goals',
          'technician = "' + id + '"',
          '',
          100,
          0,
        )
        for (var g = 0; g < goals.length; g++) {
          try {
            $app.delete(goals[g])
          } catch (_) {}
        }
      } catch (_) {}

      try {
        var slaGoals = $app.findRecordsByFilter(
          'sla_goals',
          'technician = "' + id + '"',
          '',
          100,
          0,
        )
        for (var sg = 0; sg < slaGoals.length; sg++) {
          try {
            $app.delete(slaGoals[sg])
          } catch (_) {}
        }
      } catch (_) {}

      try {
        var tviews = $app.findRecordsByFilter('ticket_views', 'user = "' + id + '"', '', 500, 0)
        for (var tv = 0; tv < tviews.length; tv++) {
          try {
            $app.delete(tviews[tv])
          } catch (_) {}
        }
      } catch (_) {}

      // Tentar a exclusão do registro do usuário
      try {
        $app.delete(targetRecord)
        return c.json(200, {
          success: true,
          message: 'Operador excluído com sucesso.',
        })
      } catch (delErr) {
        $app
          .logger()
          .error('operator_management: erro ao deletar usuario', 'id', id, 'err', delErr.message)
        return c.json(400, {
          error:
            'Não foi possível excluir o operador: ' +
            (delErr.message ||
              'Existem registros vinculados que impedem a exclusão. Tente desativar o operador.'),
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
        return c.json(400, { error: 'A confirmação da nova senha não confere.' })
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
