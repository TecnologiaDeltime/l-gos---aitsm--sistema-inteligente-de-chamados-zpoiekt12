/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('portal_triage_history')
    if (!col) return

    // 1. Manter ou redefinir todos os campos da coleção
    const ensureField = (name, fieldFn) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(fieldFn())
      }
    }

    ensureField(
      'created',
      () => new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    )
    ensureField(
      'updated',
      () => new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
    )
    ensureField('ticket_id', () => new TextField({ name: 'ticket_id', max: 50 }))
    ensureField('ticket_number', () => new TextField({ name: 'ticket_number', max: 50 }))
    ensureField('ticket_title', () => new TextField({ name: 'ticket_title', max: 300 }))
    ensureField('source', () => new TextField({ name: 'source', max: 50 }))
    ensureField(
      'suggested_category_id',
      () => new TextField({ name: 'suggested_category_id', max: 50 }),
    )
    ensureField(
      'suggested_category_name',
      () => new TextField({ name: 'suggested_category_name', max: 200 }),
    )
    ensureField(
      'suggested_subcategory_id',
      () => new TextField({ name: 'suggested_subcategory_id', max: 50 }),
    )
    ensureField(
      'suggested_subcategory_name',
      () => new TextField({ name: 'suggested_subcategory_name', max: 200 }),
    )
    ensureField('queue_id', () => new TextField({ name: 'queue_id', max: 50 }))
    ensureField('queue_name', () => new TextField({ name: 'queue_name', max: 200 }))
    ensureField('confidence', () => new NumberField({ name: 'confidence', min: 0, max: 1 }))
    ensureField('reason', () => new TextField({ name: 'reason', max: 1000 }))
    ensureField('applied', () => new BoolField({ name: 'applied' }))
    ensureField(
      'min_confidence_used',
      () => new NumberField({ name: 'min_confidence_used', min: 0, max: 1 }),
    )
    ensureField('match_method', () => new TextField({ name: 'match_method', max: 50 }))
    ensureField('tokens_used', () => new NumberField({ name: 'tokens_used', min: 0 }))
    ensureField('duration_ms', () => new NumberField({ name: 'duration_ms', min: 0 }))
    ensureField('operator_corrected', () => new BoolField({ name: 'operator_corrected' }))
    ensureField('final_category_id', () => new TextField({ name: 'final_category_id', max: 50 }))
    ensureField(
      'final_category_name',
      () => new TextField({ name: 'final_category_name', max: 200 }),
    )
    ensureField(
      'final_subcategory_id',
      () => new TextField({ name: 'final_subcategory_id', max: 50 }),
    )
    ensureField(
      'final_subcategory_name',
      () => new TextField({ name: 'final_subcategory_name', max: 200 }),
    )
    ensureField('corrected_at', () => new DateField({ name: 'corrected_at' }))
    ensureField('corrected_by', () => new TextField({ name: 'corrected_by', max: 50 }))
    ensureField(
      'correction_seconds',
      () => new NumberField({ name: 'correction_seconds', min: 0, onlyInt: true }),
    )

    col.listRule = '@request.auth.id != ""'
    col.viewRule = '@request.auth.id != ""'
    col.createRule = '@request.auth.id != ""'
    col.updateRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")'
    col.deleteRule = '@request.auth.role = "admin"'

    app.save(col)

    try {
      app
        .db()
        .newQuery(
          "UPDATE portal_triage_history SET created = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE created IS NULL OR created = ''",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE portal_triage_history SET updated = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE updated IS NULL OR updated = ''",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    // rollback no-op
  },
)
