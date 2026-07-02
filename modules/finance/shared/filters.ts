// ─── Shared list-filter helpers ─────────────────────────────────────────────
// Canonical case-insensitive text filter, previously repeated inline for
// filteredInstructors/filteredStaff in FinanceClient.tsx.

export function filterBySearchText<T>(
  items:  T[],
  search: string,
  getText: (item: T) => string,
): T[] {
  if (!search) return items
  const needle = search.toLowerCase()
  return items.filter(item => getText(item).toLowerCase().includes(needle))
}
