// Canonical date-display helpers. Each of these existed as an inline
// per-file copy under the same name (formatDate) with different formatting
// options — kept as distinct named exports here rather than merged, since
// their outputs differ (locale, weekday, month length) and are each tied to
// a specific surface.

/** "9 July 2026" — used on certificate PDFs. */
export function formatDateLong(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "Thu, 9 Jul 2026" — used on the student session history page. */
export function formatDateWithWeekday(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** "July 9, 2026" — used on the public blog. */
export function formatDateUS(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
