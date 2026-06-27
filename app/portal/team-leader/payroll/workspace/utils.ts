export function getMonthRange(month: number, year: number): { from: string; to: string } {
  const m    = String(month).padStart(2, "0")
  const last = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${m}-01`,
    to:   `${year}-${m}-${String(last).padStart(2, "0")}`,
  }
}

export function getPreset(preset: string): { from: string; to: string } {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "last7":
      return { from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: today }
    case "last30":
      return { from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: today }
    case "this_month":
    default:
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        to:   today,
      }
  }
}
