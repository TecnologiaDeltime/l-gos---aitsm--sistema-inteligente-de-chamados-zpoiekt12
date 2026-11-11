// Migração 0163 — Múltiplos aprovadores por regra de aprovação
// Lógos AITSM: a regra de aprovação por empresa+atividade passa a armazenar VÁRIOS
// aprovadores (vários pontos focais do cliente e/ou aprovadores internos).
// Regra de decisão: BASTA UM — o primeiro a decidir resolve (aprova libera, reprova encerra).
// Idempotente: preserva o aprovador único já cadastrado (approver_focal_point /
// approver_user) copiando-o para os novos campos multivalorados, sem perder dados.

migrate(
  (app) => {
    const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
    const clientContacts = app.findCollectionByNameOrId('client_contacts')
    const users = app.findCollectionByNameOrId('users')

    // 1. focal_points_all: todos os pontos focais aprovadores (relação multi client_contacts)
    if (!approvalConfigs.fields.getByName('focal_points_all')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'focal_points_all',
          collectionId: clientContacts.id,
          maxSelect: 20,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    // 2. internal_approvers_all: todos os aprovadores internos (relação multi users)
    if (!approvalConfigs.fields.getByName('internal_approvers_all')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'internal_approvers_all',
          collectionId: users.id,
          maxSelect: 20,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    app.save(approvalConfigs)

    // Backfill idempotente: preserva o aprovador único existente nos novos campos
    try {
      const records = app.findRecordsByFilter('approval_configs', 'id != ""', '', 0, 0)
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        let changed = false

        // Backfill focal_points_all a partir do aprovador único
        const currentFps = rec.getStringSlice ? rec.getStringSlice('focal_points_all') : []
        if ((!currentFps || currentFps.length === 0) && rec.getString('approver_focal_point')) {
          rec.set('focal_points_all', [rec.getString('approver_focal_point')])
          changed = true
        }

        // Backfill internal_approvers_all a partir do aprovador único
        const currentOps = rec.getStringSlice ? rec.getStringSlice('internal_approvers_all') : []
        if ((!currentOps || currentOps.length === 0) && rec.getString('approver_user')) {
          rec.set('internal_approvers_all', [rec.getString('approver_user')])
          changed = true
        }

        if (changed) {
          app.save(rec)
        }
      }
    } catch (bfErr) {
      console.log('Backfill 0163 approval_configs warning:', bfErr.message)
    }
  },
  (app) => {
    try {
      const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
      ;['focal_points_all', 'internal_approvers_all'].forEach((f) => {
        if (approvalConfigs.fields.getByName(f)) approvalConfigs.fields.removeByName(f)
      })
      app.save(approvalConfigs)
    } catch (_) {}
  },
)
