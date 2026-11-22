/**
 * 0550 — Limpeza da restauração v0.0.503 (bridge de conteúdo).
 * Remove a coleção temporária gh_restore_stash, que serviu apenas como
 * stash das fatias do commit 1479b15 durante a ponte de restauração.
 * A gravação das telas (TicketDetail e demais) foi feita diretamente
 * na árvore; nenhuma coleção de produto depende dela.
 */

migrate(
  (db) => {
    const col = db.findCollectionByNameOrId('gh_restore_stash')
    if (col) db.delete(col)
  },
  (db) => {
    /* forward-only: recriar seria reabrir a ponte — não necessário */
  },
)
