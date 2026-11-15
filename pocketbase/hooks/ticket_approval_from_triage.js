/// <reference path="../pb_data/types.d.ts" />

/**
 * ticket_approval_from_triage.js — Reexecuta o casamento da regra de aprovação
 * quando a categoria/subatividade do chamado muda via UPDATE (re-categorização
 * manual do operador ou aplicação da triagem automática de IA).
 *
 * Motivo: o hook ticket_approval_check roda no after-create, quando o chamado
 * recém-aberto ainda NÃO tem subatividade (a triagem automática por IA aplica
 * categoria/subatividade de forma assíncrona ~segundos depois). Sem isto, um
 * chamado aberto sem subatividade nunca entra em "Aguardando Aprovação", mesmo
 * existindo regra ativa para a atividade (caso CLI-001 - 00135).
 *
 * Idempotente: o próprio ticket_approval_check não duplica pendência (procura
 * aprovação Pendente existente) e não roda em chamados já em approval_hold.
 * Não bloqueia o update em caso de erro.
 *
 * Regra do JSVM: helpers publicados via globalThis — referências bare de outro
 * arquivo lançam ReferenceError dentro do callback.
 */
onRecordAfterUpdateSuccess((e) => {
  try {
    var rec = e.record
    if (rec.getBool('approval_hold')) return e.next()

    var status = rec.getString('status') || ''
    if (status === 'Resolvido' || status === 'Encerrado' || status === 'Cancelado') {
      return e.next()
    }

    var newCat = rec.getString('category') || ''
    var newSub = rec.getString('subcategory') || ''
    if (!newCat && !newSub) return e.next()

    // Valor ANTES do update: em after-update-success o banco já está persistido,
    // então usamos rec.original() (estado pré-update) para detectar a mudança.
    var oldCat = ''
    var oldSub = ''
    try {
      var orig = typeof rec.original === 'function' ? rec.original() : null
      if (orig) {
        oldCat = orig.getString('category') || ''
        oldSub = orig.getString('subcategory') || ''
      }
    } catch (_) {}
    if (newCat === oldCat && newSub === oldSub) return e.next()

    if (typeof globalThis.ticketApprovalRunCheck !== 'function') {
      console.warn('[APPROVAL_FROM_TRIAGE] ticketApprovalRunCheck indisponível — recheck pulado')
      return e.next()
    }

    globalThis.ticketApprovalRunCheck(e.app, rec, e.auth || null)
    console.log(
      '[APPROVAL_FROM_TRIAGE] recheck executado no chamado #' + (rec.getString('number') || rec.id),
    )
  } catch (err) {
    console.error('[APPROVAL_FROM_TRIAGE] erro no recheck de aprovação:', err)
  }

  return e.next()
}, 'tickets')
