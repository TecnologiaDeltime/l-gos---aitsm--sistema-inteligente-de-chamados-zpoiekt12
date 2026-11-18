/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// 0502 — Modo suporte do Portal do Colaborador: campo support_token
// ----------------------------------------------------------------------------
// A impersonação do admin usava o MESMO campo session_token do login normal,
// derrubando a sessão real do colaborador (e vice-versa). Este campo é
// exclusivo da sessão de suporte: o hook A2_collaborator_portal grava o token
// de impersonação aqui e /me (e demais rotas) aceitam ambos os campos.
// O campo é hidden: não é exposto nas regras públicas da coleção, e nunca é
// gravado por regra de cliente — apenas pelo hook (superuser).
// ============================================================================

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('portal_collaborators')
    if (!col.fields.getByName('support_token')) {
      col.fields.add(new TextField({ name: 'support_token', hidden: true }))
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('portal_collaborators')
      const field = col.fields.getByName('support_token')
      if (field) {
        col.fields.remove(field)
        app.save(col)
      }
    } catch (_) {}
  },
)
