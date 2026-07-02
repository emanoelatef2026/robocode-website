// ─── Shared currency/number formatters ──────────────────────────────────────
// Canonical implementations for the Finance, Staff Finance, and Instructor
// Payments modules. Previously duplicated verbatim in
// modules/staff-finance/types.ts and modules/instructor-payments/types.ts.

export function fmtEGP(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style:    'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
