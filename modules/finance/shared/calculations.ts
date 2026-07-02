// ─── Shared finance calculation helpers ─────────────────────────────────────
// Canonical outstanding-balance clamp, previously repeated verbatim as
// Math.max(0, total - paid) in staff-finance/queries.ts and
// instructor-payments/queries.ts (twice).

export function calculateOutstanding(total: number, paid: number): number {
  return Math.max(0, total - paid)
}

export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0)
}
