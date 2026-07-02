// ─── Shared finance/payroll types ───────────────────────────────────────────
// Canonical instructor payout method union + label map. Previously duplicated
// as InstructorPaymentMethod/INSTRUCTOR_PAYMENT_METHOD_LABELS (staff-finance)
// and InstructorPreferredMethod/PREFERRED_METHOD_LABELS (instructor-payments)
// — same 4 members, same labels, different names.

export type InstructorPayoutMethod = 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'cash'

export const INSTRUCTOR_PAYOUT_METHOD_LABELS: Record<InstructorPayoutMethod, string> = {
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
}
