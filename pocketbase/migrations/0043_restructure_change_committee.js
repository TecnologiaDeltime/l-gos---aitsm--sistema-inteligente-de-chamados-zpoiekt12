migrate(
  (app) => {
    var companiesId = app.findCollectionByNameOrId('companies').id

    // --- Extend change_committee ---
    var col = app.findCollectionByNameOrId('change_committee')

    if (!col.fields.getByName('committee_type')) {
      col.fields.add(
        new SelectField({
          name: 'committee_type',
          values: ['Emergencial', 'Padrão'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('company')) {
      col.fields.add(
        new RelationField({
          name: 'company',
          collectionId: companiesId,
          required: true,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('max_members')) {
      col.fields.add(
        new NumberField({
          name: 'max_members',
          min: 1,
          onlyInt: true,
        }),
      )
    }

    if (!col.fields.getByName('voting_rule')) {
      col.fields.add(
        new SelectField({
          name: 'voting_rule',
          values: ['Presidente Unilateral', 'Maioria Simples'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('member_type')) {
      col.fields.add(
        new JSONField({
          name: 'member_type',
        }),
      )
    }

    col.addIndex('idx_change_committee_company', false, 'company', '')
    col.addIndex('idx_change_committee_type', false, 'committee_type', '')
    col.addIndex('idx_change_committee_company_type', false, 'company,committee_type', '')

    app.save(col)

    // --- Backfill existing committees to default values ---
    var existing = []
    try {
      existing = app.findRecordsByFilter('change_committee', '', '', 0, 0)
    } catch (_) {}
    for (var i = 0; i < existing.length; i++) {
      var rec = existing[i]
      var dirty = false
      if (!rec.getString('committee_type')) {
        rec.set('committee_type', 'Padrão')
        dirty = true
      }
      if (!rec.getString('company')) {
        // try to infer from chairperson
        var chairId = rec.getString('chairperson')
        if (chairId) {
          try {
            var chair = app.findRecordById('users', chairId)
            var cId = chair.getString('company')
            if (cId) {
              rec.set('company', cId)
              dirty = true
            }
          } catch (_) {}
        }
      }
      if (!rec.getString('max_members')) {
        rec.set('max_members', rec.getString('committee_type') === 'Emergencial' ? 3 : 5)
        dirty = true
      }
      if (!rec.getString('voting_rule')) {
        rec.set(
          'voting_rule',
          rec.getString('committee_type') === 'Emergencial'
            ? 'Presidente Unilateral'
            : 'Maioria Simples',
        )
        dirty = true
      }
      if (dirty) {
        try {
          app.save(rec)
        } catch (_) {}
      }
    }

    // --- Extend change_approvals with vote_type ---
    var apCol = app.findCollectionByNameOrId('change_approvals')
    if (!apCol.fields.getByName('vote_type')) {
      apCol.fields.add(
        new SelectField({
          name: 'vote_type',
          values: ['Aprovado', 'Recusado', 'Solicitar Revisão'],
          maxSelect: 1,
        }),
      )
    }
    app.save(apCol)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('change_committee')
    try {
      col.removeIndex('idx_change_committee_company_type')
    } catch (_) {}
    try {
      col.removeIndex('idx_change_committee_type')
    } catch (_) {}
    try {
      col.removeIndex('idx_change_committee_company')
    } catch (_) {}
    ;['committee_type', 'company', 'max_members', 'voting_rule', 'member_type'].forEach(
      function (n) {
        try {
          col.fields.removeByName(n)
        } catch (_) {}
      },
    )
    app.save(col)

    var apCol = app.findCollectionByNameOrId('change_approvals')
    try {
      apCol.fields.removeByName('vote_type')
    } catch (_) {}
    app.save(apCol)
  },
)
