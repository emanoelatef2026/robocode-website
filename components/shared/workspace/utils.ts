export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtCurrency(n: number, currency = 'EGP'): string {
  if (!n) return '—'
  return n.toLocaleString('en-EG', { style: 'currency', currency, maximumFractionDigits: 0 })
}
