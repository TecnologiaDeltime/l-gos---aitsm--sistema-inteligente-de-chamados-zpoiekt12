routerAdd(
  'POST',
  '/backend/v1/visits/{id}/calculate-reimbursement',
  (e) => {
    const visitId = e.request.pathValue('id')
    if (!visitId) return e.badRequestError('Visit ID is required')

    let visit
    try {
      visit = $app.findRecordById('technical_visits', visitId)
    } catch (_) {
      return e.notFoundError('Visit not found')
    }

    var mileage = visit.getFloat('calculated_mileage') || 0
    var tolls = visit.getFloat('tolls') || 0
    var parking = visit.getFloat('parking') || 0
    var fuel = visit.getFloat('fuel') || 0
    var otherCosts = visit.getFloat('other_costs') || 0

    var ratePerKm = 0
    try {
      var rates = $app.findRecordsByFilter('km_rates', 'active = true', '-effective_date', 1, 0)
      if (rates.length > 0) ratePerKm = rates[0].getFloat('rate_per_km') || 0
    } catch (_) {}

    var mileageAmount = mileage * ratePerKm
    var expenseTotal = tolls + parking + fuel + otherCosts
    var totalRequested = mileageAmount + expenseTotal

    var autoApprovalLimit = 50
    var approvalStatus = 'Aguardando Aprovação'
    if (totalRequested <= autoApprovalLimit) {
      approvalStatus = 'Aprovado'
    }

    var reimbCol = $app.findCollectionByNameOrId('reimbursements')
    var reimb = new Record(reimbCol)
    reimb.set('technician', visit.getString('technician'))
    reimb.set('visit', visit.id)
    reimb.set('ticket', visit.getString('ticket'))
    reimb.set('mileage', mileage)
    reimb.set('km_rate', ratePerKm)
    reimb.set('mileage_amount', mileageAmount)
    reimb.set('expense_total', expenseTotal)
    reimb.set('total_requested', totalRequested)
    reimb.set('status', approvalStatus)
    if (approvalStatus === 'Aprovado') {
      reimb.set('total_approved', totalRequested)
      reimb.set('approved_at', new Date().toISOString())
    }
    $app.save(reimb)

    visit.set('reimbursement_status', approvalStatus)
    visit.set('reimbursement_amount', totalRequested)
    if (approvalStatus === 'Aprovado') {
      visit.set('approved_amount', totalRequested)
    }
    $app.saveNoValidate(visit)

    return e.json(200, {
      success: true,
      reimbursement_id: reimb.id,
      mileage_amount: mileageAmount,
      expense_total: expenseTotal,
      total_requested: totalRequested,
      status: approvalStatus,
    })
  },
  $apis.requireAuth(),
)
