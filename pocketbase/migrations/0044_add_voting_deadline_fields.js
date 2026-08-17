migrate(
  (app) => {
    // --- change_committee: voting_deadline_hours (integer, default 48) ---
    var ccCol = app.findCollectionByNameOrId('change_committee')
    if (!ccCol.fields.getByName('voting_deadline_hours')) {
      ccCol.fields.add(
        new NumberField({
          name: 'voting_deadline_hours',
          min: 1,
          onlyInt: true,
        }),
      )
    }
    app.save(ccCol)

    // backfill default 48h on existing committees
    var existing = []
    try {
      existing = app.findRecordsByFilter('change_committee', '', '', 0, 0)
    } catch (_) {}
    for (var i = 0; i < existing.length; i++) {
      var rec = existing[i]
      var cur = rec.get('voting_deadline_hours')
      if (cur === 0 || cur === null || cur === undefined || cur === '' || isNaN(cur)) {
        rec.set('voting_deadline_hours', 48)
        try {
          app.save(rec)
        } catch (_) {}
      }
    }

    // --- changes: voting_deadline_at (date) + escalation_reason (text) ---
    var chCol = app.findCollectionByNameOrId('changes')
    if (!chCol.fields.getByName('voting_deadline_at')) {
      chCol.fields.add(
        new DateField({
          name: 'voting_deadline_at',
        }),
      )
    }
    if (!chCol.fields.getByName('escalation_reason')) {
      chCol.fields.add(
        new TextField({
          name: 'escalation_reason',
        }),
      )
    }
    app.save(chCol)
  },
  (app) => {
    var ccCol = app.findCollectionByNameOrId('change_committee')
    try {
      ccCol.fields.removeByName('voting_deadline_hours')
    } catch (_) {}
    app.save(ccCol)

    var chCol = app.findCollectionByNameOrId('changes')
    try {
      chCol.fields.removeByName('voting_deadline_at')
    } catch (_) {}
    try {
      chCol.fields.removeByName('escalation_reason')
    } catch (_) {}
    app.save(chCol)
  },
)
