migrate(
  (app) => {
    const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
    const usersId = '_pb_users_auth_'
    const contactsId = app.findCollectionByNameOrId('client_contacts').id

    // Mode of approval: Individual (um aprovador decide sozinho), Sequencial (1º principal, contingência para 2º e 3º), Paralela (todos recebem juntos; primeiro que aprovar encerra)
    if (!approvalConfigs.fields.getByName('mode')) {
      approvalConfigs.fields.add(
        new SelectField({
          name: 'mode',
          values: ['Individual', 'Sequencial', 'Paralela'],
          maxSelect: 1,
        }),
      )
    }

    // Timeout in minutes for sequential escalation to the next approver
    if (!approvalConfigs.fields.getByName('escalation_timeout_minutes')) {
      approvalConfigs.fields.add(
        new NumberField({
          name: 'escalation_timeout_minutes',
          min: 1,
        }),
      )
    }

    // Client focal points configured as approvers (in order for sequential: 1st, 2nd, 3rd)
    if (!approvalConfigs.fields.getByName('focal_points')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'focal_points',
          collectionId: contactsId,
          maxSelect: 10,
        }),
      )
    }

    // Internal system operators configured as approvers (in order for sequential or fallback)
    if (!approvalConfigs.fields.getByName('internal_approvers')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'internal_approvers',
          collectionId: usersId,
          maxSelect: 10,
        }),
      )
    }

    // Optional rule description or observation
    if (!approvalConfigs.fields.getByName('description')) {
      approvalConfigs.fields.add(
        new TextField({
          name: 'description',
        }),
      )
    }

    // Extend approvalConfigs access rules to allow admin and gestor full management, internal operators to view
    approvalConfigs.listRule = '@request.auth.id != ""'
    approvalConfigs.viewRule = '@request.auth.id != ""'
    approvalConfigs.createRule = '@request.auth.role = "admin" || @request.auth.role = "gestor"'
    approvalConfigs.updateRule = '@request.auth.role = "admin" || @request.auth.role = "gestor"'
    approvalConfigs.deleteRule = '@request.auth.role = "admin" || @request.auth.role = "gestor"'

    app.save(approvalConfigs)

    // Extend 'approvals' collection with fields for multi-stage / sequential tracking
    const approvals = app.findCollectionByNameOrId('approvals')

    if (!approvals.fields.getByName('approval_config')) {
      approvals.fields.add(
        new RelationField({
          name: 'approval_config',
          collectionId: approvalConfigs.id,
          maxSelect: 1,
        }),
      )
    }

    if (!approvals.fields.getByName('stage')) {
      approvals.fields.add(
        new NumberField({
          name: 'stage',
          min: 1,
        }),
      )
    }

    if (!approvals.fields.getByName('escalation_deadline')) {
      approvals.fields.add(
        new DateField({
          name: 'escalation_deadline',
        }),
      )
    }

    if (!approvals.fields.getByName('target_contact')) {
      approvals.fields.add(
        new RelationField({
          name: 'target_contact',
          collectionId: contactsId,
          maxSelect: 1,
        }),
      )
    }

    if (!approvals.fields.getByName('target_email')) {
      approvals.fields.add(
        new EmailField({
          name: 'target_email',
        }),
      )
    }

    if (!approvals.fields.getByName('mode')) {
      approvals.fields.add(
        new SelectField({
          name: 'mode',
          values: ['Individual', 'Sequencial', 'Paralela'],
          maxSelect: 1,
        }),
      )
    }

    app.save(approvals)
  },
  (app) => {
    try {
      const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
      const configFields = [
        'mode',
        'escalation_timeout_minutes',
        'focal_points',
        'internal_approvers',
        'description',
      ]
      configFields.forEach((f) => {
        if (approvalConfigs.fields.getByName(f)) approvalConfigs.fields.removeByName(f)
      })
      app.save(approvalConfigs)
    } catch (_) {}

    try {
      const approvals = app.findCollectionByNameOrId('approvals')
      const appFields = [
        'approval_config',
        'stage',
        'escalation_deadline',
        'target_contact',
        'target_email',
        'mode',
      ]
      appFields.forEach((f) => {
        if (approvals.fields.getByName(f)) approvals.fields.removeByName(f)
      })
      app.save(approvals)
    } catch (_) {}
  },
)
