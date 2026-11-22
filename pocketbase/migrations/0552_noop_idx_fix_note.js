/**
 * 0552 — No-op: o bug "idx: cannot be blank" do hook A0_gh_restore_tmp era
 * causado por rec.set('idx', { value: i }) (objeto em vez de número) e foi
 * corrigido 100% no próprio hook. Reservado para não reutilizar o ordinal.
 */
migrate(
  (app) => {},
  (app) => {},
)
