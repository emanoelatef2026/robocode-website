'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  activeTab:       string
  currentDateFrom: string
  currentDateTo:   string
  currentBranchId: string
}

export default function RevenueFilterBar({ activeTab, currentDateFrom, currentDateTo, currentBranchId }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(currentDateFrom)
  const [to,   setTo]   = useState(currentDateTo)

  function apply() {
    const p = new URLSearchParams({ tab: activeTab })
    if (from) p.set('date_from', from)
    if (to)   p.set('date_to', to)
    if (currentBranchId) p.set('branch_id', currentBranchId)
    router.push(`/admin/revenue?${p.toString()}`)
  }

  function preset(p: string) {
    const today = new Date()
    let f = '', t = today.toISOString().slice(0, 10)
    if (p === 'month') {
      f = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
      t = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
    } else if (p === 'year') {
      f = `${today.getFullYear()}-01-01`
      t = `${today.getFullYear()}-12-31`
    } else if (p === '3m') {
      f = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10)
    } else if (p === '6m') {
      f = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)
    }
    setFrom(f); setTo(t)
  }

  function clear() {
    setFrom(''); setTo('')
    router.push(`/admin/revenue?tab=${activeTab}`)
  }

  const hasFilters = from || to

  return (
    <div className="ds-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['month', 'year', '3m', '6m'] as const).map(p => (
          <button key={p} onClick={() => preset(p)}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]">
            {p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : p === '3m' ? 'Last 3M' : 'Last 6M'}
          </button>
        ))}

        <div className="flex items-center gap-1">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none" />
          <span className="text-xs text-[#94A3B8]">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none" />
        </div>

        <button onClick={apply}
          className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e3a5f]">
          Apply
        </button>

        {hasFilters && (
          <button onClick={clear} className="text-xs text-[#94A3B8] hover:text-[#64748B] underline">
            Clear
          </button>
        )}

        {hasFilters && (
          <span className="text-[11px] text-[#64748B] bg-[#F1F5F9] rounded px-2 py-1">
            {from ? from : '…'} → {to ? to : '…'}
          </span>
        )}
      </div>
    </div>
  )
}
