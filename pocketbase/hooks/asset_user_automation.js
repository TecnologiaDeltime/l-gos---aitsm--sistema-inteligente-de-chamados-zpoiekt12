/**
 * Hook do PocketBase para automação e auditoria do relacionamento Ativo <-> Usuário Responsável
 *
 * REGRA 1 (Backend): Quando um usuário for excluído (collection 'users' ou 'client_contacts'),
 * garante que qualquer equipamento vinculado tenha o status availability_status = "Disponível".
 *
 * REGRA 2 (Backend): Ao excluir um equipamento (onRecordDeleteRequest), caso possua usuário vinculado,
 * registra no log a mudança de status / exclusão do ativo com preservação de histórico.
 */

// REGRA 1: Após exclusão em users
onRecordAfterDeleteSuccess((e) => {
  const userRec = e.record
  const userId = userRec.id
  const userName = userRec.getString('name') || userRec.getString('email') || userId
  const operatorId = e.auth ? e.auth.id : ''
  const operatorName = e.auth
    ? e.auth.getString('name') || e.auth.getString('email') || 'Operador'
    : 'Sistema'

  try {
    const safeName = userName.replace(/"/g, '')
    const filter =
      'responsible_user = "' +
      userId +
      '" || owner = "' +
      userId +
      '" || responsible_user = "' +
      safeName +
      '" || owner = "' +
      safeName +
      '"'
    const equipments = $app.findRecordsByFilter('equipments', filter, '', 500, 0)

    for (let i = 0; i < equipments.length; i++) {
      const eq = equipments[i]
      if (eq.getString('availability_status') !== 'Disponível') {
        eq.set('availability_status', 'Disponível')
        $app.save(eq)

        // Grava no log de automação
        try {
          const logCol = $app.findCollectionByNameOrId('asset_automation_logs')
          const log = new Record(logCol)
          if (operatorId) log.set('operator', operatorId)
          log.set('operator_name', operatorName)
          log.set('action_type', 'mudanca_status')
          log.set('equipment_id', eq.id)
          log.set('equipment_name', eq.getString('name'))
          log.set('target_user_id', userId)
          log.set('target_user_name', userName)
          log.set(
            'description',
            'Status do equipamento "' +
              eq.getString('name') +
              '" alterado para "Disponível" após exclusão do usuário responsável "' +
              userName +
              '".',
          )
          log.set(
            'details',
            JSON.stringify({
              trigger: 'backend_hook_user_delete',
              user_id: userId,
              user_name: userName,
              equipment_id: eq.id,
              new_status: 'Disponível',
            }),
          )
          $app.save(log)
        } catch (logErr) {
          $app
            .logger()
            .error('Falha ao gravar log de automacao no hook de users', 'error', logErr.message)
        }
      }
    }
  } catch (err) {
    $app.logger().error('Erro no hook onRecordAfterDeleteSuccess (users)', 'error', err.message)
  }

  return e.next()
}, 'users')

// REGRA 1: Após exclusão em client_contacts (Colaboradores / Usuários de Clientes)
onRecordAfterDeleteSuccess((e) => {
  const contactRec = e.record
  const contactId = contactRec.id
  const contactName = contactRec.getString('full_name') || contactId
  const linkedUserId = contactRec.getString('user') || ''
  const operatorId = e.auth ? e.auth.id : ''
  const operatorName = e.auth
    ? e.auth.getString('name') || e.auth.getString('email') || 'Operador'
    : 'Sistema'

  try {
    const safeName = contactName.replace(/"/g, '')
    let filter =
      'responsible_user = "' +
      contactId +
      '" || owner = "' +
      contactId +
      '" || responsible_user = "' +
      safeName +
      '" || owner = "' +
      safeName +
      '"'
    if (linkedUserId) {
      filter += ' || responsible_user = "' + linkedUserId + '" || owner = "' + linkedUserId + '"'
    }
    const equipments = $app.findRecordsByFilter('equipments', filter, '', 500, 0)

    for (let i = 0; i < equipments.length; i++) {
      const eq = equipments[i]
      if (eq.getString('availability_status') !== 'Disponível') {
        eq.set('availability_status', 'Disponível')
        $app.save(eq)

        try {
          const logCol = $app.findCollectionByNameOrId('asset_automation_logs')
          const log = new Record(logCol)
          if (operatorId) log.set('operator', operatorId)
          log.set('operator_name', operatorName)
          log.set('action_type', 'mudanca_status')
          log.set('equipment_id', eq.id)
          log.set('equipment_name', eq.getString('name'))
          log.set('target_user_id', contactId)
          log.set('target_user_name', contactName)
          log.set(
            'description',
            'Status do equipamento "' +
              eq.getString('name') +
              '" alterado para "Disponível" após exclusão do colaborador/usuário de cliente "' +
              contactName +
              '".',
          )
          log.set(
            'details',
            JSON.stringify({
              trigger: 'backend_hook_contact_delete',
              contact_id: contactId,
              contact_name: contactName,
              linked_user_id: linkedUserId,
              equipment_id: eq.id,
              new_status: 'Disponível',
            }),
          )
          $app.save(log)
        } catch (logErr) {
          $app
            .logger()
            .error(
              'Falha ao gravar log de automacao no hook de client_contacts',
              'error',
              logErr.message,
            )
        }
      }
    }

    // Registra o evento de exclusão do colaborador no log de automações caso ainda não tenha sido registrado pela UI
    try {
      const logCol = $app.findCollectionByNameOrId('asset_automation_logs')
      const log = new Record(logCol)
      if (operatorId) log.set('operator', operatorId)
      log.set('operator_name', operatorName)
      log.set('action_type', 'exclusao_usuario')
      log.set('target_user_id', contactId)
      log.set('target_user_name', contactName)
      if (equipments.length > 0) {
        log.set('equipment_id', equipments[0].id)
        log.set('equipment_name', equipments.map((item) => item.getString('name')).join(', '))
      }
      log.set(
        'description',
        'Cadastro do colaborador/usuário de cliente "' +
          contactName +
          '" excluído. ' +
          (equipments.length > 0
            ? equipments.length + ' equipamento(s) vinculado(s) alterado(s) para "Disponível".'
            : 'Nenhum equipamento estava vinculado.'),
      )
      log.set(
        'details',
        JSON.stringify({
          trigger: 'backend_hook_contact_delete',
          contact_id: contactId,
          contact_name: contactName,
          client_id: contactRec.getString('client'),
          associated_equipments_count: equipments.length,
          associated_equipments: equipments.map((item) => ({
            id: item.id,
            name: item.getString('name'),
          })),
        }),
      )
      $app.save(log)
    } catch (auditErr) {
      $app
        .logger()
        .error(
          'Falha ao gravar log de exclusao_usuario no hook de client_contacts',
          'error',
          auditErr.message,
        )
    }
  } catch (err) {
    $app
      .logger()
      .error('Erro no hook onRecordAfterDeleteSuccess (client_contacts)', 'error', err.message)
  }

  return e.next()
}, 'client_contacts')

// REGRA 2: Ao excluir um equipamento, registra a ação com dados do usuário vinculado e status Disponível
onRecordDeleteRequest((e) => {
  const eq = e.record
  const eqId = eq.id
  const eqName = eq.getString('name')
  const owner = eq.getString('owner')
  const responsible = eq.getString('responsible_user')
  const targetUser = owner || responsible || ''

  const operatorId = e.auth ? e.auth.id : ''
  const operatorName = e.auth
    ? e.auth.getString('name') || e.auth.getString('email') || 'Operador'
    : 'Operador'

  try {
    const logCol = $app.findCollectionByNameOrId('asset_automation_logs')
    const log = new Record(logCol)
    if (operatorId) log.set('operator', operatorId)
    log.set('operator_name', operatorName)
    log.set('action_type', 'exclusao_ativo')
    log.set('equipment_id', eqId)
    log.set('equipment_name', eqName)
    log.set('target_user_name', targetUser || 'Nenhum')
    log.set(
      'description',
      'Equipamento "' +
        eqName +
        '" foi excluído pelo operador. Status no momento da confirmação: Disponível. Usuário vinculado: ' +
        (targetUser || 'Nenhum') +
        '.',
    )
    log.set(
      'details',
      JSON.stringify({
        equipment_id: eqId,
        equipment_name: eqName,
        serial_number: eq.getString('serial_number'),
        patrimony_number: eq.getString('patrimony_number'),
        company: eq.getString('company'),
        owner: owner,
        responsible_user: responsible,
        status: eq.getString('status'),
        availability_status_at_delete: 'Disponível',
      }),
    )
    $app.save(log)
  } catch (err) {
    $app.logger().error('Erro ao gravar log antes de excluir equipamento', 'error', err.message)
  }

  return e.next()
}, 'equipments')
