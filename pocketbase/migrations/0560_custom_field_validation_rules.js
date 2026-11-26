// Migração 0560: regras de validação para os campos customizados da ficha.
// Adiciona a custom_field_defs:
//   required   bool   — preenchimento obrigatório na ficha do chamado
//   min_chars  number — mínimo de caracteres (texto_curto/texto_longo)
//   max_chars  number — máximo de caracteres (texto_curto/texto_longo)
//   min_value  number — valor mínimo (numero)
//   max_value  number — valor máximo (numero)
// Campos nulos/zero = sem regra; definições existentes continuam funcionando sem alteração.
//
// Padrão do projeto (v0.0.433): todo o corpo DENTRO do callback do migrate —
// o parâmetro do callback é o app; nada de globais fora dele. Idempotente:
// campo que já existe não é recriado.

migrate(
  (db) => {
    var col = db.findCollectionByNameOrId('custom_field_defs')

    var wanted = [
      { name: 'required', type: 'bool' },
      { name: 'min_chars', type: 'number' },
      { name: 'max_chars', type: 'number' },
      { name: 'min_value', type: 'number' },
      { name: 'max_value', type: 'number' },
    ]

    var fields = col.fields
    var changed = false
    for (var i = 0; i < wanted.length; i++) {
      var w = wanted[i]
      var exists = false
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].name === w.name) {
          exists = true
          break
        }
      }
      if (!exists) {
        fields.push(new Field({ name: w.name, type: w.type, required: false }))
        changed = true
      }
    }

    if (changed) {
      col.fields = fields
      db.save(col)
    }
  },
  (db) => {
    // Down: remove os campos de regra, se existirem.
    try {
      var col = db.findCollectionByNameOrId('custom_field_defs')
      var fields = col.fields
      var ruleNames = ['required', 'min_chars', 'max_chars', 'min_value', 'max_value']
      var kept = []
      var removedAny = false
      for (var k = 0; k < fields.length; k++) {
        var drop = false
        for (var m = 0; m < ruleNames.length; m++) {
          if (fields[k].name === ruleNames[m]) {
            drop = true
            break
          }
        }
        if (drop) {
          removedAny = true
        } else {
          kept.push(fields[k])
        }
      }
      if (removedAny) {
        col.set('fields', kept)
        db.save(col)
      }
    } catch (_) {}
  },
)
